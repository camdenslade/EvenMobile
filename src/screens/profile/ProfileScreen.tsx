//********************************************************************
//
// ProfileScreen Component
//
// Displays the authenticated user's profile with tabs for Get Perks,
// Safety, and Reviews. Shows profile photo, name, age, review summary,
// and navigation options. Supports prerender mode and uses Zustand cache
// for instant display.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the profile screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// __prerender   boolean     Flag for prerendering (returns minimal view if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors           Object            Theme colors
// profile          UserProfile|null  User profile from cache
// setProfile       Function          Zustand setter for profile
// reviewSummary    ReviewSummary|null Review summary from cache
// setReviewSummary  Function          Zustand setter for review summary
// activeTab        string            Current active tab ("getperks"|"safety"|"reviews")
// mainPhoto        string|null        First photo URL from profile
// summ             ReviewSummary|null Response from API
// me               UserProfile|null  Response from API
//
//*******************************************************************

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  View,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
} from "react-native";

import { apiGet } from "../../services/apiService";
import { RatingGauge } from "../reviews/RatingGauge";
import { useTheme } from "../../context/ThemeProvider";
import { useAuth } from "../../context/AuthContext";
import { useSessionData } from "../../context/SessionDataContext";
import GlobalBackground from "../../components/GlobalBackground";
import type { UserProfile } from "../../types/user";
import { AppImage } from "../../components/AppImage";
import { useGlobalRefresh } from "../../context/RefreshContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { PurchaseOptionsModal } from "../../components/PurchaseOptionsModal";

import { useAppCache } from "../../services/appCache";
import AsyncStorage from "@react-native-async-storage/async-storage";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TAB_STORAGE_KEY = "@EvenApp:profileActiveTab";
type TabKey = "account" | "safety" | "reviews";

interface ReviewSummary {
  average: number | null;
  count: number;
  best: number | null;
}

interface ProfileScreenProps {
  navigation?: any;
  __prerender?: boolean;
}

