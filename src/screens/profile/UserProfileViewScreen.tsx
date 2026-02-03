//********************************************************************
//
// UserProfileViewScreen Component
//
// Displays a full-screen modal view of a user's profile with animated
// entrance/exit. Shows photo grid (Hinge-style layout), name, age,
// dating preference, rating gauge, bio, and interests. Animates from
// card scale (0.88) to enlarged view (0.95) on mount. Supports prerender
// mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the profile view modal
//
// Value Parameters
// ----------------
// route        any         Route params containing userId
// navigation   any         Navigation object for routing
// __prerender  boolean     Flag for prerendering (returns null if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// userId        string              User ID from route params
// colors        Object              Theme colors
// profile       ProfileView|null   User profile data
// summary       ReviewSummary|null Review summary data
// loading       boolean             Loading state
// notFound      boolean             Whether profile was not found
// loadingRef    boolean             Flag to prevent duplicate requests (ref)
// scaleAnim     Animated.Value      Scale animation value
// opacityAnim   Animated.Value      Opacity animation value
// p             ProfileView|null   Response from /profiles endpoint
// r             ReviewSummary|null Response from /reviews/summary endpoint
// err           Error               Error object if request fails
// url           string              Photo URL in map
// i             number              Photo index in map
// int           string              Interest string in map
// idx           number              Interest index in map
//
//*******************************************************************

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { apiGet, apiDelete, apiPost } from "../../services/apiService";
import { RatingGauge } from "../reviews/RatingGauge";
import { useTheme } from "../../context/ThemeProvider";
import { useAuth } from "../../context/AuthContext";
import { getDatingPreferenceLabel } from "../../utils/datingPreference";
import { AppImage } from "../../components/AppImage";
import { useGlobalRefresh } from "../../context/RefreshContext";
import {
  buildCardPalette,
  ensureContrastingColor,
  isDarkColor,
} from "../../utils/cardPalette";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ProfileView {
  uid?: string;
  userUid?: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  photos: string[];
  profileImageUrl?: string;
  distance?: number;
  datingPreference?: 
    | "hookups"
    | "situationship"
    | "short_term_relationship"
    | "short_term_open"
    | "long_term_open"
    | "long_term_relationship";
  school?: string | null;
  showSchoolInfo?: boolean;
  major?: string | null;
  gradYear?: number | string | null;
}

interface ReviewSummary {
  average: number | null;
  count: number;
}

const { width } = Dimensions.get("window");

interface UserProfileViewProps {
  route?: any;
  navigation?: any;
  __prerender?: boolean;
}

