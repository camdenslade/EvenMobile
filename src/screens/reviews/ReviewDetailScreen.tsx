//********************************************************************
//
// ReviewDetailScreen Component
//
// Shows a match's reviews in two stacked cards: the review you sent
// (if any) and the review you received. Pulls cached review data for
// instant display, refreshes from the API, and lets the user report
// the received review.
//
//********************************************************************

import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";

import { RootStackParamList } from "../../../App";
import { apiGet } from "../../services/apiService";
import { RatingGauge } from "./RatingGauge";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { AppImage } from "../../components/AppImage";
import { useAuth } from "../../context/AuthContext";
import { useAppCache } from "../../services/appCache";

const DEFAULT_AVATAR = require("../../../assets/default-avatar.jpg");

type ReviewDetailRouteProp = RouteProp<RootStackParamList, "ReviewDetail">;
type ReviewDetailNavProp = NativeStackNavigationProp<RootStackParamList, "ReviewDetail">;

interface ReviewDetail {
  id: string;
  rating: number; // Numerical score (0-10)
  comment: string;
  createdAt: number | string;
  reviewer: {
    uid: string;
    name: string;
    photoUrl: string | null;
  };
  targetUid?: string | null;
}

interface SentReview {
  id: string;
  reviewerUid: string;
  targetUid: string;
  rating: number;
  comment: string;
  createdAt: number | string;
  reviewerName?: string | null;
}

interface ReceivedReview {
  id: string;
  reviewerUid: string;
  targetUid: string;
  rating: number;
  comment: string;
  createdAt: number | string;
  reviewerName?: string | null;
}

interface CachedReview {
  id: string;
  reviewerUid: string;
  rating: number;
  comment: string;
  createdAt: number | string;
  reviewerName?: string | null;
  targetUid?: string | null;
}

