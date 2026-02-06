import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  purchaseFeature,
  getProductDetails,
  restorePurchases,
  type Feature,
  type ProductDetails,
} from "../services/purchaseClient";
import { useTheme } from "../context/ThemeProvider";

const TERMS_URL = "https://evendating.com/terms";
const PRIVACY_URL = "https://evendating.com/privacy";

interface PurchaseOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  initialFeature?: Feature;
  onPurchased?: (feature: Feature) => Promise<void> | void;
  userSummary?: {
    searchTokens?: number;
    undoTokens?: number;
    messageTokens?: number;
  } | null;
  paymentFlags?: {
    enablePayments?: boolean;
    enableSearchTokens?: boolean;
    enableUndoTokens?: boolean;
    enableMessageReqTokens?: boolean;
  } | null;
}

export function PurchaseOptionsModal({
  visible,
  onClose,
  initialFeature = "messageRequest",
  onPurchased,
  userSummary,
  paymentFlags,
}: PurchaseOptionsModalProps) {
  const { colors } = useTheme();
  const [loadingFeature, setLoadingFeature] = useState<Feature | null>(null);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [productPrices, setProductPrices] = useState<Map<Feature, ProductDetails>>(new Map());
  const [pricesLoaded, setPricesLoaded] = useState(false);

  // Ref-based guard to prevent double-clicks before state updates
  const purchaseInFlightRef = useRef(false);
  const lastPurchaseTimeRef = useRef(0);

  // Fetch product prices from StoreKit on mount
  useEffect(() => {
    if (visible && !pricesLoaded && Platform.OS === "ios") {
      getProductDetails()
        .then((prices) => {
          setProductPrices(prices);
          setPricesLoaded(true);
        })
        .catch((err) => {
          console.warn("[PurchaseOptionsModal] Failed to fetch prices:", err);
          setPricesLoaded(true); // Mark as loaded even on error to show fallback
        });
    }
  }, [visible, pricesLoaded]);

  // Helper to get price string from StoreKit or fallback
  const getPrice = useCallback(
    (feature: Feature, fallback: string): string => {
      const details = productPrices.get(feature);
      if (details?.price) {
        // Format subscription price with /month suffix
        if (feature === "subscription") {
          return `${details.price}/month`;
        }
        return details.price;
      }
      return fallback;
    },
    [productPrices]
  );

  const enabledPayments = paymentFlags?.enablePayments ?? true;
  const modalTitle =
    initialFeature === "subscription" ? "Odd Membership" : "";
  const modalSubtitle =
    initialFeature === "subscription"
      ? "Unlock premium access across the app."
      : "Pick a perk to keep things moving.";
  const options: Array<{
    feature: Feature;
    title: string;
    subtitle: string;
    details: string;
    enabled: boolean;
    remaining?: number;
  }> = [
    {
      feature: "subscription",
      title: "Odd Membership",
      subtitle: getPrice("subscription", "$19.99/month"),
      details: "Gain 3 searches, 5 undo's, and 5 message requests every month. These do not roll over.",
      enabled: enabledPayments,
    },
    {
      feature: "messageRequest",
      title: "Message Request Tokens",
      subtitle: getPrice("messageRequest", "$1.99"),
      details: "1 token lets you send one message request.",
      enabled: paymentFlags?.enableMessageReqTokens ?? true,
      remaining: userSummary?.messageTokens,
    },
    {
      feature: "search",
      title: "Search Tokens",
      subtitle: getPrice("search", "$9.99"),
      details: "Use a token each time you search profiles by name.",
      enabled: paymentFlags?.enableSearchTokens ?? true,
      remaining: userSummary?.searchTokens,
    },
    {
      feature: "undo",
      title: "Undo Tokens",
      subtitle: getPrice("undo", "$1.99"),
      details: "Undo the most recent swipe when you need a do-over.",
      enabled: paymentFlags?.enableUndoTokens ?? true,
      remaining: userSummary?.undoTokens,
    },
  ];

  const displayedOptions = useMemo(
    () => {
      if (initialFeature === "subscription") {
        return options.filter(
          (opt) => opt.enabled && opt.feature === "subscription"
        );
      }
      return options.filter(
        (opt) =>
          opt.enabled && (!initialFeature || opt.feature === initialFeature)
      );
    },
    [options, initialFeature]
  );

  const handlePurchase = useCallback(async (feature: Feature) => {
    // Double-click protection: check ref guard and throttle (300ms minimum between attempts)
    const now = Date.now();
    if (purchaseInFlightRef.current || now - lastPurchaseTimeRef.current < 300) {
      return;
    }

    if (!enabledPayments) {
      onClose();
      return;
    }
    if (Platform.OS !== "ios") {
      onClose();
      return;
    }

    // Set ref guard immediately (before async state update)
    purchaseInFlightRef.current = true;
    lastPurchaseTimeRef.current = now;

    try {
      setLoadingFeature(feature);
      await purchaseFeature(feature);
      if (onPurchased) {
        await onPurchased(feature);
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.message || "Unable to complete purchase. Please try again.";
      console.warn("[purchase] failed", msg);
      // Surface lightweight message; Modal will remain open
      alert(msg);
    } finally {
      setLoadingFeature(null);
      purchaseInFlightRef.current = false;
    }
  }, [enabledPayments, onClose, onPurchased]);

  const handleRestorePurchases = useCallback(async () => {
    if (restoringPurchases || Platform.OS !== "ios") return;

    setRestoringPurchases(true);
    try {
      const result = await restorePurchases();
      if (result.restored > 0) {
        alert(`Restored ${result.restored} purchase${result.restored > 1 ? "s" : ""}.`);
        if (onPurchased) {
          await onPurchased("subscription"); // Refresh user data
        }
        onClose();
      } else {
        alert("No purchases to restore.");
      }
    } catch (err: any) {
      const msg = err?.message || "Unable to restore purchases. Please try again.";
      console.warn("[restore] failed", msg);
      alert(msg);
    } finally {
      setRestoringPurchases(false);
    }
  }, [restoringPurchases, onPurchased, onClose]);

  const openTerms = useCallback(() => {
    Linking.openURL(TERMS_URL).catch(() => {});
  }, []);

  const openPrivacy = useCallback(() => {
    Linking.openURL(PRIVACY_URL).catch(() => {})
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no"
      >
        <TouchableOpacity
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          activeOpacity={1}
          onPress={() => {}}
          accessible={false}
          importantForAccessibility="no"
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={colors.text}
                accessible={false}
                importantForAccessibility="no"
              />
            </TouchableOpacity>
            {modalTitle ? (
              <Text
                style={[styles.title, styles.textShadow, { color: colors.text }]}
                accessibilityRole="header"
                allowFontScaling={true}
              >
                {modalTitle}
              </Text>
            ) : (
              <View style={styles.titleSpacer} />
            )}
            <View style={{ width: 24 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {displayedOptions.map((opt) => {
              const isSelected = opt.feature === initialFeature;
              const isSubscription = opt.feature === "subscription";
              return (
                <View
                  key={opt.feature}
                  style={[
                    styles.planCard,
                    styles.cardShadow,
                    {
                      backgroundColor: colors.background,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <View style={styles.planHeader}>
                    <Text
                      style={[
                        styles.planTag,
                        { backgroundColor: colors.accent + "22", color: colors.accent },
                      ]}
                    >
                      {isSubscription ? "Best value" : "Singles"}
                    </Text>
                    {typeof opt.remaining === "number" && (
                      <Text
                        style={[styles.remaining, { color: colors.subtitle }]}
                        allowFontScaling={true}
                      >
                        {opt.remaining} left
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[styles.planTitle, styles.textShadow, { color: colors.text }]}
                    allowFontScaling={true}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={[styles.planPrice, styles.textShadow, { color: colors.text }]}
                    allowFontScaling={true}
                  >
                    {opt.subtitle}
                  </Text>
                  <View style={[styles.planDivider, { backgroundColor: colors.border }]} />
                  <Text
                    style={[styles.planDetails, { color: colors.subtitle }]}
                    allowFontScaling={true}
                  >
                    {opt.details}
                  </Text>
                  {/* Subscription disclosure - required by App Store */}
                  {isSubscription && (
                    <Text
                      style={[styles.subscriptionDisclosure, { color: colors.subtitle }]}
                      allowFontScaling={true}
                    >
                      Subscription automatically renews monthly unless cancelled at least 24 hours before the end of the current period. Payment will be charged to your Apple ID account. Manage subscriptions in Settings {">"} [Your Name] {">"} Subscriptions.
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.planButton,
                      { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                    onPress={() => handlePurchase(opt.feature)}
                    disabled={!!loadingFeature || restoringPurchases}
                    accessibilityRole="button"
                    accessibilityLabel={`Purchase ${opt.title}`}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {loadingFeature === opt.feature ? (
                      <ActivityIndicator color={colors.buttonText} />
                    ) : (
                      <Text
                        style={[
                          styles.planButtonText,
                          styles.textShadow,
                          { color: colors.buttonText },
                        ]}
                        allowFontScaling={true}
                      >
                        Buy
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Restore Purchases Button */}
            <TouchableOpacity
              style={[styles.restoreBtn, { borderColor: colors.border }]}
              onPress={handleRestorePurchases}
              disabled={restoringPurchases || !!loadingFeature}
              accessibilityRole="button"
              accessibilityLabel="Restore previous purchases"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {restoringPurchases ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={[styles.restoreText, { color: colors.text }]} allowFontScaling={true}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>

            {/* Terms and Privacy Links - required by App Store */}
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={openTerms} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.legalLink, { color: colors.accent }]} allowFontScaling={true}>
                  Terms of Service
                </Text>
              </TouchableOpacity>
              <Text style={[styles.legalSeparator, { color: colors.subtitle }]}> • </Text>
              <TouchableOpacity onPress={openPrivacy} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.legalLink, { color: colors.accent }]} allowFontScaling={true}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close purchase options"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.closeText, { color: colors.text }]} allowFontScaling={true}>
                Done
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },

  sheet: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
    overflow: "hidden",
    maxHeight: "92%",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    flex: 1,
  },
  titleSpacer: {
    flex: 1,
  },

  heroCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -80,
    right: -60,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    opacity: 0.9,
  },
  heroNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    opacity: 0.7,
  },
  planCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  textShadow: {
    textShadowColor: "rgba(0,0,0,0.28)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planTag: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: "700",
    letterSpacing: 0.3,
    overflow: "hidden",
  },
  remaining: {
    fontSize: 12,
    opacity: 0.7,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
  },
  planDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 12,
  },
  planDetails: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  planButton: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  planButtonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  subscriptionDisclosure: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 10,
    opacity: 0.7,
  },

  restoreBtn: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 999,
    minWidth: 160,
    alignItems: "center",
  },

  restoreText: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.85,
  },

  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },

  legalLink: {
    fontSize: 12,
    fontWeight: "500",
  },

  legalSeparator: {
    fontSize: 12,
  },

  closeBtn: {
    alignSelf: "center",
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 999,
  },

  closeText: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.85,
  },
});
