import { Platform } from "react-native";
import { apiPost } from "./apiService";

type Feature = "search" | "undo" | "messageRequest" | "subscription";
type InAppPurchasesModule = typeof import("expo-in-app-purchases");
type Purchase = any;

const FEATURE_PRODUCTS: Record<Feature, string> = {
  search: "searchtoken",
  undo: "undotoken",
  messageRequest: "messagereqtoken",
  subscription: "oddsubscription",
};

let connected = false;
let inAppPurchases: InAppPurchasesModule | null = null;
let loadPromise: Promise<InAppPurchasesModule> | null = null;
let listenerRegistered = false;

async function loadModule() {
  if (Platform.OS !== "ios") {
    throw new Error("In-app purchases are only supported on iOS.");
  }

  if (inAppPurchases) return inAppPurchases;
  if (!loadPromise) {
    loadPromise = import("expo-in-app-purchases")
      .then((module) => {
        const resolved: any = (module as any)?.default ?? module;
        if (
          !resolved ||
          typeof resolved.connectAsync !== "function" ||
          !resolved.IAPResponseCode
        ) {
          throw new Error("In-app purchases are not available in this build (missing native module).");
        }
        inAppPurchases = resolved as InAppPurchasesModule;
        return inAppPurchases;
      })
      .catch((err) => {
        console.warn("expo-in-app-purchases unavailable", err);
        loadPromise = null;
        throw new Error("In-app purchases are not available in this build (Expo Go or missing native module).");
      });
  }

  return loadPromise;
}

async function ensureConnection() {
  const InAppPurchases = await loadModule();

  if (connected) return InAppPurchases;

  try {
    if (typeof InAppPurchases.connectAsync !== "function") {
      throw new Error("In-app purchases are not available in this build (missing native module).");
    }
    await InAppPurchases.connectAsync();
    connected = true;
    if (!listenerRegistered && typeof (InAppPurchases as any).setPurchaseListener === "function") {
      (InAppPurchases as any).setPurchaseListener(
        ({ responseCode, results }: { responseCode?: number; results?: Purchase[] } = {}) => {
          if (
            responseCode === (InAppPurchases as any).IAPResponseCode?.OK &&
            results?.length
          ) {
            finishTransactions(InAppPurchases, results).catch(() => {});
          }
        },
      );
      listenerRegistered = true;
    }
  } catch (err) {
    connected = false;
    throw err;
  }

  return InAppPurchases;
}

async function finishTransactions(InAppPurchases: InAppPurchasesModule, purchases?: Purchase[]) {
  if (!purchases) return;
  for (const purchase of purchases) {
    try {
      await InAppPurchases.finishTransactionAsync(purchase, false);
    } catch (err) {
      console.warn("finishTransaction failed", err);
    }
  }
}

export async function purchaseFeature(feature: Feature) {
  const InAppPurchases = await ensureConnection();
  const productId = FEATURE_PRODUCTS[feature];

  // Fetch product details to ensure availability
  const { results: products } = await InAppPurchases.getProductsAsync([productId]);
  if (!products || !products.find((p) => p.productId === productId)) {
    throw new Error("Product unavailable");
  }

  const response = (await InAppPurchases.purchaseItemAsync(productId) as unknown) as {
    responseCode: number;
    results?: Purchase[];
  };

  if (!response || typeof response.responseCode !== "number") {
    throw new Error("Purchase not completed");
  }

  if (response.responseCode !== InAppPurchases.IAPResponseCode.OK) {
    await finishTransactions(InAppPurchases, response.results);
    throw new Error("Purchase not completed");
  }

  const receipt = response.results?.[0]?.transactionReceipt;
  if (!receipt) {
    await finishTransactions(InAppPurchases, response.results);
    throw new Error("Missing receipt");
  }

  let verified = false;

  try {
    const verifyResult = await apiPost("/purchases/verify", {
      platform: "ios",
      receipt,
    });

    if (!verifyResult) {
      throw new Error("Purchase verification failed. Please contact support.");
    }

    verified = true;
  } catch (err) {
    console.error("Purchase verification failed:", err);
    throw err;
  }

  if (verified) {
    await finishTransactions(InAppPurchases, response.results);
  }
}
