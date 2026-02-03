//********************************************************************
//
// ReviewsListScreen Component
//
// Displays a list of reviews received by the authenticated user.
// Fetches reviews from Zustand cache for instant UI and refreshes
// in background on mount. Each review shows rating gauge, reviewer
// name, comment preview, and date. Tapping a review navigates to
// ReviewDetailScreen. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the reviews list screen
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
// colors          Object                  Theme colors
// reviews         ReviewItem[]|null       Reviews from Zustand cache
// setReviews      function                 Zustand setter for reviews
// hasRefreshedRef boolean                 Flag to prevent multiple refreshes (ref)
// data            ReviewItem[]|null       Response from GET /reviews/me
// err             Error                   Error object if fetch fails
// timer           NodeJS.Timeout          Timeout ID for deferred refresh
// openDetail      function                Function to navigate to review detail
// reviewsList     ReviewItem[]            Reviews to display (from cache or empty)
// r               ReviewItem              Current review in map
// id              string                  Review ID for navigation
//
//*******************************************************************

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { apiGet } from "../../services/apiService";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { useAppCache } from "../../services/appCache";
import { AppImage } from "../../components/AppImage";
import { useAuth } from "../../context/AuthContext";
import { useChatThreads } from "../../hooks/useChatThreads";
import type { MatchThread } from "../../types/chat";

// -------------------------------------
// Incoming review item type
// -------------------------------------
interface ReviewItem {
  id: string;
  reviewerUid: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewerName?: string | null;
}

interface BackendMatch {
  matchId: string;
  userUid: string;
  profile: {
    name: string;
    photos: string[];
  } | null;
  createdAt: string;
  status: "active" | "restored" | "expired" | "archived";
  lastActivityAt: string;
  firstMessageAt?: string | null;
}

interface SentReview {
  id: string;
  reviewerUid: string;
  targetUid: string;
  rating: number;
  comment: string;
  createdAt: string | number;
  reviewerName?: string | null;
}

type ActiveThread = Extract<MatchThread, { status: "active" | "restored" }>;

// -------------------------------------
// Prerender support
// -------------------------------------
interface ReviewsListScreenProps {
  __prerender?: boolean;
  navigation?: any;
}

