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
  Modal,
  TextInput,
} from "react-native";
import { RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";

import { RootStackParamList } from "../../../App";
import { apiGet, apiPost } from "../../services/apiService";
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

  // Appeal state
  const [appealVisible, setAppealVisible] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealPhotos, setAppealPhotos] = useState<string[]>([]);
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  const handlePickAppealPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setAppealPhotos((prev) => [...prev, result.assets[0].uri].slice(0, 3));
    }
  };

  const handleSubmitAppeal = async () => {
    if (!receivedReview?.id || !idToken) return;
    if (appealText.trim().length < 10) {
      Alert.alert("Error", "Please provide at least 10 characters explaining your appeal.");
      return;
    }
    setAppealSubmitting(true);
    try {
      await apiPost(
        `/reviews/${receivedReview.id}/appeal`,
        { text: appealText.trim(), photoUrls: appealPhotos },
        idToken
      );
      setAppealVisible(false);
      setAppealText("");
      setAppealPhotos([]);
      Alert.alert("Appeal Submitted", "Your appeal has been submitted for admin review.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to submit appeal.";
      Alert.alert("Error", msg);
    } finally {
      setAppealSubmitting(false);
    }
  };

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessible={true}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        accessibilityHint="Returns to previous screen"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name="chevron-back"
          size={30}
          color={colors.text}
          accessible={false}
          importantForAccessibility="no"
        />
      </TouchableOpacity>

      <View style={styles.titleRow}>
        <Text
          style={[styles.title, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          {counterpartName}
        </Text>
        {loading && (
          <ActivityIndicator size="small" color={colors.subtitle} style={styles.inlineSpinner} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollWrap}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
      >
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
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.reportBtn,
                {
                  borderColor: "#d92d20",
                  backgroundColor:
                    colors.background === "#222222"
                      ? "rgba(255,255,255,0.08)"
                      : colors.card,
                  flex: 1,
                },
              ]}
              accessible={true}
              accessibilityLabel="Report review"
              accessibilityRole="button"
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
                style={[styles.reportText, { color: "#d92d20" }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Report
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.reportBtn,
                {
                  borderColor: colors.accent,
                  backgroundColor:
                    colors.background === "#222222"
                      ? "rgba(255,255,255,0.08)"
                      : colors.card,
                  flex: 1,
                },
              ]}
              accessible={true}
              accessibilityLabel="Appeal review"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setAppealVisible(true)}
            >
              <Text
                style={[styles.reportText, { color: colors.accent }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Appeal
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </ScrollView>

      {/* Appeal Modal */}
      <Modal
        visible={appealVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAppealVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Appeal Review</Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              Explain why this review should be reconsidered. Attach photos as evidence if helpful.
            </Text>

            <TextInput
              value={appealText}
              onChangeText={setAppealText}
              placeholder="Describe your appeal (required)..."
              placeholderTextColor={colors.subtitle}
              multiline
              numberOfLines={5}
              style={[
                styles.appealInput,
                { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
              ]}
              accessibilityLabel="Appeal description"
            />

            <TouchableOpacity
              style={[styles.photoBtn, { borderColor: colors.border }]}
              onPress={handlePickAppealPhoto}
              disabled={appealPhotos.length >= 3}
              accessibilityRole="button"
              accessibilityLabel="Add photo evidence"
            >
              <Ionicons name="camera-outline" size={20} color={colors.text} />
              <Text style={[styles.photoBtnText, { color: colors.text }]}>
                Add Photo ({appealPhotos.length}/3)
              </Text>
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setAppealVisible(false);
                  setAppealText("");
                  setAppealPhotos([]);
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel appeal"
              >
                <Text style={[styles.modalBtnText, { color: colors.subtitle }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: appealSubmitting ? colors.accent + "80" : colors.accent,
                    borderColor: "transparent",
                  },
                ]}
                onPress={handleSubmitAppeal}
                disabled={appealSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Submit appeal"
              >
                {appealSubmitting ? (
                  <ActivityIndicator color={colors.buttonText ?? "#fff"} size="small" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.buttonText ?? "#fff" }]}>
                    Submit
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  scrollWrap: {
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

  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
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

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  reportBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: Platform.OS === "ios" ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
  },

  reportText: {
    fontSize: 16,
    fontWeight: "700",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  appealInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: "top",
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  photoBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
