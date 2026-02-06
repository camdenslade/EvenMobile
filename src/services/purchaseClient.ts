import { Platform } from "react-native";
import { apiPost } from "./apiService";

export type Feature = "search" | "undo" | "messageRequest" | "subscription";
type InAppPurchasesModule = typeof import("expo-in-app-purchases");
type Purchase = any;

export interface ProductDetails {
  productId: string;
  price: string;
  priceAmountMicros: string;
  priceCurrencyCode: string;
  title: string;
  description: string;
}

export const FEATURE_PRODUCTS: Record<Feature, string> = {
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

/**
 * Fetches product details from StoreKit for displaying localized prices.
 * Returns a map of feature -> ProductDetails.
 */
export async function getProductDetails(
  features: Feature[] = ["search", "undo", "messageRequest", "subscription"]
): Promise<Map<Feature, ProductDetails>> {
  const result = new Map<Feature, ProductDetails>();

  if (Platform.OS !== "ios") {
    return result;
  }

  try {
    const InAppPurchases = await ensureConnection();
    const productIds = features.map((f) => FEATURE_PRODUCTS[f]);
    const { results: products } = await InAppPurchases.getProductsAsync(productIds);

    if (products && products.length > 0) {
      for (const product of products) {
        // Find which feature this product belongs to
        const featureEntry = Object.entries(FEATURE_PRODUCTS).find(
          ([, productId]) => productId === product.productId
        );
        if (featureEntry) {
          const feature = featureEntry[0] as Feature;
          result.set(feature, {
            productId: product.productId,
            price: String(product.price),
            priceAmountMicros: String(product.priceAmountMicros || "0"),
            priceCurrencyCode: product.priceCurrencyCode || "USD",
            title: product.title || "",
            description: product.description || "",
          });
        }
      }
    }
  } catch (err) {
    console.warn("[getProductDetails] Failed to fetch products:", err);
  }

  return result;
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

/**
 * Restores previous purchases from the App Store.
 * This fetches the user's purchase history from Apple and restores
 * any active subscriptions or unused consumables.
 */
export async function restorePurchases(): Promise<{ restored: number }> {
  if (Platform.OS !== "ios") {
    throw new Error("Restore purchases is only supported on iOS.");
  }

  const InAppPurchases = await ensureConnection();

  // Get purchase history from Apple
  const { results: history } = await (InAppPurchases as any).getPurchaseHistoryAsync();

  if (!history || history.length === 0) {
    return { restored: 0 };
  }

  let restoredCount = 0;

  for (const purchase of history) {
    const receipt = purchase.transactionReceipt;
    if (!receipt) continue;

    try {
      const result = await apiPost("/purchases/restore", {
        platform: "ios",
        receipt,
      });

      if (result && Array.isArray(result) && result.length > 0) {
        restoredCount += result.length;
      }
    } catch (err) {
      console.warn("[restorePurchases] Failed to restore purchase:", err);
    }

    // Finish the transaction
    try {
      await InAppPurchases.finishTransactionAsync(purchase, false);
    } catch (err) {
      console.warn("[restorePurchases] Failed to finish transaction:", err);
    }
  }

  return { restored: restoredCount };
}