export default function ProfileScreen({
  navigation,
  __prerender,
}: ProfileScreenProps) {
  const { colors } = useTheme();
  const { user: authUser, idToken } = useAuth();
  const {
    reviewSummary,
    userSummary,
    loading: sessionLoading,
    error: sessionError,
    paymentFlags,
    userFlags,
    refreshSessionData,
  } = useSessionData();
  const { refresh, refreshing, registerRefresher } = useGlobalRefresh();

  const profile = useAppCache((s) => s.profile);
  const setProfile = useAppCache((s) => s.setProfile);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const fadeOverlay = useRef(new Animated.Value(0));
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseFeature, setPurchaseFeature] = useState<"search" | "undo" | "messageRequest" | "subscription">("search");
  const [showSearchConfirm, setShowSearchConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("account");

  const hasRefreshedRef = useRef(false);
  const hasHydratedTabRef = useRef(false);

  //********************************************************************
  //
  // refreshProfile Function
  //
  // Refreshes profile data from backend. Updates Zustand cache.
  // Note: reviewSummary and userSummary come from SessionDataContext,
  // so we only fetch /profiles/me here.
  //
  // Return Value
  // ------------
  // Promise<void>
  //
  // Value Parameters
  // ----------------
  // None
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // me      UserProfile|null      Response from /profiles/me
  //
  //*******************************************************************
  const refreshProfile = useCallback(async () => {
    // Only fetch if user is available and we have a token
    if (!authUser?.uid || !idToken) {
      return;
    }

    // Prevent duplicate calls
    if (hasRefreshedRef.current) {
      return;
    }
    hasRefreshedRef.current = true;
    setLoadError(null);

    let success = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const me = await apiGet<UserProfile>("/profiles/me", idToken);
      if (me) {
        setProfile(me);
        success = true;
        break;
      }
      await sleep(200 * (attempt + 1));
    }

    if (!success) {
      setLoadError("Unable to load your profile. Check your connection and try again.");
    }

    hasRefreshedRef.current = false;
  }, [authUser?.uid, idToken, setProfile]);

  useEffect(() => {
    // Wait for auth user to be available before fetching
    if (!authUser?.uid || !idToken) {
      return;
    }

    // Only refresh if we don't have cached profile data yet
    // appBootstrap already preloads this data, so we only need to fetch if cache is empty
    if (!profile) {
      refreshProfile();
    }
  }, [authUser?.uid, idToken, profile, refreshProfile]);

  useEffect(() => {
    return registerRefresher(refreshProfile);
  }, [refreshProfile, registerRefresher]);

  // Reset navigation overlay when returning focus
  useFocusEffect(
    useCallback(() => {
      fadeOverlay.current.setValue(0);
      setNavigating(false);
      return undefined;
    }, [])
  );

  // Hydrate persisted tab selection
  useEffect(() => {
    async function loadTab() {
      try {
        const stored = await AsyncStorage.getItem(TAB_STORAGE_KEY);
        if (stored === "account" || stored === "safety" || stored === "reviews") {
          setActiveTab(stored);
        }
      } catch {
        // ignore load errors; default tab will be used
      } finally {
        hasHydratedTabRef.current = true;
      }
    }
    loadTab();
  }, []);

  // Persist tab changes (after hydration to avoid clobbering)
  useEffect(() => {
    if (!hasHydratedTabRef.current) return;
    AsyncStorage.setItem(TAB_STORAGE_KEY, activeTab).catch(() => {});
  }, [activeTab]);

  const navigateWithFade = useCallback(
    (route: string, params?: any) => {
      setNavigating(true);
      Animated.timing(fadeOverlay.current, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }).start(() => {
        navigation.navigate(route, params);
        fadeOverlay.current.setValue(0);
        setNavigating(false);
      });
    },
    [navigation]
  );

  if (__prerender) {
    return <View style={{ width: 1, height: 1, opacity: 0 }} />;
  }

  // Show loading state while session data is loading to avoid flashing empty values
  if (sessionLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <GlobalBackground />
        <ActivityIndicator size="large" color={colors.accent ?? colors.text} />
      </View>
    );
  }

  const mainPhoto = profile?.photos?.[0] ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />
      <Animated.View
        pointerEvents={navigating ? "auto" : "none"}
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: colors.background, opacity: fadeOverlay.current },
        ]}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent ?? colors.text}
            colors={[colors.accent ?? colors.text]}
          />
        }
      >
        {sessionError && (
          <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.accent ?? colors.text }]}>
            <Text style={[styles.errorText, { color: colors.text }]}>{sessionError}</Text>
            <TouchableOpacity
              onPress={refresh}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry loading account data"
            >
              <Text style={[styles.retryText, { color: colors.accent ?? colors.text }]}>
                {refreshing ? "Retrying..." : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {loadError && (
          <View style={[styles.errorBanner, { backgroundColor: colors.card, borderColor: colors.accent ?? colors.text }]}>
            <Text style={[styles.errorText, { color: colors.text }]}>{loadError}</Text>
            <TouchableOpacity
              onPress={refresh}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry loading profile"
            >
              <Text style={[styles.retryText, { color: colors.accent ?? colors.text }]}>
                {refreshing ? "Retrying..." : "Retry"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View 
          style={styles.settingsRow}
          accessible={false}
          importantForAccessibility="no"
        >
          <TouchableOpacity
            onPress={() => navigateWithFade("Preferences")}
            style={styles.settingsBtn}
            accessible={true}
          accessibilityLabel="Preferences"
          accessibilityRole="button"
          accessibilityHint="Opens preferences screen"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <Ionicons
              name="reorder-three"
              size={32}
              color={colors.text}
              accessible={false}
              importantForAccessibility="no"
            />
        </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigateWithFade("Settings")}
            style={styles.settingsBtn}
            accessible={true}
            accessibilityLabel="Settings"
            accessibilityRole="button"
            accessibilityHint="Opens settings screen"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <AppImage
              source={require("../../../assets/icons/gear.png")}
              style={[styles.settingsIcon, { tintColor: colors.text }]}
              accessibilityRole="none"
              contentFit="contain"
            />
          </TouchableOpacity>
        </View>

        <View 
          style={styles.profileHeader}
          accessible={false}
          importantForAccessibility="no"
        >
          <TouchableOpacity
            style={[
              styles.photoBorder,
              { borderColor: colors.accent ?? colors.text },
            ]}
            onPress={() => {
              if (profile?.userUid) {
                navigateWithFade("UserProfileView", { userId: profile.userUid });
              }
            }}
            disabled={!profile?.userUid}
            accessibilityRole="button"
            accessibilityLabel="Preview profile"
            accessibilityHint="Opens preview of how your profile appears to others"
            accessibilityState={{ disabled: !profile?.userUid }}
            activeOpacity={0.85}
          >
            {mainPhoto ? (
              <AppImage 
                source={mainPhoto} 
                style={styles.profilePhoto}
                accessibilityRole="none"
                priority="high"
              />
            ) : (
              <View style={[styles.noPhoto, { backgroundColor: colors.card }]}>
                <Text 
                  style={{ color: colors.subtitle }}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  No Photo
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text 
            style={[styles.profileName, { color: colors.text }]}
            accessible={true}
            accessibilityRole="header"
            allowFontScaling={true}
          >
            {profile?.name}
          </Text>
          <Text 
            style={[styles.profileAge, { color: colors.subtitle }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            {profile?.age}
          </Text>
        </View>

        {/* Segmented Tab Control */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["account", "reviews", "safety"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === "account" ? "Account" : tab === "reviews" ? "Reviews" : "Safety";
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  isActive && [styles.tabButtonActive, { backgroundColor: colors.accent }],
                ]}
                onPress={() => setActiveTab(tab)}
                accessible={true}
                accessibilityLabel={label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    { color: isActive ? colors.buttonText : colors.subtitle },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Account Section */}
        {activeTab === "account" && (
        <View style={styles.section}>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <View style={styles.cardRowContent}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Membership
                </Text>
                <Text style={[styles.cardText, { color: colors.subtitle }]}>
                  {userSummary?.isSubscribed ? "Premium" : "Standard"}
                </Text>
              </View>
              {!userSummary?.isSubscribed && (
                <TouchableOpacity
                  style={[styles.subscribeBtn, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    setPurchaseFeature("subscription");
                    setShowPurchaseModal(true);
                  }}
                  accessibilityLabel="Subscribe"
                  accessibilityRole="button"
                  accessibilityHint="Opens subscription options"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={[styles.subscribeText, { color: colors.buttonText }]}>
                    Upgrade
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              const pf = paymentFlags || {
                enablePayments: true,
                enableSearchTokens: true,
                enableUndoTokens: true,
                enableMessageReqTokens: true,
              };
              const uf = userFlags || {
                unlimitedSearch: false,
                unlimitedUndo: false,
                unlimitedMessageReq: false,
              };
              const hasSearch =
                !pf.enablePayments ||
                !pf.enableSearchTokens ||
                uf.unlimitedSearch ||
                (userSummary?.searchTokens ?? 0) > 0;

              if (!hasSearch) {
                setPurchaseFeature("search");
                setShowPurchaseModal(true);
                return;
              }

              setShowSearchConfirm(true);
            }}
            accessible={true}
            accessibilityLabel="Search"
            accessibilityRole="button"
            accessibilityHint="Opens search screen to look up users by name"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Search
            </Text>
            <Text
              style={[styles.cardText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {userSummary ? `${userSummary.searchTokens} searches remaining` : "Look up anyone by name."}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              const pf = paymentFlags || {
                enablePayments: true,
                enableSearchTokens: true,
                enableUndoTokens: true,
                enableMessageReqTokens: true,
              };
              const uf = userFlags || {
                unlimitedSearch: false,
                unlimitedUndo: false,
                unlimitedMessageReq: false,
              };
              const hasMessage =
                !pf.enablePayments ||
                !pf.enableMessageReqTokens ||
                uf.unlimitedMessageReq ||
                (userSummary?.messageTokens ?? 0) > 0;

              if (!hasMessage) {
                setPurchaseFeature("messageRequest");
                setShowPurchaseModal(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Message tokens"
            accessibilityHint="Purchase message request tokens when empty"
          >
            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Messages
            </Text>
            <Text
              style={[styles.cardText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {userSummary ? `${userSummary.messageTokens} message requests remaining` : "Start the conversation."}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              const pf = paymentFlags || {
                enablePayments: true,
                enableSearchTokens: true,
                enableUndoTokens: true,
                enableMessageReqTokens: true,
              };
              const uf = userFlags || {
                unlimitedSearch: false,
                unlimitedUndo: false,
                unlimitedMessageReq: false,
              };
              const hasUndo =
                !pf.enablePayments ||
                !pf.enableUndoTokens ||
                uf.unlimitedUndo ||
                (userSummary?.undoTokens ?? 0) > 0;

              if (!hasUndo) {
                setPurchaseFeature("undo");
                setShowPurchaseModal(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Undo tokens"
            accessibilityHint="Purchase undo tokens when empty"
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Undo
            </Text>
            <Text style={[styles.cardText, { color: colors.subtitle }]}>
              {userSummary ? `${userSummary.undoTokens} undos remaining` : "Go back to your last swipe."}
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Reviews Section */}
        {activeTab === "reviews" && (
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {reviewSummary && reviewSummary.count > 0 ? (
              <RatingGauge
                average={reviewSummary.average ?? 0}
                count={reviewSummary.count}
                best={reviewSummary.best ?? 10}
              />
            ) : (
              <Text style={[styles.cardText, { color: colors.subtitle }]}>
                You have no reviews yet.
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigateWithFade("ReviewsList")}
            accessible={true}
            accessibilityLabel="View all reviews"
            accessibilityRole="button"
            accessibilityHint="Opens list of all reviews"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              View All Reviews
            </Text>
            <Text
              style={[styles.cardText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              See all ratings and comments.
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Safety Section */}
        {activeTab === "safety" && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigateWithFade("Safety")}
            accessible={true}
            accessibilityLabel="Safety Center"
            accessibilityRole="button"
            accessibilityHint="Opens safety center with tips and tools"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Safety Center
            </Text>
            <Text
              style={[styles.cardText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Tips and tools for safer dating.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigateWithFade("BlockList")}
            accessible={true}
            accessibilityLabel="Blocked users"
            accessibilityRole="button"
            accessibilityHint="View and manage your blocked list"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.cardTitle, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Block List
            </Text>
            <Text
              style={[styles.cardText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              See who you've blocked and unblock if needed.
            </Text>
          </TouchableOpacity>
        </View>
        )}

        <TouchableOpacity
          onPress={() => navigateWithFade("EditProfile")}
          style={[styles.editProfileBtn, { backgroundColor: colors.accent, marginTop: 40 }]}
          accessible={true}
          accessibilityLabel="Edit profile"
          accessibilityRole="button"
          accessibilityHint="Opens profile editing screen"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.editProfileText, { color: colors.buttonText }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
        >
          Edit Profile
        </Text>
        </TouchableOpacity>

        <Modal
          transparent
          visible={showSearchConfirm}
          animationType="fade"
          onRequestClose={() => setShowSearchConfirm(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Use a search?</Text>
              <Text style={[styles.modalText, { color: colors.subtitle }]}>
                This will ask to open search. A token is only used when you run a search.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.background, borderColor: colors.subtitle + "33" }]}
                  onPress={() => setShowSearchConfirm(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    setShowSearchConfirm(false);
                    navigateWithFade("Search");
                  }}
                >
                  <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <PurchaseOptionsModal
          visible={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
          initialFeature={purchaseFeature}
          userSummary={userSummary}
          paymentFlags={paymentFlags}
          onPurchased={async () => {
            await refreshSessionData();
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  scrollContent: {
    paddingBottom: 140,
  },

  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 60,
  },
  settingsBtn: { 
    padding: 6,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsIcon: { width: 36, height: 36 },
  listIcon: { fontSize: 28, fontWeight: "700" },

  profileHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  photoBorder: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    overflow: "hidden",
  },
  profilePhoto: { width: "100%", height: "100%" },
  noPhoto: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  profileName: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 12,
  },
  profileAge: { fontSize: 18, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  modalText: {
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    fontSize: 15,
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
  },

  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardRowContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardText: { fontSize: 14, marginTop: 4 },

  subscribeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  subscribeText: {
    fontSize: 14,
    fontWeight: "700",
  },

  errorBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { fontSize: 14, marginBottom: 6 },
  retryBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  retryText: { fontSize: 14, fontWeight: "600" },

  editProfileBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  editProfileText: {
    fontSize: 16,
    fontWeight: "700",
  },

  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    // backgroundColor set dynamically
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});