export default function ReviewsListScreen({
  navigation,
  __prerender,
}: ReviewsListScreenProps) {
  // theme must be initialized before early return
  const { colors } = useTheme();
  const { user, idToken } = useAuth();

  // GLOBAL CACHE
  const reviews = useAppCache((s) => s.reviews);
  const setReviews = useAppCache((s) => s.setReviews);
  const hasRefreshedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [matches, setMatches] = useState<BackendMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [sentReviews, setSentReviews] = useState<SentReview[]>([]);
  const [eligibleThreads, setEligibleThreads] = useState<ActiveThread[]>([]);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const { threads, loading: threadsLoading } = useChatThreads();

  const loadReviews = async () => {
    if (!idToken || !user) return;
    try {
      const data = await apiGet<ReviewItem[]>("/reviews/me", idToken);
      if (Array.isArray(data)) {
        setReviews(data);
        setError(null);
      } else {
        setError("Failed to load reviews.");
      }
    } catch (err) {
      console.error("Failed to refresh reviews:", err);
      setError("Failed to load reviews.");
    }
  };

  const loadMatches = async () => {
    if (!idToken || !user) return;
    setMatchesLoading(true);
    try {
      const data = await apiGet<BackendMatch[]>("/matches/me", idToken);
      if (Array.isArray(data)) {
        const sorted = [...data].sort(
          (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
        );
        setMatches(sorted);
      }
    } catch (err) {
      console.error("Failed to load matches for reviews screen:", err);
      setError("Failed to load matches.");
    } finally {
      setMatchesLoading(false);
    }
  };

  const computeEligibleThreads = useCallback(async () => {
    if (!user?.uid || !idToken) return;
    setEligibilityLoading(true);
    try {
      const actives = threads.filter(
        (t): t is ActiveThread => t.status === "active" || t.status === "restored"
      );
      const checks = await Promise.all(
        actives.map(async (t) => {
          try {
            const messages = await apiGet<any[]>(`/chat/messages/${t.threadId}`, idToken);
            if (!Array.isArray(messages)) return null;
            let mine = 0;
            let theirs = 0;
            for (const m of messages) {
              if (m.senderId === user.uid) mine++;
              else theirs++;
              if (mine >= 2 && theirs >= 2) return t;
            }
            return null;
          } catch (err) {
            console.error("Failed to evaluate thread for reviews:", err);
            return null;
          }
        })
      );
      setEligibleThreads(checks.filter(Boolean) as ActiveThread[]);
    } finally {
      setEligibilityLoading(false);
    }
  }, [idToken, threads, user?.uid]);

  const loadSentReviews = async () => {
    if (!user?.uid || !idToken) return;
    try {
      const data = await apiGet<SentReview[]>(`/reviews/sent/${user.uid}`, idToken);
      if (Array.isArray(data)) {
        setSentReviews(data);
      }
    } catch (err) {
      console.error("Failed to load sent reviews:", err);
    }
  };

  // BACKGROUND REFRESH (silent update, doesn't block UI)
  useEffect(() => {
    if (hasRefreshedRef.current) return;
    hasRefreshedRef.current = true;
    let cancelled = false;

    const hydrate = async () => {
      setInitialLoading(true);
      await Promise.all([loadReviews(), loadMatches(), loadSentReviews(), computeEligibleThreads()]);
      if (!cancelled) {
        setInitialLoading(false);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setReviews]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadReviews(), loadMatches(), loadSentReviews(), computeEligibleThreads()]);
    setRefreshing(false);
  };

  useEffect(() => {
    void computeEligibleThreads();
  }, [computeEligibleThreads]);

  // PRERENDER MODE: do NOT render UI, but DO run hooks/fetches
  if (__prerender) {
    return <View style={{ width: 1, height: 1, opacity: 0 }} />;
  }

  //********************************************************************
  //
  // openDetail Function
  //
  // Navigates to ReviewDetailScreen for the specified review ID.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // id    string    Review ID to view
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // None
  //
  //*******************************************************************
  // REAL USER MODE: data should already be cached - instant UI
  const reviewsList = reviews || [];
  const reviewMap = useMemo(() => {
    const map = new Map<string, ReviewItem>();
    reviewsList.forEach((r) => map.set(r.reviewerUid, r));
    return map;
  }, [reviewsList]);

  const sentMap = useMemo(() => {
    const map = new Map<string, SentReview>();
    sentReviews.forEach((r) => map.set(r.targetUid, r));
    return map;
  }, [sentReviews]);

  const eligibleMatches = useMemo<BackendMatch[]>(() => {
    return eligibleThreads.map((t) => ({
      matchId: t.matchId,
      userUid: t.user.uid,
      profile: {
        name: t.user.name,
        photos: [t.user.profileImageUrl].filter(Boolean) as string[],
      },
      createdAt: new Date(t.lastTimestamp ?? Date.now()).toISOString(),
      status: t.status === "restored" ? "restored" : "active",
      lastActivityAt: new Date(t.lastTimestamp ?? Date.now()).toISOString(),
      firstMessageAt: null,
    }));
  }, [eligibleThreads]);

  const usedMatches = eligibleMatches.length > 0 ? eligibleMatches : matches;

  const openDetail = (match: BackendMatch) => {
    const existing = reviewMap.get(match.userUid) ?? null;
    const reviewerName =
      existing?.reviewerName ?? existing?.reviewerUid ?? match.profile?.name ?? "Unknown";
    navigation.navigate("ReviewDetail", {
      targetUid: match.userUid,
      targetName: match.profile?.name ?? reviewerName,
      targetPhoto: match.profile?.photos?.[0] ?? null,
      reviewId: existing?.id ?? null,
      reviewerUid: existing?.reviewerUid,
      reviewerName,
      rating: existing?.rating,
      comment: existing?.comment,
      createdAt: existing?.createdAt,
    });
  };

  const showEmpty =
    usedMatches.length === 0 && !error && !initialLoading && !matchesLoading && !eligibilityLoading && !threadsLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <ScrollView 
        contentContainerStyle={styles.scrollWrap}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <View style={styles.heroRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { borderColor: colors.border }]}
            accessible={true}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            accessibilityHint="Returns to previous screen"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="chevron-back"
              size={26}
              color={colors.text}
              accessible={false}
              importantForAccessibility="no"
            />
          </TouchableOpacity>

          <View accessible={false} importantForAccessibility="no">
            <Text 
              style={[styles.headerTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Reviews
            </Text>
          </View>
        </View>

        {error && (
          <View style={[styles.errorBanner, { borderColor: colors.accent }]}>
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Retry loading reviews">
              <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {initialLoading && usedMatches.length === 0 ? (
          <View style={styles.centerWrap} accessible accessibilityRole="text">
            <ActivityIndicator size="large" color={colors.text} />
            <Text
              style={[styles.emptyText, { color: colors.subtitle, marginTop: 12 }]}
              allowFontScaling
            >
              Loading matches...
            </Text>
          </View>
        ) : showEmpty ? (
          <View 
            style={styles.centerWrap}
            accessible={true}
            accessibilityRole="text"
          >
            <Text 
              style={[styles.emptyText, { color: colors.subtitle }]}
              allowFontScaling={true}
            >
              You have no matches to review yet.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {usedMatches.map((m) => {
              const matchName = m.profile?.name ?? "Unknown";
              const photo = m.profile?.photos?.[0] ?? "https://via.placeholder.com/200";
              const existing = reviewMap.get(m.userUid) ?? null;
              const sent = sentMap.get(m.userUid) ?? null;
              const dateStr = new Date(m.lastActivityAt).toLocaleDateString();
              return (
                <TouchableOpacity
                  key={m.matchId}
                  style={[
                    styles.reviewCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => openDetail(m)}
                  accessible={true}
                  accessibilityLabel={`Match with ${matchName}. ${existing ? `Rating ${existing.rating} out of 10. ` : ""}Last active ${dateStr}.`}
                  accessibilityRole="button"
                  accessibilityHint="Opens sent and received review details"
                >
                  <AppImage
                    source={photo}
                    style={styles.matchImage}
                    accessibilityLabel={`Profile photo of ${matchName}`}
                    accessibilityRole="image"
                  />

                  <View
                    style={[styles.matchOverlay, { backgroundColor: "#FFFFFF" }]}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    <Text
                      style={[styles.matchName, { color: colors.buttonText, textShadowColor: colors.text + "BF" }]}
                      allowFontScaling={true}
                      numberOfLines={1}
                    >
                      {matchName}
                    </Text>
                  </View>

                  {existing ? (
                    <View 
                      style={[styles.ratingBadge, { backgroundColor: (colors.accent ?? colors.text) + "CC" }]}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      <Text style={[styles.ratingBadgeText, { color: colors.buttonText }]}>
                        {existing.rating.toFixed(1)}
                      </Text>
                      <Text style={[styles.ratingBadgeSuffix, { color: colors.buttonText }]}>
                        /10
                      </Text>
                    </View>
                  ) : sent ? (
                    <View 
                      style={[styles.sentBadge, { backgroundColor: (colors.accent ?? colors.text) + "CC" }]}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      <Text style={[styles.sentBadgeText, { color: colors.buttonText }]}>
                        Sent
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  heroRow: {
    paddingTop: 70,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  backButton: { 
    paddingHorizontal: 6,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  headerTitle: {
    fontSize: 32,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 160,
  },

  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },

  scrollWrap: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  errorBanner: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    marginBottom: 8,
  },
  retryText: { fontWeight: "700" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  reviewCard: {
    width: "48%",
    aspectRatio: 0.8,
    borderRadius: 14,
    padding: 0,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    position: "relative",
  },
  matchImage: {
    width: "100%",
    height: "100%",
  },
  matchOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewer: {
    fontSize: 18,
    fontWeight: "600",
  },

  matchName: {
    fontSize: 18,
    fontWeight: "700",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    textAlign: "center",
  },
  matchMeta: {
    fontSize: 12,
    opacity: 0.9,
    marginTop: 4,
  },

  ratingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingBadgeText: {
    fontSize: 16,
    fontWeight: "700",
  },
  ratingBadgeSuffix: {
    fontSize: 12,
    fontWeight: "600",
  },
  sentBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sentBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },

  date: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.9,
  },
});