export default function ReviewDetailScreen({
  route,
  navigation,
}: {
  route: ReviewDetailRouteProp;
  navigation: ReviewDetailNavProp;
}) {
  const {
    targetUid,
    targetName,
    targetPhoto,
    reviewId,
    reviewerUid: routeReviewerUid,
    reviewerName: routeReviewerName,
    rating: routeRating,
    comment: routeComment,
    createdAt: routeCreatedAt,
  } = route.params;

  const { colors } = useTheme();
  const { user, idToken } = useAuth();
  const cachedReviews = useAppCache((s) => s.reviews as CachedReview[] | null);

  const cachedReceived = useMemo<ReviewDetail | null>(() => {
    const found = cachedReviews?.find((r) => r.reviewerUid === targetUid) ?? null;
    if (!found) return null;
    return {
      id: found.id,
      rating: found.rating,
      comment: found.comment,
      createdAt: found.createdAt,
      reviewer: {
        uid: found.reviewerUid,
        name: found.reviewerName ?? found.reviewerUid,
        photoUrl: targetPhoto ?? null,
      },
      targetUid: found.targetUid,
    };
  }, [cachedReviews, targetUid, targetPhoto]);

  const routeReceivedPrefill = useMemo<ReviewDetail | null>(() => {
    if (!routeReviewerUid || routeReviewerUid !== targetUid) return null;
    return {
      id: reviewId ?? "",
      rating: routeRating ?? 0,
      comment: routeComment ?? "No written comment provided.",
      createdAt: routeCreatedAt ?? Date.now(),
      reviewer: {
        uid: routeReviewerUid,
        name: routeReviewerName ?? routeReviewerUid,
        photoUrl: targetPhoto ?? null,
      },
      targetUid,
    };
  }, [routeReviewerUid, targetUid, reviewId, routeRating, routeComment, routeCreatedAt, routeReviewerName, targetPhoto]);

  const [receivedReview, setReceivedReview] = useState<ReviewDetail | null>(
    cachedReceived ?? routeReceivedPrefill
  );
  const [sentReview, setSentReview] = useState<SentReview | null>(null);
  const [loading, setLoading] = useState(!(cachedReceived || routeReceivedPrefill));
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!receivedReview && (cachedReceived || routeReceivedPrefill)) {
      setReceivedReview(cachedReceived ?? routeReceivedPrefill ?? null);
    }
  }, [cachedReceived, routeReceivedPrefill, receivedReview]);

  useEffect(() => {
    if (!user?.uid || !targetUid || !idToken) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchAll = async () => {
      setError(null);
      setLoading(true);
      try {
        const [receivedList, sentList] = await Promise.all([
          apiGet<ReceivedReview[]>("/reviews/me", idToken),
          apiGet<SentReview[]>(`/reviews/sent/${user.uid}`, idToken),
        ]);
        if (cancelled) return;
        if (Array.isArray(receivedList)) {
          const rec = receivedList.find((r) => r.reviewerUid === targetUid) ?? null;
          if (rec) {
            setReceivedReview({
              id: rec.id,
              rating: rec.rating,
              comment: rec.comment,
              createdAt: rec.createdAt,
              reviewer: {
                uid: rec.reviewerUid,
                name: rec.reviewerName ?? targetName ?? rec.reviewerUid,
                photoUrl: targetPhoto ?? null,
              },
              targetUid: rec.targetUid,
            });
          } else {
            setReceivedReview(null);
          }
        }
        if (Array.isArray(sentList)) {
          const mine = sentList.find((r) => r.targetUid === targetUid) ?? null;
          setSentReview(mine);
        }
      } catch (err) {
        console.error("Failed to load reviews:", err);
        setError("Failed to load reviews.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [idToken, user?.uid, targetUid, targetName, targetPhoto, refreshToken]);

  const counterpartName =
    receivedReview?.reviewer.name ?? targetName ?? routeReviewerName ?? "Match";
  const receivedDate = receivedReview
    ? new Date(receivedReview.createdAt).toLocaleDateString()
    : null;
  const sentDate = sentReview
    ? new Date(sentReview.createdAt).toLocaleDateString()
    : null;
  const hasReceived = !!receivedReview;
  const receivedDateLabel = receivedDate ?? "Date unavailable";

  if (!receivedReview && loading) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
        accessible={true}
        accessibilityLabel="Loading review"
        accessibilityRole="alert"
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!receivedReview && error) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
        accessible={true}
        accessibilityLabel="Error loading review"
        accessibilityRole="alert"
      >
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity
          onPress={() => setRefreshToken((v) => v + 1)}
          style={[styles.retryBtn, { borderColor: colors.subtitle }]}
          accessibilityRole="button"
          accessibilityLabel="Retry loading review"
        >
          <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollWrap}
      showsVerticalScrollIndicator={false}
      accessible={false}
      importantForAccessibility="no"
    >
      <GlobalBackground />

      <View style={styles.topBar}>
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

        <View style={{ flex: 1 }} accessible={false} importantForAccessibility="no">
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            accessible={true}
            accessibilityRole="header"
            allowFontScaling={true}
          >
            {counterpartName}
          </Text>
        </View>

        {loading && (
          <ActivityIndicator size="small" color={colors.subtitle} style={styles.inlineSpinner} />
        )}
      </View>

      {error && receivedReview && (
        <View style={[styles.errorBanner, { borderColor: colors.accent }]}>
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            onPress={() => setRefreshToken((v) => v + 1)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading review"
          >
            <Text style={[styles.retryText, { color: colors.text }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Sent review</Text>
          {sentReview && (
            <View
              style={[
                styles.ratingChip,
                { backgroundColor: (colors.accent ?? colors.text) + "1A" },
              ]}
            >
              <Text style={[styles.ratingChipText, { color: colors.text }]}>
                {sentReview.rating.toFixed(1)}
              </Text>
              <Text style={[styles.ratingChipSuffix, { color: colors.subtitle }]}>/10</Text>
            </View>
          )}
        </View>

        {sentReview ? (
          <>
            <Text style={[styles.meta, { color: colors.subtitle }]}>
              {sentDate ?? "Date unavailable"}
            </Text>

            <View style={styles.gaugeRow}>
              <RatingGauge average={sentReview.rating} count={1} best={10} compact />
              <View style={styles.gaugeTextBlock}>
                <Text style={[styles.meta, { color: colors.subtitle }]}>You rated:</Text>
                <Text style={[styles.bigNumber, { color: colors.text }]}>
                  {sentReview.rating.toFixed(1)}
                </Text>
              </View>
            </View>

            <Text
              style={[styles.comment, { color: colors.text }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              {sentReview.comment || "No written comment provided."}
            </Text>
          </>
        ) : (
          <Text
            style={[styles.placeholderText, { color: colors.subtitle }]}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            You haven't sent a review to {counterpartName} yet.
          </Text>
        )}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Received review</Text>
          {hasReceived && (
            <View
              style={[
                styles.ratingChip,
                { backgroundColor: (colors.accent ?? colors.text) + "1A" },
              ]}
            >
              <Text style={[styles.ratingChipText, { color: colors.text }]}>
                {receivedReview.rating.toFixed(1)}
              </Text>
              <Text style={[styles.ratingChipSuffix, { color: colors.subtitle }]}>/10</Text>
            </View>
          )}
        </View>

        <View
          style={styles.reviewerRow}
          accessible={true}
          accessibilityLabel={`Review by ${counterpartName}, posted on ${receivedDateLabel}`}
          accessibilityRole="text"
        >
          <AppImage
            source={receivedReview?.reviewer.photoUrl ?? targetPhoto ?? DEFAULT_AVATAR}
            style={styles.avatar}
            accessibilityLabel={`Profile photo of ${counterpartName}`}
            accessibilityRole="image"
          />

          <View accessible={false} importantForAccessibility="no">
            <Text
              style={[styles.reviewerName, { color: colors.text }]}
              allowFontScaling={true}
            >
              {counterpartName}
            </Text>
            <Text
              style={[styles.meta, { color: colors.subtitle }]}
              allowFontScaling={true}
            >
              {receivedDateLabel}
            </Text>
          </View>
        </View>

        {hasReceived && (
          <View style={styles.gaugeRow}>
            <RatingGauge average={receivedReview.rating} count={1} best={10} compact />
            <View style={styles.gaugeTextBlock}>
              <Text style={[styles.meta, { color: colors.subtitle }]}>Their rating</Text>
              <Text style={[styles.bigNumber, { color: colors.text }]}>
                {receivedReview.rating.toFixed(1)}
              </Text>
            </View>
          </View>
        )}

        <Text
          style={[styles.comment, { color: colors.text }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          {hasReceived
            ? receivedReview?.comment || "No written comment provided."
            : `You haven't received a review from ${counterpartName} yet.`}
        </Text>

        {hasReceived && (
          <TouchableOpacity
            style={[
              styles.reportBtn,
              {
                borderColor: colors.accent,
                backgroundColor:
                  colors.background === "#222222"
                    ? "rgba(255,255,255,0.08)"
                    : colors.card,
              },
            ]}
            accessible={true}
            accessibilityLabel="Report review"
            accessibilityRole="button"
            accessibilityHint="Reports this review for inappropriate content"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() =>
              Alert.alert(
                "Report Review",
                "Reporting this review will send it to our moderation team.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Report", style: "destructive" },
                ]
              )
            }
          >
            <Text
              style={[styles.reportText, { color: colors.accent }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Report Review
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollWrap: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  errorText: {
    marginBottom: 12,
    textAlign: "center",
  },
  retryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  retryText: { fontWeight: "700" },

  topBar: {
    paddingTop: 70,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
  },
  inlineSpinner: {
    marginLeft: 8,
  },

  errorBanner: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ratingChipText: {
    fontSize: 16,
    fontWeight: "700",
  },
  ratingChipSuffix: {
    fontSize: 13,
    fontWeight: "600",
  },

  reviewerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },

  reviewerName: {
    fontSize: 20,
    fontWeight: "700",
  },

  meta: {
    fontSize: 13,
  },

  gaugeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  gaugeTextBlock: {
    justifyContent: "center",
  },
  bigNumber: {
    fontSize: 22,
    fontWeight: "700",
  },

  comment: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 6,
  },
  placeholderText: {
    fontSize: 15,
    lineHeight: 20,
  },

  reportBtn: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    borderRadius: 14,
  },

  reportText: {
    fontSize: 17,
    fontWeight: "700",
  },
});