export default function UserProfileViewScreen({
  route,
  navigation,
  __prerender,
}: UserProfileViewProps) {
  if (__prerender) return null;

  const { userId, fromSwipeCard, previewData, matchId, targetName, fromChat, fromBlockList, fromReview } = route.params || {};
  const { colors } = useTheme();
  const { idToken, user } = useAuth();
  const { refresh, refreshing, registerRefresher } = useGlobalRefresh();
  const insets = useSafeAreaInsets();
  const isDarkBackground = useMemo(
    () => isDarkColor(colors.background),
    [colors.background],
  );
  const cardPalette = useMemo(
    () => buildCardPalette(colors.background),
    [colors.background],
  );
  const schoolColor = ensureContrastingColor(
    (colors.accent as string | undefined) ||
      (isDarkBackground ? "#8aa0ff" : "#2d4cff"),
    cardPalette.surface,
    cardPalette.text,
  );
  const backArrowColor = isDarkColor(colors.background) ? "#FFFFFF" : "#111111";

  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unmatching, setUnmatching] = useState(false);
  const [confirmUnmatchVisible, setConfirmUnmatchVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);
  // Start fully visible; navigation handles the outer transition.
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const loadProfile = useCallback(async (opts?: { silent?: boolean }) => {
    if (!userId || previewData) return;
    if (loadingRef.current) return;
    if (!idToken) {
      setError("Missing auth token.");
      setNotFound(true);
      setLoading(false);
      return;
    }
    const silent = opts?.silent;
    
    loadingRef.current = true;
    const currentRequestId = ++requestIdRef.current;
    if (!silent) {
      setLoading(true);
    }
    setNotFound(false);
    setError(null);
    
    let loadedProfile: ProfileView | null = null;
    let loadedSummary: ReviewSummary | null = null;

    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const p = await apiGet<ProfileView>(`/profiles/${userId}`, idToken);
        // Use summary endpoint to get both average and count
        const r = await apiGet<{ average: number | null; count: number }>(
          `/reviews/user/${userId}/summary`,
          idToken,
        );

        if (p) {
          // Normalize photos to remove empties and fall back to profileImageUrl
          const photos = Array.isArray(p.photos)
            ? p.photos.filter((ph) => typeof ph === "string" && ph.trim().length > 0)
            : [];
          loadedProfile = {
            ...p,
            photos: photos.length > 0 && p.profileImageUrl
              ? [p.profileImageUrl, ...photos.filter((ph) => ph !== p.profileImageUrl)]
              : photos.length > 0
              ? photos
              : p.profileImageUrl
              ? [p.profileImageUrl]
              : [],
          };
          loadedSummary = r && r.average !== null && r.average !== undefined 
            ? { average: r.average, count: r.count } 
            : null;
          break;
        }

        await sleep(250 * (attempt + 1));
      }

      if (loadedProfile) {
        // Discard if a newer request was started
        if (currentRequestId === requestIdRef.current) {
          setProfile(loadedProfile);
          setSummary(loadedSummary);
          setNotFound(false);
        }
      } else {
        setError("Unable to load this profile right now. Check your connection and try again.");
        setNotFound(true);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      setError("Unable to load this profile right now. Check your connection and try again.");
      setNotFound(true);
    } finally {
      if (!silent) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [userId, previewData, idToken]);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const firstName = useMemo(
    () => (profile?.name ? profile.name.split(" ")[0] : ""),
    [profile?.name],
  );
  const isViewingSelf = useMemo(() => {
    const targetUid = (profile as any)?.userUid || (profile as any)?.uid || userId;
    return user?.uid && targetUid === user.uid;
  }, [profile, user?.uid, userId]);

  useEffect(() => {
    // Reset state on user change to avoid stale flashes
    setProfile(null);
    setSummary(null);
    setNotFound(false);
    setError(null);
    requestIdRef.current += 1;
    // If preview data is provided, use it directly (no API call)
    if (previewData) {
      setProfile(previewData as ProfileView);
      setSummary(null); // No review summary for preview
      setLoading(false);
      setNotFound(false);
      return;
    }

    loadProfile();
  }, [userId, previewData, loadProfile]);

  useEffect(() => {
    return registerRefresher(loadProfile);
  }, [loadProfile, registerRefresher]);

  useFocusEffect(() => {
    // Keep intro static; navigation transition handles appearance.
    scaleAnim.setValue(1);
    opacityAnim.setValue(1);
    return () => {};
  });

  const handleConfirmUnmatch = async () => {
    if (!matchId || !idToken) return;
    
    setConfirmUnmatchVisible(false);
    
    try {
      setUnmatching(true);
      await apiDelete(`/matches/${matchId}`, idToken);
      // Animate card close before navigating
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (fromChat) {
          navigation.navigate("Messages");
        } else {
          navigation.goBack();
        }
      });
    } finally {
      setUnmatching(false);
    }
  };

  const handleCancelUnmatch = () => {
    setConfirmUnmatchVisible(false);
  };

  if (loading) {
    return (
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: opacityAnim,
              backgroundColor: colors.background + "CC", // 80% opacity
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={() => navigation?.goBack()}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [{ scale: scaleAnim }],
              backgroundColor: cardPalette.surface,
              shadowColor: cardPalette.text,
            },
            styles.loadingCard,
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <TouchableOpacity
              style={styles.backArrowButton}
              onPress={() => {
                Animated.parallel([
                  Animated.timing(scaleAnim, {
                    toValue: 0.88,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  navigation?.goBack();
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessible={true}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              accessibilityHint="Closes profile view and returns to previous screen"
            >
              <Ionicons

                name="chevron-back"

                size={30}

                color={backArrowColor}

                accessible={false}

                importantForAccessibility="no"

               />
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </View>
    );
  }

  if (notFound || !profile) {
    return (
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: opacityAnim,
              backgroundColor: colors.background + "CC", // 80% opacity
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={() => navigation?.goBack()}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [{ scale: scaleAnim }],
              backgroundColor: cardPalette.surface,
              shadowColor: cardPalette.text,
            },
            styles.loadingCard,
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <TouchableOpacity
              style={styles.backArrowButton}
              onPress={() => {
                Animated.parallel([
                  Animated.timing(scaleAnim, {
                    toValue: 0.88,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                ]).start(() => {
                  navigation?.goBack();
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessible={true}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              accessibilityHint="Closes profile view and returns to previous screen"
            >
              <Ionicons

                name="chevron-back"

                size={30}

                color={backArrowColor}

                accessible={false}

                importantForAccessibility="no"

               />
            </TouchableOpacity>
          </SafeAreaView>
          <View 
            style={styles.loadingContainer}
            accessible={true}
            accessibilityRole="alert"
          >
            <Text 
              style={[styles.errorText, { color: cardPalette.text }]}
              accessible={true}
              accessibilityLabel="Profile not found"
              allowFontScaling={true}
            >
              {error ?? "Profile not found"}
            </Text>
            {error && (
              <TouchableOpacity
                onPress={refresh}
                style={[styles.retryButton, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Retry loading profile"
              >
                <Text style={[styles.retryText, { color: colors.buttonText }]}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.modalContainer}>
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: opacityAnim,
            backgroundColor: colors.background + "CC", // 80% opacity
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backdropTouchable}
          activeOpacity={1}
          onPress={() => {
            Animated.parallel([
              Animated.timing(scaleAnim, {
                toValue: 0.88,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start(() => {
              navigation?.goBack();
            });
          }}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: cardPalette.surface,
            shadowColor: cardPalette.text,
            borderColor: cardPalette.border,
            borderWidth: 2,
          },
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backArrowButton}
              onPress={() => navigation?.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessible={true}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              accessibilityHint="Closes profile view and returns to previous screen"
            >
              <Ionicons
                name="chevron-back"
                size={30}
                color={backArrowColor}
                accessible={false}
                importantForAccessibility="no"
              />
            </TouchableOpacity>

            {!isViewingSelf && !fromBlockList && !fromReview && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setShowMenu(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="More options"
                accessibilityHint="Opens actions to block, report, or view safety resources"
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={22}
                  color="#0b1720"
                  accessible={false}
                  importantForAccessibility="no"
                />
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          style={styles.cardScroll}
          contentContainerStyle={styles.cardContent}
          accessible={false}
          importantForAccessibility="no"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent ?? colors.text}
              colors={[colors.accent ?? colors.text]}
            />
          }
        >
          {/* Horizontal scrollable photo gallery */}
          {profile.photos.length > 0 && (
            <View 
              style={styles.photoSection}
              accessible={true}
              accessibilityLabel={`${profile.photos.length} photo${profile.photos.length > 1 ? 's' : ''} of ${profile.name.split(" ")[0]}`}
              accessibilityRole="image"
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={true}
                style={styles.photoGallery}
                contentContainerStyle={styles.photoGalleryContent}
                snapToInterval={width * 0.95}
                decelerationRate="fast"
                accessible={false}
                importantForAccessibility="no"
              >
                {profile.photos.map((url, i) => (
                  <View 
                    key={i} 
                    style={[styles.photoSlide, { backgroundColor: cardPalette.surface }]}
                    accessible={true}
                    accessibilityLabel={`Photo ${i + 1} of ${profile.photos.length} of ${profile.name.split(" ")[0]}`}
                    accessibilityRole="image"
                  >
                    <AppImage 
                      source={url} 
                      style={[styles.photoSlideImage, { backgroundColor: cardPalette.surface }]}
                      accessibilityRole="none"
                      priority="normal"
                    />
                  </View>
                ))}
              </ScrollView>
              
              {/* Photo indicator dots */}
              {profile.photos.length > 1 && (
                <View 
                  style={styles.photoIndicator}
                  accessible={true}
                  accessibilityLabel={`Photo ${profile.photos.length > 1 ? '1' : ''} of ${profile.photos.length}`}
                  accessibilityRole="adjustable"
                >
                  {profile.photos.map((_, i) => (
                    <View 
                      key={i} 
                      style={[styles.photoDot, { backgroundColor: cardPalette.muted }]}
                      accessible={false}
                      importantForAccessibility="no"
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          <View 
            style={styles.info}
            accessible={false}
            importantForAccessibility="no"
          >
          {profile.school && profile.showSchoolInfo ? (
            <View
              style={[
                styles.schoolCard,
                {
                  backgroundColor: schoolColor + "1A",
                    borderColor: schoolColor,
                  },
                ]}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`School: ${profile.school}${profile.major ? `, ${profile.major}` : ""}${profile.gradYear ? `, class of ${profile.gradYear}` : ""}`}
              >
                <Text style={[styles.schoolName, { color: schoolColor }]} allowFontScaling={true} numberOfLines={1}>
                  {profile.school}
                </Text>
                {(profile.major || profile.gradYear) && (
                  <Text
                    style={[styles.schoolSub, { color: cardPalette.subtitle }]}
                    allowFontScaling={true}
                    numberOfLines={1}
                  >
                    {[profile.major, profile.gradYear ? `Class of ${profile.gradYear}` : null]
                      .filter(Boolean)
                      .join(" • ")}
                  </Text>
                )}
              </View>
            ) : null}

            <View 
              style={styles.nameRow}
              accessible={true}
              accessibilityLabel={`${profile.name.split(" ")[0]}, age ${profile.age}${profile.distance !== undefined ? `, ${profile.distance} miles away` : ''}`}
              accessibilityRole="header"
            >
              <Text 
                style={[styles.name, { color: cardPalette.text }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                {profile.name.split(" ")[0]}
              </Text>
              <Text 
                style={[styles.age, { color: cardPalette.subtitle }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                {profile.age}
              </Text>
              {profile.distance !== undefined && (
                <Text 
                  style={[styles.distance, { color: cardPalette.subtitle }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {" • "}{profile.distance} mi
                </Text>
              )}
            </View>

            {summary && summary.count > 0 ? (
              <View 
                style={styles.ratingContainer}
                accessible={true}
                accessibilityLabel={`Rating: ${summary.average} out of 10, based on ${summary.count} review${summary.count > 1 ? 's' : ''}`}
                accessibilityRole="text"
              >
                <RatingGauge
                  average={summary.average ?? 0}
                  count={summary.count}
                  best={10}
                  colorsOverride={{
                    text: cardPalette.text,
                    subtitle: cardPalette.subtitle,
                    textSecondary: cardPalette.subtitle,
                    accent: cardPalette.gaugeAccent,
                    border: cardPalette.gaugeTrack,
                  }}
                />
              </View>
            ) : null}

            {profile.datingPreference && (
              <View 
                style={[styles.prefPill, { backgroundColor: cardPalette.pill }]}
                accessible={true}
                accessibilityRole="text"
                accessibilityLabel={`Dating preference: ${getDatingPreferenceLabel(profile.datingPreference, profile.age)}`}
              >
                <Text 
                  style={[styles.prefText, { color: cardPalette.pillText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {getDatingPreferenceLabel(profile.datingPreference, profile.age)}
                </Text>
              </View>
            )}

            {profile.bio ? (
              <Text 
                style={[styles.bio, { color: cardPalette.text }]}
                accessible={true}
                accessibilityRole="text"
                allowFontScaling={true}
              >
                {profile.bio}
              </Text>
            ) : null}

            {profile.interests.length > 0 && (
              <View 
                style={styles.interestsWrap}
                accessible={true}
                accessibilityLabel={`Interests: ${profile.interests.join(', ')}`}
                accessibilityRole="text"
              >
                {profile.interests.map((int, idx) => (
                  <View 
                    key={idx} 
                    style={[styles.interestTag, { backgroundColor: cardPalette.pill }]}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    <Text 
                      style={[styles.interestText, { color: cardPalette.text }]}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      {int}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 20 }} />
          </View>

          {/* Buttons for matches - inside ScrollView, positioned at bottom */}
          {matchId && (
            <View style={[styles.matchButtonsContainer, { paddingBottom: 5 + Math.max(insets.bottom, 0) }]}>
              {!fromChat && (
                <TouchableOpacity
                  style={[styles.messageButton, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    navigation.navigate("Chat", {
                      matchId,
                      targetId: userId,
                      targetName: targetName || profile?.name,
                    });
                  }}
                  accessible={true}
                  accessibilityLabel="Send message"
                  accessibilityRole="button"
                  accessibilityHint="Opens chat with this match"
                >
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={20}
                    color={colors.buttonText}
                    style={{ marginRight: 8 }}
                    accessible={false}
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[styles.messageButtonText, { color: colors.buttonText }]}
                    allowFontScaling={true}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    Message
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.unmatchButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  setConfirmUnmatchVisible(true);
                }}
                disabled={unmatching}
                accessible={true}
                accessibilityLabel="Unmatch"
                accessibilityRole="button"
                accessibilityHint="Ends this match and returns to previous screen"
              >
                <Text
                  style={[styles.unmatchButtonText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {unmatching ? "..." : "Unmatch"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      <Modal
        transparent
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setShowMenu(false)}
          accessible={false}
          importantForAccessibility="no"
        >
            <View style={[styles.menuBox, { backgroundColor: colors.card }]}>
              {(() => {
                const targetUid = profile?.userUid || (profile as any)?.uid || userId;
                return (
                  <>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        const target = targetUid;
                        if (!idToken || !target) {
                          Alert.alert("Error", "You must be logged in to block a user.");
                          return;
                        }
                        Alert.alert(
                          "Block user?",
                          `You won't see ${firstName || "this user"} anymore.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Block",
                              style: "destructive",
                              onPress: async () => {
                                setBlocking(true);
                                try {
                                  await apiPost(`/blocks/${target}`, {}, idToken);
                                  Alert.alert("Blocked", `${firstName || "User"} has been blocked.`);
                                  setShowMenu(false);
                                  navigation?.navigate("Swipe", { refreshQueue: true });
                                } catch (err: any) {
                                  Alert.alert("Error", err?.message || "Failed to block user.");
                                } finally {
                                  setBlocking(false);
                                }
                              },
                            },
                          ],
                        );
                      }}
                      disabled={blocking}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="Block user"
                    >
                      <Ionicons name="ban" size={20} color={colors.text} style={styles.menuIcon} />
                      <Text style={[styles.menuText, { color: colors.text }]}>Block</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        const target = targetUid;
                    if (!idToken || !target) {
                      Alert.alert("Error", "You must be logged in to report a user.");
                      return;
                    }
                    setShowMenu(false);
                    navigation?.navigate("ReviewWrite", { targetId: target, forceReport: true });
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Report user"
                >
                      <Ionicons name="flag-outline" size={20} color={colors.text} style={styles.menuIcon} />
                      <Text style={[styles.menuText, { color: colors.text }]}>Report</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  navigation?.navigate("Safety");
                }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Safety resources"
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuText, { color: colors.text }]}>Safety</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setShowMenu(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.menuText, { color: colors.subtitle }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Unmatch Confirmation Modal */}
      <Modal
        visible={confirmUnmatchVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelUnmatch}
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View
          style={styles.unmatchModalOverlay}
          accessible={false}
          importantForAccessibility="no"
        >
          <View
            style={[styles.unmatchModalBox, { backgroundColor: colors.card }]}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text
              style={[styles.unmatchModalTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Unmatch?
            </Text>
            <Text
              style={[styles.unmatchModalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              This will remove the match and its chat.
            </Text>

            <View
              style={styles.unmatchModalButtonsRow}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={[
                  styles.unmatchModalButton,
                  styles.unmatchModalCancelButton,
                  { backgroundColor: colors.card, borderColor: colors.subtitle },
                ]}
                onPress={handleCancelUnmatch}
                accessible={true}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                accessibilityHint="Cancels the unmatch action"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.unmatchModalCancelText, { color: colors.subtitle }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.unmatchModalButton,
                  styles.unmatchModalConfirmButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleConfirmUnmatch}
                accessible={true}
                accessibilityLabel="Unmatch"
                accessibilityRole="button"
                accessibilityHint="Confirms unmatching with this person"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.unmatchModalConfirmText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Unmatch
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  backdropTouchable: {
    flex: 1,
  },

  cardContainer: {
    position: "absolute",
    width: width * 0.9,
    height: "82%",
    borderRadius: 20,
    overflow: "hidden",
    top: "9%",
    left: width * 0.05,
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    borderWidth: 0,
    flexDirection: "column",
  },

  safeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  backArrowButton: {
    alignSelf: "flex-start",
    padding: 8,
    zIndex: 101,
    marginLeft: -20,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  backArrow: {
    fontSize: 32,
    fontWeight: "600",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  cardScroll: {
    flex: 1,
  },

  cardContent: {
    flexGrow: 1,
    paddingBottom: 0,
  },

  photoSection: {
    width: "100%",
    marginBottom: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  photoGallery: {
    width: "100%",
    height: width * 1.05,
  },

  photoGalleryContent: {
    alignItems: "center",
  },

  photoSlide: {
    width: width * 0.9,
    height: width * 1.05,
    justifyContent: "center",
    alignItems: "center",
  },

  photoSlideImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  photoIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },

  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  info: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 0,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 0,
  },
  schoolCard: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  schoolName: {
    fontSize: 16,
    fontWeight: "800",
  },
  schoolSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },

  name: {
    fontSize: 30,
    fontWeight: "700",
  },

  age: {
    marginLeft: 6,
    fontSize: 26,
    paddingBottom: 1.5,
  },

  distance: {
    marginLeft: 6,
    fontSize: 18,
    paddingBottom: 4,
  },

  prefPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 12,
  },

  prefText: {
    fontSize: 15,
    fontWeight: "700",
  },

  ratingContainer: {
    marginBottom: 12,
  },

  bio: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 16,
  },

  interestsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },

  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },

  interestText: {
    fontSize: 14,
  },

  loadingCard: {
    justifyContent: "center",
    alignItems: "center",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },

  buttonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },

  matchButtonsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 5,
    gap: 10,
  },

  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  messageButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  unmatchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  unmatchButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },

  errorText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  unmatchModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  unmatchModalBox: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  unmatchModalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  unmatchModalMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  unmatchModalButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  unmatchModalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },
  unmatchModalCancelButton: {
    borderWidth: 1,
  },
  unmatchModalConfirmButton: {
    // Uses colors.accent from inline style
  },
  unmatchModalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  unmatchModalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 4,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#00a2aa9d",
    marginRight: -12,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  menuBox: {
    borderRadius: 12,
    padding: 8,
    minWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
