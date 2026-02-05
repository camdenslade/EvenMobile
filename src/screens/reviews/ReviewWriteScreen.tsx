import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Image,
  Pressable,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";

import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeProvider";
import { apiPost, apiGet } from "../../services/apiService";
import GlobalBackground from "../../components/GlobalBackground";
import { compressToJpeg } from "../onboarding/utils/imageCompression";
import { AppImage } from "../../components/AppImage";
import {
  NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../../../App";

type ReviewType = "normal" | "emergency" | "report";

type ReviewWriteNavigationProp =
  NativeStackNavigationProp<RootStackParamList, "ReviewWrite">;

type ReviewWriteRouteProp =
  RouteProp<RootStackParamList, "ReviewWrite">;

interface ReviewResponse {
  id?: string;
  error?: string;
}

interface WeeklyUsage {
  used: number;
  remaining: number;
}

interface EmergencyStatus {
  used: boolean;
}

type ReportCategory = 
  | "harassment"
  | "inappropriate_content"
  | "fake_profile"
  | "spam"
  | "safety_concern"
  | "other";

interface Props {
  navigation: ReviewWriteNavigationProp;
  route: ReviewWriteRouteProp;
}

export default function ReviewWriteScreen({ navigation, route }: Props) {
  const { targetId, forceReport } = route.params;
  const { user, idToken } = useAuth();
  const { colors, isDark } = useTheme();

  const reviewerUid = user?.uid ?? null;

  const forceReportOnly = !!forceReport;

  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [type, setType] = useState<ReviewType>(forceReportOnly ? "report" : "normal");
  const [loading, setLoading] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number | null>(null);
  const [weeklyUsage, setWeeklyUsage] = useState<WeeklyUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [emergencyUsed, setEmergencyUsed] = useState<boolean>(false);
  const [loadingEmergency, setLoadingEmergency] = useState(true);
  const [emergencyConfirmVisible, setEmergencyConfirmVisible] = useState(false);
  const [reportConfirmVisible, setReportConfirmVisible] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [blockAfterReportVisible, setBlockAfterReportVisible] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);
  const [targetProfile, setTargetProfile] = useState<{ name: string; photoUrl: string | null } | null>(null);

  const MIN_COMMENT_LENGTH = 10;
  const MAX_COMMENT_LENGTH = 1000;
  const SUBMIT_COOLDOWN_MS = 15_000;

  // Calculate which normal review is unlocked (0 = first, 1 = second, 2 = third)
  const unlockedReviewIndex = weeklyUsage?.used ?? 0;

  // Rating ranges for each normal review
  const getRatingRange = (index: number): { min: number; max: number } => {
    if (index === 0) return { min: 3, max: 10 }; // First review: 3-10
    if (index === 1) return { min: 5, max: 10 }; // Second review: 5-10
    if (index === 2) return { min: 3, max: 10 }; // Third review: 3-10
    return { min: 1, max: 10 }; // Fallback
  };

  const currentRatingRange = type === "normal" ? getRatingRange(unlockedReviewIndex) : null;
  const isNormalReviewAvailable = weeklyUsage ? weeklyUsage.remaining > 0 : false;

  // Fetch weekly usage and emergency status on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!reviewerUid || !idToken) {
        setLoadingUsage(false);
        setLoadingEmergency(false);
        return;
      }

      try {
        const [usage, emergency] = await Promise.all([
          apiGet<WeeklyUsage>("/reviews/me/week-usage", idToken),
          apiGet<EmergencyStatus>("/reviews/me/emergency-used", idToken),
        ]);
        
        if (usage) {
          setWeeklyUsage(usage);
        }
        if (emergency) {
          setEmergencyUsed(emergency.used);
        }
      } catch (err) {
        console.error("Failed to fetch review data:", err);
      } finally {
        setLoadingUsage(false);
        setLoadingEmergency(false);
      }
    };

    void fetchData();
  }, [reviewerUid, idToken]);

  useEffect(() => {
    if (forceReportOnly) {
      setType("report");
      setReportCategory(null);
      setPhotos([]);
    }
  }, [forceReportOnly]);

  // Fetch target user profile for preview
  useEffect(() => {
    const fetchTargetProfile = async () => {
      if (!targetId || !idToken) return;
      try {
        const profile = await apiGet<{ name?: string; firstName?: string; profileImageUrl?: string; photos?: string[] }>(
          `/profiles/${targetId}`,
          idToken
        );
        if (profile) {
          const name = profile.name || profile.firstName || "User";
          const photoUrl = profile.profileImageUrl || profile.photos?.[0] || null;
          setTargetProfile({ name, photoUrl });
        }
      } catch (err) {
        console.error("Failed to fetch target profile:", err);
      }
    };
    void fetchTargetProfile();
  }, [targetId, idToken]);

  //********************************************************************
  //
  // submit Function
  //
  // Validates form input and submits review to POST /reviews endpoint.
  // Validates: user is logged in, rating is selected, comment is at
  // least 2 characters. Displays alerts for validation failures or
  // submission errors. Navigates back on success.
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
  // payload    Object              Request payload for POST /reviews
  // res        ReviewResponse|null Response from POST /reviews
  //
  //*******************************************************************
  const handleEmergencyTypeSelect = () => {
    if (emergencyUsed) {
      Alert.alert("Emergency Review Used", "You have already used your one emergency review per lifetime.");
      return;
    }
    setType("emergency");
    setRating(null);
  };

  const handleSubmitClick = () => {
    if (type === "emergency") {
      setEmergencyConfirmVisible(true);
      return;
    }
    if (type === "report") {
      if (!reportCategory) {
        Alert.alert("Error", "Please select a report category.");
        return;
      }
      setReportConfirmVisible(true);
      return;
    }
    submit();
  };

  const confirmEmergency = () => {
    setEmergencyConfirmVisible(false);
    submit();
  };

  const confirmReport = () => {
    setReportConfirmVisible(false);
    submit();
  };

  const submit = async () => {
    if (!reviewerUid || !idToken) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    if (!rating) {
      Alert.alert("Error", "Please select a rating.");
      return;
    }

    // Validate rating ranges based on review type
    if (type === "normal") {
      if (!isNormalReviewAvailable) {
        Alert.alert("Error", "You have used all 3 normal reviews this week.");
        return;
      }
      if (currentRatingRange && (rating < currentRatingRange.min || rating > currentRatingRange.max)) {
        Alert.alert(
          "Error",
          `This review must be between ${currentRatingRange.min} and ${currentRatingRange.max}.`
        );
        return;
      }
    } else if (type === "report") {
      if (rating < 1 || rating > 3) {
        Alert.alert("Error", "Report reviews must be between 1 and 3.");
        return;
      }
      if (!reportCategory) {
        Alert.alert("Error", "Please select a report category.");
        return;
      }
    } else if (type === "emergency") {
      if (rating < 1 || rating > 10) {
        Alert.alert("Error", "Emergency reviews must be between 1 and 10.");
        return;
      }
    }

    const normalizedComment = comment.trim().replace(/\s+/g, " ");

    // Comments are optional for normal reviews, but required for emergency/report
    if (type !== "normal" && normalizedComment.length < MIN_COMMENT_LENGTH) {
      Alert.alert(
        "Error",
        "Emergency and report reviews require a detailed comment."
      );
      return;
    }

    if (normalizedComment.length > MAX_COMMENT_LENGTH) {
      Alert.alert(
        "Error",
        `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).`
      );
      return;
    }

    if (lastSubmittedAt && Date.now() - lastSubmittedAt < SUBMIT_COOLDOWN_MS) {
      const remaining = Math.ceil(
        (SUBMIT_COOLDOWN_MS - (Date.now() - lastSubmittedAt)) / 1000
      );
      Alert.alert(
        "Please wait",
        `You can submit another review in ${remaining} seconds.`
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        reviewerUid,
        targetUid: targetId,
        rating,
        comment: normalizedComment || "", // Empty string if no comment for normal reviews
        type,
        reportCategory: type === "report" ? reportCategory : null,
        photos: type === "report" ? photos : [],
      };

      const res = await apiPost<ReviewResponse>("/reviews", payload, idToken);

      if (!res) {
        Alert.alert("Error", "No response from server.");
        return;
      }

      if (res.error) {
        Alert.alert("Error", res.error);
        return;
      }

      // If report review, also create a Report entity for admin panel
      if (type === "report" && idToken) {
        try {
          await apiPost(
            `/reports/users/${targetId}`,
            { reason: normalizedComment || null },
            idToken
          );
        } catch (err) {
          console.error("Failed to create report entity:", err);
          // Don't fail the review submission if report creation fails
        }
      }

      setLastSubmittedAt(Date.now());

      // Refresh weekly usage after successful submission
      if (type === "normal") {
        const usage = await apiGet<WeeklyUsage>("/reviews/me/week-usage", idToken);
        if (usage) {
          setWeeklyUsage(usage);
        }
      }

      // For report reviews, show block option modal instead of navigating away
      if (type === "report") {
        setBlockAfterReportVisible(true);
        return;
      }

      Alert.alert("Success", "Your review has been submitted.");
      navigation.goBack();
    } catch (err: any) {
      const errorMessage = err?.message || "Something went wrong.";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
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

      {targetProfile && (
        <TouchableOpacity
          onPress={() => navigation.navigate("UserProfileView", {
            userId: targetId,
            targetName: targetProfile.name,
            fromReview: true,
          })}
          style={styles.profilePreviewBtn}
          accessibilityRole="button"
          accessibilityLabel={`View ${targetProfile.name}'s profile`}
          accessibilityHint="Opens full profile view"
        >
          <AppImage
            source={targetProfile.photoUrl || "https://via.placeholder.com/100"}
            style={styles.profilePreviewImage}
            accessibilityLabel={`${targetProfile.name}'s photo`}
          />
        </TouchableOpacity>
      )}

      <Text
        style={[styles.title, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Write a Review
      </Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
      >

      <Text
        style={[styles.hint, { color: colors.subtitle, marginTop: 4 }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        Reviews are moderated. False or abusive submissions may lead to strikes. Avoid sharing private info.
      </Text>

      <Text 
        style={[styles.label, { color: colors.text }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        Select Rating
        {type === "normal" && currentRatingRange && (
          <Text style={[styles.hint, { color: colors.subtitle }]}>
            {" "}({currentRatingRange.min}-{currentRatingRange.max})
          </Text>
        )}
        {type === "report" && (
          <Text style={[styles.hint, { color: colors.subtitle }]}>
            {" "}(1-3)
          </Text>
        )}
      </Text>
      <View
        style={styles.ratingContainer}
        accessible={false}
        importantForAccessibility="no"
      >
        {type === "report" ? (
          // Report reviews: single row with 3 buttons
          <View style={styles.ratingRow}>
            {Array.from({ length: 3 }, (_, i) => i + 1).map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.ratingCircle,
                  { 
                    backgroundColor: colors.card,
                    borderColor: "#222222",
                    borderWidth: 1,
                  },
                  rating === num && [styles.ratingCircleActive, { backgroundColor: colors.accent }],
                ]}
                onPress={() => setRating(num)}
                accessible={true}
                accessibilityLabel={`Rating ${num}`}
                accessibilityRole="button"
                accessibilityState={{ selected: rating === num }}
                accessibilityHint={`Selects rating of ${num} out of 3`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={[
                    styles.ratingText,
                    { color: colors.text },
                    rating === num && { color: colors.buttonText },
                  ]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // Normal and emergency reviews: two rows with 5 buttons each
          <>
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => {
                let isDisabled = false;
                if (type === "normal" && currentRatingRange) {
                  isDisabled = num < currentRatingRange.min || num > currentRatingRange.max;
                }
                
                return (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.ratingCircle,
                      { 
                        backgroundColor: colors.card,
                        borderColor: "#222222",
                        borderWidth: 1,
                      },
                      rating === num && [styles.ratingCircleActive, { backgroundColor: colors.accent }],
                      isDisabled && styles.ratingCircleDisabled,
                    ]}
                    onPress={() => !isDisabled && setRating(num)}
                    disabled={isDisabled}
                    accessible={true}
                    accessibilityLabel={`Rating ${num}${isDisabled ? " (not available)" : ""}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rating === num, disabled: isDisabled }}
                    accessibilityHint={isDisabled ? "This rating is not available for this review" : `Selects rating of ${num} out of 10`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={[
                        styles.ratingText,
                        { color: colors.text },
                        rating === num && { color: colors.buttonText },
                        isDisabled && { color: colors.subtitle, opacity: 0.5 },
                      ]}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }, (_, i) => i + 6).map((num) => {
                let isDisabled = false;
                if (type === "normal" && currentRatingRange) {
                  isDisabled = num < currentRatingRange.min || num > currentRatingRange.max;
                }
                
                return (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.ratingCircle,
                      { 
                        backgroundColor: colors.card,
                        borderColor: "#222222",
                        borderWidth: 1,
                      },
                      rating === num && [styles.ratingCircleActive, { backgroundColor: colors.accent }],
                      isDisabled && styles.ratingCircleDisabled,
                    ]}
                    onPress={() => !isDisabled && setRating(num)}
                    disabled={isDisabled}
                    accessible={true}
                    accessibilityLabel={`Rating ${num}${isDisabled ? " (not available)" : ""}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rating === num, disabled: isDisabled }}
                    accessibilityHint={isDisabled ? "This rating is not available for this review" : `Selects rating of ${num} out of 10`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={[
                        styles.ratingText,
                        { color: colors.text },
                        rating === num && { color: colors.buttonText },
                        isDisabled && { color: colors.subtitle, opacity: 0.5 },
                      ]}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      {num}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </View>

      {type === "report" && (
        <>
          <Text 
            style={[styles.label, { color: colors.text }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            Report Category
          </Text>
          <Pressable
            style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Report category${reportCategory ? `: ${reportCategory}` : ""}`}
          >
            <Text style={[styles.dropdownText, { color: reportCategory ? colors.text : colors.subtitle }]}>
              {reportCategory 
                ? reportCategory.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                : "Select a category"}
            </Text>
            <Ionicons name={showCategoryDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.text} />
          </Pressable>
          {showCategoryDropdown && (
            <View style={[styles.dropdownMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {(["harassment", "inappropriate_content", "fake_profile", "spam", "safety_concern", "other"] as ReportCategory[]).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.dropdownItem, reportCategory === cat && { backgroundColor: colors.accent }]}
                  onPress={() => {
                    setReportCategory(cat);
                    setShowCategoryDropdown(false);
                  }}
                  accessible={true}
                  accessibilityRole="button"
                >
                  <Text style={[styles.dropdownItemText, { color: reportCategory === cat ? colors.buttonText : colors.text }]}>
                    {cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      <Text 
        style={[styles.label, { color: colors.text }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        Your Comment
      </Text>
      <TextInput
        style={[styles.textBox, { backgroundColor: colors.card, color: colors.text }]}
        placeholder="Write your experience"
        placeholderTextColor={colors.subtitle}
        value={comment}
        onChangeText={setComment}
        multiline={true}
        returnKeyType="done"
        blurOnSubmit={true}
        accessible={true}
        accessibilityLabel="Review comment"
        accessibilityRole="none"
        accessibilityHint="Enter your review comment. Must be at least 10 characters."
        allowFontScaling={true}
      />

      {type === "report" && (
        <>
          <Text 
            style={[styles.label, { color: colors.text }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            Supporting Photos (Optional)
          </Text>
          <View style={styles.photoContainer}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri: photo }} style={styles.photoPreview} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => setPhotos(photos.filter((_, i) => i !== index))}
                  accessible={true}
                  accessibilityLabel="Remove photo"
                  accessibilityRole="button"
                >
                  <Ionicons name="close-circle" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity
                style={[styles.addPhotoButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={async () => {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert("Permission Required", "Please grant photo library access to upload photos.");
                    return;
                  }
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      quality: 0.8,
                      allowsMultipleSelection: true,
                      selectionLimit: 5 - photos.length,
                    });
                    if (!result.canceled && result.assets && idToken) {
                      setUploadingPhotos(true);
                      const newPhotos: string[] = [];
                      for (const asset of result.assets) {
                        try {
                          const compressed = await compressToJpeg(asset.uri);
                          const signed = await apiGet<{ uploadUrl: string; key: string; readUrl: string }>(
                            "/profiles/upload-url?fileType=image/jpeg",
                            idToken
                          );
                          if (signed && signed.uploadUrl && signed.key && signed.readUrl) {
                            const response = await fetch(compressed);
                            const blob = await response.blob();
                            await fetch(signed.uploadUrl, {
                              method: "PUT",
                              headers: {
                                "Content-Type": "image/jpeg",
                                "x-amz-server-side-encryption": "AES256",
                              },
                              body: blob,
                            });
                            newPhotos.push(signed.key);
                          }
                        } catch (err) {
                          console.error("Failed to upload photo:", err);
                        }
                      }
                      setPhotos([...photos, ...newPhotos]);
                      setUploadingPhotos(false);
                    }
                }}
                disabled={uploadingPhotos}
                accessible={true}
                accessibilityLabel="Add photo"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {!forceReportOnly && (
        <>
          <Text 
            style={[styles.label, { color: colors.text }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            Review Type
          </Text>
          <View 
            style={styles.typeRow}
            accessible={false}
            importantForAccessibility="no"
          >
            {(["normal", "emergency", "report"] as ReviewType[]).filter(t => {
              // Hide emergency if already used
              if (t === "emergency" && emergencyUsed) return false;
              return true;
            }).map((t) => {
              const label = t === "normal" ? "Normal" : t === "emergency" ? "Emergency" : "Report";
              const isNormalUnavailable = t === "normal" && !isNormalReviewAvailable && !loadingUsage;
              const reviewNumber = t === "normal" && weeklyUsage ? ` (${weeklyUsage.used + 1}/3)` : "";
              
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeButton,
                    { backgroundColor: colors.card },
                    type === t && [styles.typeButtonActive, { backgroundColor: colors.accent }],
                    isNormalUnavailable && styles.typeButtonDisabled,
                  ]}
                  onPress={() => {
                    if (!isNormalUnavailable) {
                      if (t === "emergency") {
                        handleEmergencyTypeSelect();
                      } else {
                        setType(t);
                        setRating(null); // Reset rating when changing type
                        if (t === "report") {
                          setReportCategory(null);
                          setPhotos([]);
                        }
                      }
                    }
                  }}
                  disabled={isNormalUnavailable}
                  accessible={true}
                  accessibilityLabel={`${label}${reviewNumber}${isNormalUnavailable ? " (unavailable)" : ""}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === t, disabled: isNormalUnavailable }}
                  accessibilityHint={isNormalUnavailable ? "All normal reviews used this week" : `Selects ${label.toLowerCase()} review type${reviewNumber}`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: colors.text },
                      type === t && { color: colors.buttonText },
                      isNormalUnavailable && { color: colors.subtitle, opacity: 0.5 },
                    ]}
                    allowFontScaling={true}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    {label}{reviewNumber}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {type === "normal" && weeklyUsage && (
            <Text style={[styles.infoText, { color: colors.subtitle }]}>
              {weeklyUsage.remaining > 0 
                ? `Review ${weeklyUsage.used + 1} of 3 this week (${weeklyUsage.remaining} remaining)`
                : "All 3 normal reviews used this week"}
            </Text>
          )}
        </>
      )}

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: colors.accent }, loading && { opacity: 0.5 }]}
        onPress={handleSubmitClick}
        disabled={loading}
        accessible={true}
        accessibilityLabel={loading ? "Submitting" : "Submit review"}
        accessibilityRole="button"
        accessibilityHint="Submits the review"
        accessibilityState={{ disabled: loading }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text 
          style={[styles.submitText, { color: colors.buttonText }]}
          allowFontScaling={true}
          accessible={false}
          importantForAccessibility="no"
        >
          {loading ? "Submitting" : "Submit Review"}
        </Text>
      </TouchableOpacity>
      </ScrollView>

      {/* Emergency Review Confirmation Modal */}
      <Modal
        visible={emergencyConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmergencyConfirmVisible(false)}
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalCenter}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Emergency Review Warning
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              You only have ONE emergency review per lifetime. This cannot be undone. Are you sure you want to submit this emergency review?
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={() => setEmergencyConfirmVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }]}
              onPress={confirmEmergency}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Confirm emergency review"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.text }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Review Confirmation Modal */}
      <Modal
        visible={reportConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportConfirmVisible(false)}
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalCenter}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Submit Report Review?
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              This report will be reviewed by our admin team. Are you sure you want to submit this report review?
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={confirmReport}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Confirm report submission"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>Submit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }]}
              onPress={() => setReportConfirmVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Block User After Report Modal */}
      <Modal
        visible={blockAfterReportVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setBlockAfterReportVisible(false);
          navigation.goBack();
        }}
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalCenter}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Report Submitted
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              Your report has been submitted and will be reviewed by our team. Would you also like to block this user?
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                setBlockAfterReportVisible(false);
                navigation.goBack();
              }}
              disabled={blockingUser}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="No, don't block"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>No Thanks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }, blockingUser && { opacity: 0.5 }]}
              onPress={async () => {
                if (!idToken || !targetId) return;
                setBlockingUser(true);
                try {
                  await apiPost(`/blocks/${targetId}`, {}, idToken);
                  setBlockAfterReportVisible(false);
                  Alert.alert("Blocked", "This user has been blocked.");
                  navigation.navigate("Swipe", { refreshQueue: true });
                } catch (err: any) {
                  Alert.alert("Error", err?.message || "Failed to block user.");
                } finally {
                  setBlockingUser(false);
                }
              }}
              disabled={blockingUser}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Block user"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.text }]}>
                {blockingUser ? "Blocking..." : "Block User"}
              </Text>
            </TouchableOpacity>
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
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },
  profilePreviewBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  profilePreviewImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 20,
  },
  ratingContainer: {
    gap: 9,
    alignItems: "center",
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  ratingCircle: {
    width: 50,
    height: 50,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  ratingCircleActive: {
    // backgroundColor set via inline style
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "600",
  },
  textBox: {
    padding: 14,
    borderRadius: 10,
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: "top",
    fontSize: 16,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  typeButtonActive: {
    // backgroundColor set via inline style
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 30,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  submitText: {
    fontSize: 18,
    fontWeight: "700",
  },
  hint: {
    fontSize: 14,
    fontWeight: "400",
  },
  ratingCircleDisabled: {
    opacity: 0.3,
  },
  typeButtonDisabled: {
    opacity: 0.5,
  },
  infoText: {
    fontSize: 14,
    marginTop: 8,
    fontStyle: "italic",
  },
  dropdown: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },
  dropdownText: {
    fontSize: 16,
  },
  dropdownMenu: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  dropdownItemText: {
    fontSize: 16,
  },
  photoContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  photoWrapper: {
    position: "relative",
    width: 100,
    height: 100,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalBox: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalBtn: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
  modalBtnOutline: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnOutlineText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});


