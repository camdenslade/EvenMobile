//********************************************************************
//
// EditProfileScreen Component
//
// Allows users to edit their profile information including photos,
// name, bio, sex, sex preference, dating preference, and interests.
// Supports drag-to-reorder photos, multiple photo selection with
// built-in cropping via react-native-image-crop-picker, and
// "smart photos" toggle. Loads existing profile data on mount and
// saves changes via PATCH /profiles/me. Updates Zustand cache on save.
// Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the edit profile screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// __prerender   boolean     Flag for prerendering (returns null if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors              Object                  Theme colors
// setProfile          function                 Zustand setter for profile
// loading             boolean                 Loading state
// error               string|null             Error message
// userUid             string|null             User's UID
// name                string                  User's name
// bio                 string                  User's bio
// age                 number                  User's age
// sex                 "male"|"female"         User's sex
// sexPreference       SexPreference           User's sex preference
// datingPreference    DatingPreference        User's dating preference
// interests           string[]                User's interests
// photos              (string|null)[]         Array of photo URIs (up to 6)
// smartPhotos         boolean                 Smart photos toggle state
// interestSearch      string                  Interest search query
// showAllInterests    boolean                 Whether to show all interests
// data                UserProfile|null        Profile data from API
// grid                (string|null)[]         Photo grid array
// image               Image                   Image picker result from react-native-image-crop-picker
// images              Image[]                 Multiple image picker results
// compressed          string                  Compressed JPEG URI
// signed              Object|null             Signed upload URL response
// blob                Blob                    Photo blob for upload
// uploadedUrls        string[]                URLs of uploaded photos
// updated             (string|null)[]         Updated photos array
// urlIndex            number                  Index in uploadedUrls array
// startIndex          number                  Starting index for photo placement
// i                   number                  Loop index
// draggingIndex       number|null             Index of photo being dragged
// dragPositions       Object                  Animated values for drag positions
// dragStartPos        Object|null             Starting position of drag
// evt                 GestureEvent            Pan responder event
// gesture             PanResponderGestureState Gesture state
// slotWidth           number                  Approximate slot width
// slotHeight          number                  Approximate slot height
// cols                number                  Number of columns in grid
// row                 number                  Current row index
// col                 number                  Current column index
// newRow              number                  New row after drag
// newCol              number                  New column after drag
// newIndex            number                  New index after drag
// photoToMove         string|null             Photo being moved
// temp                string|null             Temporary photo for swap
// i                   string                  Interest string in toggle
// realPhotos          string[]                Filtered non-null photos
// res                 UserProfile|null        Response from PATCH /profiles/me
// DATING_PREFS        Array                   Filtered dating preferences
// saved               Object|null             Saved preference option
//
//*******************************************************************

import { useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Animated,
  PanResponder,
  Platform,
  Modal,
  Alert,
} from "react-native";

import { RouteProp } from "@react-navigation/native";

import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { apiGet, apiPatch } from "../../services/apiService";
import { ProfilePhoto } from "../../types/photo";
import { INTERESTS } from "../../constants/interests";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { useAppCache } from "../../services/appCache";
import { ImageCropModal } from "../../components/ImageCropModal";
import { AppImage } from "../../components/AppImage";
import { MultiSelectPills } from "../../components/MultiSelectPills";
import { SingleSelectPills } from "../../components/SingleSelectPills";
import { FLAGGED_WORDS } from "../../constants/flaggedWords";
import { useSessionData } from "../../context/SessionDataContext";
import { InlineAlert } from "../../components/InlineAlert";
import {
  RACE_OPTIONS,
  RELIGION_OPTIONS,
  POLITICS_OPTIONS,
  EDUCATION_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  MARIJUANA_OPTIONS,
} from "../../constants/profileOptions";

import type {
  UserProfile,
  SexPreference,
  DatingPreference,
} from "../../types/user";
import type { RootStackParamList } from "../../../App";

const ALL_PREFS: SexPreference[] = ["male", "female", "everyone"];

const RAW_DATING_PREFS: { value: DatingPreference; label: string }[] = [
  { value: "hookups", label: "Hookups Only" },
  { value: "situationship", label: "Situationship" },
  { value: "short_term_relationship", label: "Short-term Relationship" },
  { value: "short_term_open", label: "Short-term, open to long" },
  { value: "long_term_open", label: "Long-term, open to short" },
  { value: "long_term_relationship", label: "Long-term Relationship" },
];

interface EditProfileProps {
  navigation?: any;
  route?: RouteProp<RootStackParamList, "EditProfile">;
  __prerender?: boolean;
}

export default function EditProfileScreen({
  navigation,
  route,
  __prerender,
}: EditProfileProps) {
  const { colors } = useTheme();
  const setProfile = useAppCache((s) => s.setProfile);
  const { userSummary } = useSessionData();
  const prefillSchool = useMemo(
    () => route?.params?.prefillSchool ?? "",
    [route?.params],
  );

  // If prerendering, do not mount UI logic
  if (__prerender) return null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userUid, setUserUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState<number>(18);
  const [sex, setSex] = useState<"male" | "female">("male");

  const [sexPreference, setSexPreference] =
    useState<SexPreference>("everyone");

  const [datingPreference, setDatingPreference] =
    useState<DatingPreference>("hookups");

  const [interests, setInterests] = useState<string[]>([]);

  const [photos, setPhotos] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  // Original uncropped photo keys/urls aligned with photos
  const [photoOriginals, setPhotoOriginals] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
    null,
    null,
  ]);

  // Map of S3 keys to presigned read URLs for immediate display
  const [photoKeyToUrl, setPhotoKeyToUrl] = useState<Map<string, string>>(new Map());

  // Map of original S3 keys to presigned read URLs for recropping
  const [originalKeyToUrl, setOriginalKeyToUrl] = useState<Map<string, string>>(new Map());

  // Map of photo keys to moderation status
  const [photoStatuses, setPhotoStatuses] = useState<Map<string, ProfilePhoto>>(new Map());

  const [smartPhotos, setSmartPhotos] = useState(false);

  const [interestSearch, setInterestSearch] = useState("");
  const [showAllInterests, setShowAllInterests] = useState(false);

  // Personal detail fields
  const [height, setHeight] = useState<string[]>([]);
  const [race, setRace] = useState<string[]>([]);
  const [religion, setReligion] = useState<string[]>([]);
  const [politics, setPolitics] = useState<string[]>([]);
  const [education, setEducation] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<string>("");
  const [drinking, setDrinking] = useState<string[]>([]);
  const [smoking, setSmoking] = useState<string[]>([]);
  const [marijuana, setMarijuana] = useState<string[]>([]);
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [showSchoolInfo, setShowSchoolInfo] = useState(false);
  const schoolLocked = useMemo(
    () =>
      Boolean(
        prefillSchool ||
          (userSummary?.schoolEmailVerified && (school || prefillSchool)),
      ),
    [prefillSchool, school, userSummary?.schoolEmailVerified],
  );

  // Image cropping state
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);

  // Unsaved changes modal state
  const [unsavedChangesModalVisible, setUnsavedChangesModalVisible] = useState(false);
  const [originalProfile, setOriginalProfile] = useState<{
    name: string;
    bio: string;
    age: number;
    sex: "male" | "female";
    sexPreference: SexPreference;
    datingPreference: DatingPreference;
    interests: string[];
    photos: (string | null)[];
    photoOriginals: (string | null)[];
    school: string;
    major: string;
    gradYear: string;
    showSchoolInfo: boolean;
  } | null>(null);

  // ----------------------------------------------------------------------
  // Load profile
  // ----------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const params = route?.params ?? {};
        const data = await apiGet<UserProfile>("/profiles/me");

        if (data) {
          setUserUid(data.userUid);
          setName(data.name);
          setBio(data.bio);
          setSex(data.sex);
          setAge(data.age);
          setSexPreference(data.sexPreference);
          setDatingPreference(data.datingPreference);
          setInterests(data.interests);
          
          // Load personal detail fields (arrays)
          if (data.height !== undefined && data.height !== null && Array.isArray(data.height)) setHeight(data.height);
          if (data.race !== undefined && data.race !== null && Array.isArray(data.race)) setRace(data.race);
          if (data.religion !== undefined && data.religion !== null && Array.isArray(data.religion)) setReligion(data.religion);
          if (data.politics !== undefined && data.politics !== null && Array.isArray(data.politics)) setPolitics(data.politics);
          if (data.education !== undefined && data.education !== null && Array.isArray(data.education)) setEducation(data.education);
          if (data.activityLevel !== undefined && data.activityLevel !== null) setActivityLevel(data.activityLevel);
          if (data.drinking !== undefined && data.drinking !== null && Array.isArray(data.drinking)) setDrinking(data.drinking);
          if (data.smoking !== undefined && data.smoking !== null && Array.isArray(data.smoking)) setSmoking(data.smoking);
          if (data.marijuana !== undefined && data.marijuana !== null && Array.isArray(data.marijuana)) setMarijuana(data.marijuana);

          let resolvedSchool = data.school ?? (params.prefillSchool ?? "");
          const resolvedMajor = data.major ?? (params.prefillMajor ?? "");
          const resolvedGradYear =
            data.gradYear !== undefined && data.gradYear !== null
              ? String(data.gradYear)
              : params.prefillGradYear !== undefined && params.prefillGradYear !== null
              ? String(params.prefillGradYear)
              : "";
          const resolvedShowSchoolInfo =
            params.showSchoolInfo !== undefined && params.showSchoolInfo !== null
              ? params.showSchoolInfo
              : Boolean(resolvedSchool || resolvedMajor || resolvedGradYear);

          setSchool(resolvedSchool);
          setMajor(resolvedMajor);
          setGradYear(resolvedGradYear);
          setShowSchoolInfo(resolvedShowSchoolInfo);

          const grid: (string | null)[] = [...data.photos];
          while (grid.length < 6) grid.push(null);
          setPhotos(grid);

          const originalsGrid: (string | null)[] = data.photoOriginals
            ? [...data.photoOriginals]
            : [...data.photos];
          while (originalsGrid.length < 6) originalsGrid.push(null);
          setPhotoOriginals(originalsGrid);

          // Store original profile data for comparison
          setOriginalProfile({
            name: data.name,
            bio: data.bio,
            age: data.age,
            sex: data.sex,
            sexPreference: data.sexPreference,
            datingPreference: data.datingPreference,
            interests: data.interests,
            photos: grid,
            photoOriginals: originalsGrid,
            school: resolvedSchool,
            major: resolvedMajor,
            gradYear: resolvedGradYear,
            showSchoolInfo: resolvedShowSchoolInfo,
          });

          // Load photo moderation statuses
          try {
            const statuses = await apiGet<ProfilePhoto[]>("/profiles/me/photo-statuses");
            if (statuses) {
              const statusMap = new Map<string, ProfilePhoto>();
              statuses.forEach((photo) => {
                statusMap.set(photo.url, photo);
              });
              setPhotoStatuses(statusMap);
            }
          } catch {
            // Silently fail - photo statuses are not critical
          }
        }
      } catch {
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Periodically refresh photo statuses ONLY when there are pending photos
  // This prevents unnecessary network requests and battery drain
  const hasPendingPhotos = useMemo(() => {
    for (const [, photo] of photoStatuses) {
      if (photo.status === 'pending') return true;
    }
    return false;
  }, [photoStatuses]);

  useEffect(() => {
    // Only poll if we have photos that are pending moderation
    if (!userUid || !hasPendingPhotos) return;

    const interval = setInterval(async () => {
      try {
        const statuses = await apiGet<ProfilePhoto[]>("/profiles/me/photo-statuses");
        if (statuses) {
          const statusMap = new Map<string, ProfilePhoto>();
          statuses.forEach((photo) => {
            statusMap.set(photo.url, photo);
          });
          setPhotoStatuses(statusMap);
        }
      } catch {
        // Silently fail
      }
    }, 10000); // Refresh every 10 seconds only while pending

    return () => clearInterval(interval);
  }, [userUid, hasPendingPhotos]);

  // ----------------------------------------------------------------------
  // Upload helpers
  // ----------------------------------------------------------------------
  async function compressToJpeg(uri: string): Promise<string> {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: 1080 } }],
      { compress: 0.82, format: SaveFormat.JPEG }
    );
    return result.uri;
  }

  async function pickPhoto(index?: number) {
    // Request permissions first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access photo library is required.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsMultipleSelection: index === undefined,
      selectionLimit: index === undefined ? 6 : 1,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;

    // If editing a specific photo (index provided), show crop modal
    if (index !== undefined && res.assets.length === 1) {
      setImageToCrop(res.assets[0].uri);
      setCropTargetIndex(index);
      setCropModalVisible(true);
      return;
    }

    setLoading(true);
    setUploading(true);
    setError(null);

    try {
      // Multiple photos - upload directly without cropping
      const uploadedUrls: string[] = [];
      const uploadedOriginals: string[] = [];

      // Upload all selected photos
      for (const asset of res.assets) {
        try {
          const compressed = await compressToJpeg(asset.uri);

          const signed = await apiGet<{
            uploadUrlOriginal: string;
            keyOriginal: string;
            readUrlOriginal: string;
            uploadUrlDerived: string;
            keyDerived: string;
            readUrlDerived: string;
          }>("/profiles/upload-url?fileType=image/jpeg");
          if (
            !signed ||
            !signed.uploadUrlOriginal ||
            !signed.keyOriginal ||
            !signed.uploadUrlDerived ||
            !signed.keyDerived
          ) {
            console.error("Upload URL failed:", signed);
            setError("Could not get upload URL. Please retry.");
            continue;
          }

          // Upload original (uncropped) image
          const origResponse = await fetch(asset.uri);
          if (!origResponse.ok) {
            console.error("Failed to fetch original image:", origResponse.status, origResponse.statusText);
            setError("Failed to process image for upload.");
            continue;
          }
          const origBlob = await origResponse.blob();
          const origUploadResponse = await fetch(signed.uploadUrlOriginal, {
            method: "PUT",
            headers: {
              "Content-Type": "image/jpeg",
              "x-amz-server-side-encryption": "AES256",
            },
            body: origBlob,
          });
          if (!origUploadResponse.ok) {
            const errBody = await origUploadResponse.text().catch(() => "(no body)");
            console.error("Failed to upload original to S3:", origUploadResponse.status, origUploadResponse.statusText, errBody);
            setError("Failed to upload photo to storage. Check your connection and try again.");
            continue;
          }

          const response = await fetch(compressed);
          if (!response.ok) {
            console.error("Failed to fetch compressed image:", response.status, response.statusText);
            setError("Failed to process image for upload.");
            continue;
          }

          const blob = await response.blob();

          const uploadResponse = await fetch(signed.uploadUrlDerived, {
            method: "PUT",
            headers: {
              "Content-Type": "image/jpeg",
              "x-amz-server-side-encryption": "AES256",
            },
            body: blob,
          });

          if (!uploadResponse.ok) {
            const errBody = await uploadResponse.text().catch(() => "(no body)");
            console.error("Failed to upload to S3:", uploadResponse.status, uploadResponse.statusText, errBody);
            setError("Failed to upload photo to storage. Check your connection and try again.");
            continue;
          }

          // Store key for saving, and map key to readUrl for immediate display
          uploadedUrls.push(signed.keyDerived);
          uploadedOriginals.push(signed.keyOriginal);
          setPhotoKeyToUrl((prev) => {
            const updated = new Map(prev);
            updated.set(signed.keyDerived, signed.readUrlDerived);
            return updated;
          });
          setOriginalKeyToUrl((prev) => {
            const updated = new Map(prev);
            updated.set(signed.keyOriginal, signed.readUrlOriginal);
            return updated;
          });
        } catch (assetError: any) {
          console.error("Error uploading individual photo:", assetError);
          setError(`Failed to upload photo: ${assetError.message || "Unknown error"}`);
          continue;
        }
      }

      if (uploadedUrls.length === 0) {
        setError("Failed to upload photos. Please try again.");
        setLoading(false);
        return;
      }

      // Add uploaded photos to the first available slots
      setPhotos((prev) => {
        const updated = [...prev];
        setPhotoOriginals((prevOrig) => {
          const updatedOrig = [...prevOrig];
          let urlIndex = 0;

          for (let i = 0; i < updated.length && urlIndex < uploadedUrls.length; i++) {
            if (updated[i] === null) {
              updated[i] = uploadedUrls[urlIndex];
              updatedOrig[i] = uploadedOriginals[urlIndex] ?? uploadedUrls[urlIndex];
              urlIndex++;
            }
          }

          return updatedOrig;
        });
        return updated;
      });

      // Refresh photo statuses after upload
      try {
        const statuses = await apiGet<ProfilePhoto[]>("/profiles/me/photo-statuses");
        if (statuses) {
          const statusMap = new Map<string, ProfilePhoto>();
          statuses.forEach((photo) => {
            statusMap.set(photo.url, photo);
          });
          setPhotoStatuses(statusMap);
        }
      } catch {
        // Silently fail
      }
    } catch (e: any) {
      console.error("Error in pickPhoto:", e);
      setError(`Failed to upload photos: ${e.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      setLoading(false);
    }
  }

  async function handleCropComplete(croppedUri: string) {
    if (cropTargetIndex === null || !imageToCrop) return;

    setLoading(true);
    setError(null);
    setCropModalVisible(false);

    try {
      const compressed = await compressToJpeg(croppedUri);

      const existingOriginalKey =
        photoOriginals[cropTargetIndex] ?? photos[cropTargetIndex] ?? undefined;

      if (!existingOriginalKey) {
        // New slot: upload both original and derived
        const pair = await apiGet<{
          uploadUrlOriginal: string;
          keyOriginal: string;
          readUrlOriginal: string;
          uploadUrlDerived: string;
          keyDerived: string;
          readUrlDerived: string;
        }>("/profiles/upload-url?fileType=image/jpeg");

        if (!pair || !pair.uploadUrlOriginal || !pair.uploadUrlDerived) {
          console.error("Upload URL failed:", pair);
          setError("Could not get upload URL. Please retry.");
          setLoading(false);
          return;
        }

        const origResponse = await fetch(imageToCrop);
        if (!origResponse.ok) {
          console.error("Failed to fetch original image:", origResponse.status, origResponse.statusText);
          setError("Failed to process image for upload.");
          setLoading(false);
          return;
        }
        const origBlob = await origResponse.blob();
        const origUploadResponse = await fetch(pair.uploadUrlOriginal, {
          method: "PUT",
          headers: {
            "Content-Type": "image/jpeg",
            "x-amz-server-side-encryption": "AES256",
          },
          body: origBlob,
        });
        if (!origUploadResponse.ok) {
          const errBody = await origUploadResponse.text().catch(() => "(no body)");
          console.error("Failed to upload original to S3:", origUploadResponse.status, origUploadResponse.statusText, errBody);
          setError("Failed to upload photo to storage. Check your connection and try again.");
          setLoading(false);
          return;
        }

        const response = await fetch(compressed);
        if (!response.ok) {
          console.error("Failed to fetch compressed image:", response.status, response.statusText);
          setError("Failed to process image for upload.");
          setLoading(false);
          return;
        }
        const blob = await response.blob();

        const uploadResponse = await fetch(pair.uploadUrlDerived, {
          method: "PUT",
          headers: {
            "Content-Type": "image/jpeg",
            "x-amz-server-side-encryption": "AES256",
          },
          body: blob,
        });

        if (!uploadResponse.ok) {
          const errBody = await uploadResponse.text().catch(() => "(no body)");
          console.error("Failed to upload to S3:", uploadResponse.status, uploadResponse.statusText, errBody);
          setError("Failed to upload photo to storage. Check your connection and try again.");
          setLoading(false);
          return;
        }

        setPhotos((prev) => {
          const updated = [...prev];
          updated[cropTargetIndex] = pair.keyDerived;
          return updated;
        });
        setPhotoOriginals((prev) => {
          const updated = [...prev];
          updated[cropTargetIndex] = pair.keyOriginal;
          return updated;
        });

        setPhotoKeyToUrl((prev) => {
          const updated = new Map(prev);
          updated.set(pair.keyDerived, pair.readUrlDerived);
          return updated;
        });
        setOriginalKeyToUrl((prev) => {
          const updated = new Map(prev);
          updated.set(pair.keyOriginal, pair.readUrlOriginal);
          return updated;
        });
      } else {
        const signed = await apiGet<{
          uploadUrl: string;
          key: string;
          readUrl: string;
          originalKey?: string;
        }>(
          `/profiles/derived-upload-url${
            existingOriginalKey
              ? `?originalKey=${encodeURIComponent(existingOriginalKey)}`
              : ''
          }`,
        );
        if (!signed || !signed.uploadUrl || !signed.key || !signed.readUrl) {
          console.error("Upload URL failed:", signed);
          setError("Could not get upload URL. Please retry.");
          setLoading(false);
          return;
        }

        const response = await fetch(compressed);
        if (!response.ok) {
          console.error("Failed to fetch compressed image:", response.status, response.statusText);
          setError("Failed to process image for upload.");
          setLoading(false);
          return;
        }

        const blob = await response.blob();

        const uploadResponse = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "image/jpeg",
            "x-amz-server-side-encryption": "AES256",
          },
          body: blob,
        });

        if (!uploadResponse.ok) {
          const errBody = await uploadResponse.text().catch(() => "(no body)");
          console.error("Failed to upload to S3:", uploadResponse.status, uploadResponse.statusText, errBody);
          setError("Failed to upload photo to storage. Check your connection and try again.");
          setLoading(false);
          return;
        }

        setPhotos((prev) => {
          const updated = [...prev];
          updated[cropTargetIndex] = signed.key;
          return updated;
        });
        setPhotoOriginals((prev) => {
          const updated = [...prev];
          updated[cropTargetIndex] = existingOriginalKey;
          return updated;
        });

        // Store readUrl for immediate display
        setPhotoKeyToUrl((prev) => {
          const updated = new Map(prev);
          updated.set(signed.key, signed.readUrl);
          return updated;
        });
      }
    } catch (e: any) {
      console.error("Error in handleCropComplete:", e);
      setError(`Failed to upload cropped photo: ${e.message || "Unknown error"}`);
    } finally {
      setLoading(false);
      setImageToCrop(null);
      setCropTargetIndex(null);
    }
  }

  function handleCropCancel() {
    setCropModalVisible(false);
    setImageToCrop(null);
    setCropTargetIndex(null);
  }


  function removePhoto(i: number) {
    setPhotos((prev) => {
      const updated = [...prev];
      updated[i] = null;
      return updated;
    });
    setPhotoOriginals((prev) => {
      const updated = [...prev];
      updated[i] = null;
      return updated;
    });
  }

  // ----------------------------------------------------------------------
  // Tinder-style drag to reorder photos
  // ----------------------------------------------------------------------
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragPositions = useRef<{ [key: number]: Animated.ValueXY }>({});
  const slotPositions = useRef<{ [key: number]: { x: number; y: number } }>({});
  const isDraggingRef = useRef<boolean>(false);
  const dragThreshold = 10;

  // Initialize animated values and track slot positions
  useEffect(() => {
    photos.forEach((_, index) => {
      if (!dragPositions.current[index]) {
        dragPositions.current[index] = new Animated.ValueXY();
      }
    });
  }, [photos.length]);

  // Measure slot positions on layout
  const measureSlot = (index: number, x: number, y: number) => {
    slotPositions.current[index] = { x, y };
  };

  function createPanResponder(index: number) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        // Start drag if movement exceeds threshold
        return Math.abs(gesture.dx) > dragThreshold || Math.abs(gesture.dy) > dragThreshold;
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = false;
        setDraggingIndex(index);
        // Reset position for new drag
        dragPositions.current[index].setOffset({ x: 0, y: 0 });
        dragPositions.current[index].setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gesture) => {
        if (Math.abs(gesture.dx) > dragThreshold || Math.abs(gesture.dy) > dragThreshold) {
          isDraggingRef.current = true;
          dragPositions.current[index].setValue({ x: gesture.dx, y: gesture.dy });

          // Tinder-style: Check which slot we're hovering over
          const currentSlot = slotPositions.current[index];
          if (currentSlot) {
            const dragX = currentSlot.x + gesture.dx;
            const dragY = currentSlot.y + gesture.dy;

            // Find which slot we're over (using actual slot dimensions)
            let newHoverIndex: number | null = null;
            const slotSize = 100; // Approximate slot size
            
            for (let i = 0; i < 6; i++) {
              const slot = slotPositions.current[i];
              if (slot && i !== index && photosRef.current[i]) {
                const slotCenterX = slot.x + slotSize / 2;
                const slotCenterY = slot.y + slotSize / 2;
                const distance = Math.sqrt(
                  Math.pow(dragX - slotCenterX, 2) + Math.pow(dragY - slotCenterY, 2)
                );
                if (distance < slotSize * 0.7) {
                  newHoverIndex = i;
                  break;
                }
              }
            }

            if (newHoverIndex !== hoverIndex && newHoverIndex !== null) {
              setHoverIndex(newHoverIndex);
              
              // If hovering over a valid slot, swap positions immediately (Tinder-style)
              if (photosRef.current[newHoverIndex]) {
                setPhotos((prev) => {
                  const updated = [...prev];
                  [updated[index], updated[newHoverIndex!]] = [updated[newHoverIndex!], updated[index]];
                  setPhotoOriginals((prevOrig) => {
                    const updatedOrig = [...prevOrig];
                    const currentOrig = photoOriginalsRef.current;
                    const a = currentOrig[index];
                    const b = currentOrig[newHoverIndex!];
                    updatedOrig[index] = b ?? null;
                    updatedOrig[newHoverIndex!] = a ?? null;
                    return updatedOrig;
                  });
                  return updated;
                });
                // Reset hover after swap
                setHoverIndex(null);
                // Reset drag position since we swapped
                dragPositions.current[index].setValue({ x: 0, y: 0 });
              }
            }
          }
        }
      },
      onPanResponderRelease: () => {
        // Animate to final position
        dragPositions.current[index].flattenOffset();
        Animated.spring(dragPositions.current[index], {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start(() => {
          // Reset after animation completes
          dragPositions.current[index].setOffset({ x: 0, y: 0 });
          dragPositions.current[index].setValue({ x: 0, y: 0 });
        });

        setDraggingIndex(null);
        setHoverIndex(null);
        
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 150);
      },
    });
  }

  // Create pan responders for each photo slot
  const panResponders = useRef<{ [key: number]: any }>({});
  const photosRef = useRef(photos);
  const photoOriginalsRef = useRef(photoOriginals);
  
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => {
    photoOriginalsRef.current = photoOriginals;
  }, [photoOriginals]);
  
  useEffect(() => {
    // Recreate pan responders when photos change
    for (let i = 0; i < 6; i++) {
      if (photos[i]) {
        panResponders.current[i] = createPanResponder(i);
      } else {
        delete panResponders.current[i];
      }
    }
  }, [photos]);

  // ----------------------------------------------------------------------
  // Interests
  // ----------------------------------------------------------------------
  function toggleInterest(i: string) {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  }

  // ----------------------------------------------------------------------
  // Check for unsaved changes
  // ----------------------------------------------------------------------
  function hasUnsavedChanges(): boolean {
    if (!originalProfile) return false;

    // Compare photos (filter out nulls and compare arrays)
    const currentPhotos = photos.filter((p): p is string => p !== null);
    const originalPhotos = originalProfile.photos.filter((p): p is string => p !== null);
    
    if (currentPhotos.length !== originalPhotos.length) return true;
    if (currentPhotos.some((p, i) => p !== originalPhotos[i])) return true;

    const currentOriginals = photoOriginals.filter((p): p is string => p !== null);
    const originalOriginals = originalProfile.photoOriginals.filter((p): p is string => p !== null);
    if (currentOriginals.length !== originalOriginals.length) return true;
    if (currentOriginals.some((p, i) => p !== originalOriginals[i])) return true;

    // Compare other fields
    return (
      name !== originalProfile.name ||
      bio !== originalProfile.bio ||
      age !== originalProfile.age ||
      sex !== originalProfile.sex ||
      sexPreference !== originalProfile.sexPreference ||
      datingPreference !== originalProfile.datingPreference ||
      interests.length !== originalProfile.interests.length ||
      interests.some((i) => !originalProfile.interests.includes(i)) ||
      originalProfile.interests.some((i) => !interests.includes(i)) ||
      showSchoolInfo !== originalProfile.showSchoolInfo ||
      (showSchoolInfo &&
        (school.trim() !== originalProfile.school ||
          major.trim() !== originalProfile.major ||
          gradYear.trim() !== originalProfile.gradYear))
    );
  }

  // ----------------------------------------------------------------------
  // Handle back button press
  // ----------------------------------------------------------------------
  function handleBackPress() {
    if (hasUnsavedChanges()) {
      setUnsavedChangesModalVisible(true);
    } else {
      navigation.goBack();
    }
  }

  // ----------------------------------------------------------------------
  // Parse height string to HeightDto object
  // ----------------------------------------------------------------------
  function parseHeightString(heightStr: string): { feet: number; inches: number } | null {
    const match = heightStr.match(/(\d+)'(\d+)"/);
    if (match) {
      const feet = parseInt(match[1], 10);
      const inches = parseInt(match[2], 10);
      return { feet, inches };
    }
    return null;
  }

  // ----------------------------------------------------------------------
  // Save
  // ----------------------------------------------------------------------
  async function save() {
    setError(null);

    const realPhotos = photos.filter((p): p is string => p !== null);
    const realPhotoOriginals = photos.reduce<string[]>((acc, p, idx) => {
      if (p !== null) {
        const original = photoOriginals[idx];
        acc.push(original ?? p);
      }
      return acc;
    }, []);
    if (realPhotos.length < 1) {
      return setError("At least one photo required.");
    }

    // Parse height from string array to HeightDto object
    let heightDto: { feet: number; inches: number } | undefined = undefined;
    if (height.length > 0 && height[0]) {
      const parsed = parseHeightString(height[0]);
      if (parsed) {
        heightDto = parsed;
      }
    }

    const normalizedSchool = school.trim();
    const normalizedMajor = major.trim();
    const parsedGradYear = parseInt(gradYear.trim(), 10);
    const gradYearValue = !Number.isNaN(parsedGradYear) ? parsedGradYear : null;

    setSaving(true);

    try {
      const res = await apiPatch<UserProfile>("/profiles/me", {
        bio,
        sexPreference,
        datingPreference,
        interests,
        photos: realPhotos,
        photoOriginals: realPhotoOriginals,
        height: heightDto,
        race: race.length > 0 ? race : undefined,
        religion: religion.length > 0 ? religion : undefined,
        politics: politics.length > 0 ? politics : undefined,
        education: education.length > 0 ? education : undefined,
        activityLevel: activityLevel || undefined,
        drinking: drinking.length > 0 ? drinking : undefined,
        smoking: smoking.length > 0 ? smoking : undefined,
        marijuana: marijuana.length > 0 ? marijuana : undefined,
        school: normalizedSchool || null,
        major: normalizedMajor || null,
        gradYear: gradYearValue,
      });

      if (!res) {
        setError("Failed to save changes. Please check your connection and try again.");
        return;
      }

      const savedSchool = res.school ?? "";
      const savedMajor = res.major ?? "";
      const savedGradYear =
        res.gradYear !== null && res.gradYear !== undefined ? String(res.gradYear) : "";
      const savedShowSchoolInfo = Boolean(res.school || res.major || res.gradYear);

      setSchool(savedSchool);
      setMajor(savedMajor);
      setGradYear(savedGradYear);
      setShowSchoolInfo(savedShowSchoolInfo);

      // Update the cache with the saved profile data
      setProfile(res);

      // Update original profile to reflect saved state
      const grid: (string | null)[] = [...realPhotos];
      while (grid.length < 6) grid.push(null);
      const originalsGrid: (string | null)[] = [
        ...realPhotoOriginals,
        ...Array(Math.max(0, grid.length - realPhotoOriginals.length)).fill(null),
      ].slice(0, 6);
      setOriginalProfile({
        name,
        bio,
        age,
        sex,
        sexPreference,
        datingPreference,
        interests,
        photos: grid,
        photoOriginals: originalsGrid,
        school: savedSchool,
        major: savedMajor,
        gradYear: savedGradYear,
        showSchoolInfo: savedShowSchoolInfo,
      });

      // Refresh photo statuses after save
      try {
        const statuses = await apiGet<ProfilePhoto[]>("/profiles/me/photo-statuses");
        if (statuses) {
          const statusMap = new Map<string, ProfilePhoto>();
          statuses.forEach((photo) => {
            statusMap.set(photo.url, photo);
          });
          setPhotoStatuses(statusMap);
        }
      } catch {
        // Silently fail
      }

      navigation.goBack();
    } catch (err: any) {
      console.error("Save failed:", err);
      setError("Could not save your changes right now. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------------------------
  // Handle unsaved changes modal actions
  // ----------------------------------------------------------------------
  async function handleSaveAndExit() {
    setUnsavedChangesModalVisible(false);
    await save();
  }

  function handleDiscardAndExit() {
    setUnsavedChangesModalVisible(false);
    navigation.goBack();
  }

  // ----------------------------------------------------------------------
  // Conditional dating preferences
  // ----------------------------------------------------------------------
  let DATING_PREFS =
    age < 25
      ? [
          RAW_DATING_PREFS[0],
          RAW_DATING_PREFS[1],
          RAW_DATING_PREFS[3],
          RAW_DATING_PREFS[4],
          RAW_DATING_PREFS[5],
        ]
      : [
          RAW_DATING_PREFS[0],
          RAW_DATING_PREFS[2],
          RAW_DATING_PREFS[3],
          RAW_DATING_PREFS[4],
          RAW_DATING_PREFS[5],
        ];

  if (!DATING_PREFS.some((p) => p.value === datingPreference)) {
    const saved = RAW_DATING_PREFS.find((p) => p.value === datingPreference);
    if (saved) DATING_PREFS = [saved, ...DATING_PREFS];
  }

  // ----------------------------------------------------------------------
  // LOADING UI
  // ----------------------------------------------------------------------
  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <GlobalBackground />
        <ActivityIndicator size="large" color={colors.text} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading…</Text>
      </View>
    );
  }

  // ----------------------------------------------------------------------
  // MAIN UI
  // ----------------------------------------------------------------------
  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <ImageCropModal
        visible={cropModalVisible}
        imageUri={imageToCrop || ""}
        onCrop={handleCropComplete}
        onCancel={handleCropCancel}
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBackPress}
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

      <TouchableOpacity
        style={[styles.previewBtn, { backgroundColor: colors.card, borderColor: colors.subtitle }]}
        onPress={() => {
          // Map photo keys to display URLs for preview
          const previewPhotos = photos
            .filter((p): p is string => p !== null)
            .map((p) => {
              // If it's already a URL or local file, use it directly
              if (
                p.startsWith("http://") ||
                p.startsWith("https://") ||
                p.startsWith("file://") ||
                p.startsWith("ph://") ||
                p.startsWith("data:")
              ) {
                return p;
              }
              // Otherwise, map the key to its display URL
              return photoKeyToUrl.get(p) || "";
            })
            .filter((p) => Boolean(p));
          const previewPrimary = previewPhotos[0];

          const previewData = {
            name,
            age,
            bio,
            interests,
            photos: previewPhotos,
            profileImageUrl: previewPrimary,
            datingPreference,
            userUid: userUid || undefined,
            school: school || undefined,
            major: major || undefined,
            gradYear: gradYear ? parseInt(gradYear, 10) : undefined,
            showSchoolInfo,
          };
          navigation.navigate("UserProfileView", {
            userId: userUid || "",
            previewData,
          });
        }}
        accessible={true}
        accessibilityLabel="Preview profile"
        accessibilityRole="button"
        accessibilityHint="Opens preview of your profile"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text
          style={[styles.previewBtnText, { color: colors.text }]}
          allowFontScaling={true}
        >
          Preview
        </Text>
      </TouchableOpacity>

      <Text
        style={[styles.title, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Edit Profile
      </Text>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        scrollEnabled={draggingIndex === null}
      >
        {/* Drag overlay - freezes screen while dragging */}
        {draggingIndex !== null && (
          <View 
            style={styles.dragOverlay} 
            pointerEvents="box-none"
          />
        )}

        {/* PHOTO GRID */}
        <View style={styles.photoGrid}>
          {photos.map((p, i) => {
            const panResponder = p ? panResponders.current[i] : null;
            const isDragging = draggingIndex === i;
            const isHovered = hoverIndex === i && draggingIndex !== null && draggingIndex !== i;
            
            // Get display URL: if it's a key, use mapped readUrl; if it's already a URL, use it directly
            const displayUrl = p 
              ? (p.startsWith('http://') || p.startsWith('https://') 
                  ? p 
                  : photoKeyToUrl.get(p) || p)
              : null;
            
            const animatedStyle = dragPositions.current[i]
              ? {
                  transform: [
                    ...dragPositions.current[i].getTranslateTransform(),
                    { scale: isDragging ? 1.05 : isHovered ? 0.95 : 1 },
                  ],
                  zIndex: isDragging ? 1000 : isHovered ? 100 : 1,
                  opacity: isDragging ? 0.9 : isHovered ? 0.7 : 1,
                }
              : {
                  zIndex: isHovered ? 100 : 1,
                  opacity: isHovered ? 0.7 : 1,
                };

            return (
              <Animated.View
                key={i}
                style={[
                  styles.photoBox,
                  { backgroundColor: colors.card, borderColor: colors.subtitle },
                  animatedStyle,
                ]}
                onLayout={(event) => {
                  const { x, y } = event.nativeEvent.layout;
                  measureSlot(i, x, y);
                }}
                {...(panResponder?.panHandlers || {})}
              >
                {p && displayUrl ? (
                  <>
                    <View 
                      style={styles.photoTouchable}
                      accessible={true}
                      accessibilityLabel={`Photo ${i + 1}`}
                      accessibilityRole="image"
                    >
                      <AppImage 
                        source={displayUrl} 
                        style={styles.photo}
                        accessibilityRole="none"
                        priority="normal"
                      />
                      {/* Photo moderation status badge */}
                      {(() => {
                        // p is either an S3 key or a URL - find matching status
                        const photoKey = p; // p is the S3 key stored in photos array
                        const status = photoKey ? photoStatuses.get(photoKey) : null;
                        if (!status || status.status === 'approved') return null;
                        
                        return (
                          <View style={[styles.photoStatusBadge, {
                            backgroundColor: status.status === 'rejected' 
                              ? 'rgba(220, 38, 38, 0.9)' 
                              : status.status === 'pending'
                              ? 'rgba(251, 191, 36, 0.9)'
                              : 'rgba(59, 130, 246, 0.9)',
                          }]}>
                            <Text style={styles.photoStatusText}>
                              {status.status === 'rejected' 
                                ? 'Rejected' 
                                : status.status === 'pending'
                                ? 'Pending'
                                : 'Flagged'}
                            </Text>
                            {status.reason && status.status === 'rejected' && (
                              <Text style={[styles.photoStatusText, { fontSize: 9, marginTop: 2 }]}>
                                {status.reason}
                              </Text>
                            )}
                          </View>
                        );
                      })()}
                      {!isDragging && (
                        <TouchableOpacity
                          style={StyleSheet.absoluteFill}
                          activeOpacity={0.9}
                          accessible={true}
                          accessibilityLabel={`Edit photo ${i + 1}`}
                          accessibilityRole="button"
                          accessibilityHint="Opens photo editor to crop this photo"
                          onPress={async () => {
                            // Only trigger edit if not dragging
                            if (isDraggingRef.current) return;
                             
                            if (!p || !displayUrl) return;
                             
                            const preferredCropSource = (() => {
                              const original = photoOriginals[i];
                              if (original) {
                                if (original.startsWith("http://") || original.startsWith("https://")) {
                                  return original;
                                }
                                const mapped = originalKeyToUrl.get(original);
                                if (mapped) return mapped;
                              }
                              return displayUrl;
                            })();

                            // Check if it's a remote URL (starts with http)
                            if (preferredCropSource.startsWith("http://") || preferredCropSource.startsWith("https://")) {
                              setLoading(true);
                              try {
                                // Download the remote image using fetch and convert to blob, then to data URI
                                const response = await fetch(preferredCropSource);
                                const blob = await response.blob();
                                 
                                // Convert blob to base64 data URI
                                const reader = new FileReader();
                                const dataUri = await new Promise<string>((resolve, reject) => {
                                  reader.onloadend = () => {
                                    if (typeof reader.result === 'string') {
                                      resolve(reader.result);
                                    } else {
                                      reject(new Error('Failed to convert blob to data URI'));
                                    }
                                  };
                                  reader.onerror = reject;
                                  reader.readAsDataURL(blob);
                                });
                                
                                // Use the data URI for cropping
                                setImageToCrop(dataUri);
                                setCropTargetIndex(i);
                                setCropModalVisible(true);
                              } catch (error: any) {
                                console.error("Failed to download image:", error);
                                setError("Failed to download image for editing.");
                              } finally {
                                setLoading(false);
                              }
                            } else {
                              // It's already a local URI (shouldn't happen with S3, but handle gracefully)
                              setImageToCrop(preferredCropSource);
                              setCropTargetIndex(i);
                              setCropModalVisible(true);
                            }
                          }}
                        />
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removePhoto(i)}
                      accessible={true}
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      accessibilityRole="button"
                      accessibilityHint="Removes this photo"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text 
                        style={styles.removeX}
                        allowFontScaling={true}
                        accessible={false}
                        importantForAccessibility="no"
                      >
                        ×
                      </Text>
                    </TouchableOpacity>
                    {isDragging && (
                      <View style={styles.dragIndicator}>
                        <Text style={styles.dragIndicatorText}>↕</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.addSlot}
                    onPress={() => pickPhoto(i)}
                    accessible={true}
                    accessibilityLabel={`Add photo ${i + 1}`}
                    accessibilityRole="button"
                    accessibilityHint="Adds a photo to this slot"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text 
                      style={[styles.plus, { color: colors.subtitle }]}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.addPhotoBtn, 
            { 
              backgroundColor: colors.accent,
              opacity: draggingIndex !== null ? 0.5 : 1,
            }
          ]}
          onPress={() => pickPhoto()}
          disabled={draggingIndex !== null}
          accessible={true}
          accessibilityLabel="Add Photos"
          accessibilityRole="button"
          accessibilityHint="Adds multiple photos to your profile"
          accessibilityState={{ disabled: draggingIndex !== null }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text 
            style={[styles.addPhotoText, { color: colors.buttonText }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            Add Photos
          </Text>
        </TouchableOpacity>

        {/* BIO */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          About You:
        </Text>

        <TextInput
          style={[
            styles.bioInput,
            { backgroundColor: colors.card, color: colors.text },
          ]}
          value={bio}
          onChangeText={(text) => {
            const cleaned = text.replace(/\n/g, " ");
            const lower = cleaned.toLowerCase();
            if (FLAGGED_WORDS.some((w) => lower.includes(w))) {
              Alert.alert("Bio blocked", "Please remove flagged words and try again.");
              return;
            }
            setBio(cleaned);
          }}
          multiline
          placeholder="Write something about yourself…"
          placeholderTextColor={colors.subtitle}
          accessible={true}
          accessibilityLabel="Bio"
          accessibilityRole="none"
          accessibilityHint="Write something about yourself"
          allowFontScaling={true}
        />

        {/* SEX PREF */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Interested In:
        </Text>

        <View 
          style={styles.selectorRow}
          accessible={false}
          importantForAccessibility="no"
        >
          {ALL_PREFS.map((p) => {
            const label = p === "male" ? "Men" : p === "female" ? "Women" : "Everyone";
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setSexPreference(p)}
                style={[
                  styles.selector,
                  {
                    backgroundColor:
                      sexPreference === p ? colors.accent : colors.card,
                    borderColor: colors.subtitle,
                  },
                ]}
                accessible={true}
                accessibilityLabel={label}
                accessibilityRole="button"
                accessibilityState={{ selected: sexPreference === p }}
                accessibilityHint={`Selects interest in ${label.toLowerCase()}`}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={{
                    color:
                      sexPreference === p ? colors.buttonText : colors.text,
                    fontWeight: "600",
                  }}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* DATING PREF */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Dating Preference:
        </Text>

        <View 
          style={styles.selectorColumn}
          accessible={false}
          importantForAccessibility="no"
        >
          {DATING_PREFS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setDatingPreference(p.value)}
              style={[
                styles.selector,
                {
                  backgroundColor:
                    datingPreference === p.value ? colors.accent : colors.card,
                  borderColor: colors.subtitle,
                },
              ]}
              accessible={true}
              accessibilityLabel={p.label}
              accessibilityRole="button"
              accessibilityState={{ selected: datingPreference === p.value }}
              accessibilityHint={`Selects ${p.label.toLowerCase()} as dating preference`}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={{
                  color:
                    datingPreference === p.value
                      ? colors.buttonText
                      : colors.text,
                  fontWeight: "600",
                }}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {school.trim().length > 0 && (
          <>
            {/* SCHOOL INFO */}
            <Text 
              style={[styles.sectionTitle, { color: colors.text, marginTop: 30 }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              School Info:
            </Text>

            {/*
            <View 
              style={styles.schoolToggleRow}
              accessible={false}
              importantForAccessibility="no"
            >
              <Text 
                style={[styles.smartDesc, { color: colors.subtitle }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Show on your card
              </Text>
              <Switch
                value={showSchoolInfo}
                onValueChange={setShowSchoolInfo}
                thumbColor={showSchoolInfo ? colors.card : colors.subtitle}
                trackColor={{ true: colors.accent, false: colors.card }}
                accessible={true}
                accessibilityLabel="Show school info"
                accessibilityRole="switch"
                accessibilityHint="Toggles whether your school info appears on your profile card"
                accessibilityState={{ checked: showSchoolInfo }}
              />
            </View>

            <Text 
              style={[styles.mutedText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              We only display these fields if this toggle is on.
            </Text>
            */}

            <TextInput
              style={[
                styles.infoInput,
                {
                  backgroundColor: colors.card,
                  color: colors.subtitle,
                  borderColor: colors.subtitle,
                },
              ]}
              value={school}
              editable={false}
              selectTextOnFocus={false}
              placeholder="School name"
              placeholderTextColor={colors.subtitle}
              accessibilityLabel="School"
              accessibilityHint="Autofilled from your verified email"
              allowFontScaling={true}
            />

            <TextInput
              style={[
                styles.infoInput,
                {
                  backgroundColor: colors.card,
                  color: showSchoolInfo ? colors.text : colors.subtitle,
                  borderColor: colors.subtitle,
                },
              ]}
              value={major}
              onChangeText={setMajor}
              placeholder="Major (optional)"
              placeholderTextColor={colors.subtitle}
              editable={showSchoolInfo}
              accessibilityLabel="Major"
              accessibilityHint="Your field of study"
              allowFontScaling={true}
            />

            <TextInput
              style={[
                styles.infoInput,
                {
                  backgroundColor: colors.card,
                  color: showSchoolInfo ? colors.text : colors.subtitle,
                  borderColor: colors.subtitle,
                },
              ]}
              value={gradYear}
              onChangeText={setGradYear}
              placeholder="Graduation year (YYYY)"
              placeholderTextColor={colors.subtitle}
              editable={showSchoolInfo}
              keyboardType="numeric"
              accessibilityLabel="Graduation year"
              accessibilityHint="Your expected graduation year"
              allowFontScaling={true}
            />
          </>
        )}

        {/* PERSONAL DETAILS */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text, marginTop: 30 }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Personal Details:
        </Text>

        <MultiSelectPills
          label="Race"
          values={race}
          options={RACE_OPTIONS}
          onToggle={(val) =>
            setRace((prev) => {
              if (prev.includes(val)) {
                return prev.filter((v) => v !== val);
              }
              if (prev.length >= 2) {
                return prev;
              }
              return [...prev, val];
            })
          }
        />

        <SingleSelectPills
          label="Religion"
          value={religion.length > 0 ? religion[0] : ""}
          options={RELIGION_OPTIONS}
          onSelect={(val) => setReligion(val === (religion.length > 0 ? religion[0] : "") ? [] : [val])}
        />

        <SingleSelectPills
          label="Political Views"
          value={politics.length > 0 ? politics[0] : ""}
          options={POLITICS_OPTIONS}
          onSelect={(val) => setPolitics(val === (politics.length > 0 ? politics[0] : "") ? [] : [val])}
        />

        <SingleSelectPills
          label="Education"
          value={education.length > 0 ? education[0] : ""}
          options={EDUCATION_OPTIONS}
          onSelect={(val) => setEducation(val === (education.length > 0 ? education[0] : "") ? [] : [val])}
        />

        <SingleSelectPills
          label="Activity Level"
          value={activityLevel}
          options={ACTIVITY_LEVEL_OPTIONS}
          onSelect={(val) => setActivityLevel(val === activityLevel ? "" : val)}
        />

        <SingleSelectPills
          label="Drinking"
          value={drinking.length > 0 ? drinking[0] : ""}
          options={DRINKING_OPTIONS}
          onSelect={(val) => setDrinking(val === (drinking.length > 0 ? drinking[0] : "") ? [] : [val])}
        />

        <SingleSelectPills
          label="Smoking"
          value={smoking.length > 0 ? smoking[0] : ""}
          options={SMOKING_OPTIONS}
          onSelect={(val) => setSmoking(val === (smoking.length > 0 ? smoking[0] : "") ? [] : [val])}
        />

        <SingleSelectPills
          label="Marijuana"
          value={marijuana.length > 0 ? marijuana[0] : ""}
          options={MARIJUANA_OPTIONS}
          onSelect={(val) => setMarijuana(val === (marijuana.length > 0 ? marijuana[0] : "") ? [] : [val])}
        />

        {/* INTERESTS */}
        <Text 
          style={[styles.sectionTitle, { color: colors.text, marginTop: 30 }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Interests
        </Text>

        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: colors.card, color: colors.text },
          ]}
          placeholder="Search interests…"
          placeholderTextColor={colors.subtitle}
          value={interestSearch}
          onChangeText={setInterestSearch}
          accessible={true}
          accessibilityLabel="Search interests"
          accessibilityRole="none"
          accessibilityHint="Search for interests to add"
          allowFontScaling={true}
        />

        <View 
          style={styles.interestGrid}
          accessible={false}
          importantForAccessibility="no"
        >
          {INTERESTS.filter((i) =>
            i.toLowerCase().includes(interestSearch.toLowerCase())
          )
            .slice(0, showAllInterests ? INTERESTS.length : 16)
            .map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => toggleInterest(i)}
                style={[
                  styles.interestChip,
                  {
                    backgroundColor: interests.includes(i)
                      ? colors.accent
                      : colors.card,
                    borderColor: colors.subtitle,
                  },
                ]}
                accessible={true}
                accessibilityLabel={i}
                accessibilityRole="button"
                accessibilityState={{ selected: interests.includes(i) }}
                accessibilityHint={`${interests.includes(i) ? "Removes" : "Adds"} interest: ${i}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={{
                    color: interests.includes(i)
                      ? colors.buttonText
                      : colors.text,
                  }}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  {i}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* Show more */}
        {INTERESTS.filter((i) =>
          i.toLowerCase().includes(interestSearch.toLowerCase())
        ).length > 20 && (
          <TouchableOpacity
            onPress={() => setShowAllInterests(!showAllInterests)}
            style={styles.expandButton}
            accessible={true}
            accessibilityLabel={showAllInterests ? "Show less interests" : "Show more interests"}
            accessibilityRole="button"
            accessibilityHint={showAllInterests ? "Shows fewer interests" : "Shows all available interests"}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.expandButtonText, { color: colors.accent }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {showAllInterests ? "Show less" : "Show more"}
            </Text>
          </TouchableOpacity>
        )}

        {error && <InlineAlert message={error} style={{ marginTop: 12 }} />}

        {/* SAVE */}
        <TouchableOpacity
          style={[
            styles.saveBtn, 
            { 
              backgroundColor: colors.accent,
              opacity: draggingIndex !== null || saving || uploading ? 0.6 : 1,
            }
          ]}
          onPress={save}
          disabled={draggingIndex !== null || saving || uploading}
          accessible={true}
          accessibilityLabel="Save Changes"
          accessibilityRole="button"
          accessibilityHint="Saves all profile changes"
          accessibilityState={{ disabled: draggingIndex !== null || saving || uploading }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {saving ? (
            <ActivityIndicator color={colors.buttonText} />
          ) : (
            <Text 
              style={[styles.saveText, { color: colors.buttonText }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* UNSAVED CHANGES MODAL */}
      <Modal
        visible={unsavedChangesModalVisible}
        transparent
        animationType="fade"
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View
          style={styles.modalOverlay}
          accessible={false}
          importantForAccessibility="no"
        >
          <View
            style={[styles.modalBox, { backgroundColor: colors.card }]}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Save Profile?
            </Text>
            <Text
              style={[styles.modalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              You have unsaved changes. What would you like to do?
            </Text>

            <View
              style={styles.modalButtonsRow}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setUnsavedChangesModalVisible(false)}
                accessible={true}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                accessibilityHint="Cancels and returns to editing"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalCancelText, { color: colors.subtitle }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDiscardBtn,
                  { borderColor: colors.subtitle },
                ]}
                onPress={handleDiscardAndExit}
                accessible={true}
                accessibilityLabel="Discard Changes"
                accessibilityRole="button"
                accessibilityHint="Discards all changes and goes back"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalDiscardText, { color: colors.text }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Discard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleSaveAndExit}
                accessible={true}
                accessibilityLabel="Save and Exit"
                accessibilityRole="button"
                accessibilityHint="Saves all changes and goes back"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalConfirmText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

//
// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
//
const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },

  container: {
    paddingBottom: 200,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: { marginTop: 10, fontSize: 16 },

  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },

  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },

  previewBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: Platform.OS === "ios" ? 36 : 40,
    justifyContent: "center",
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  dragOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    zIndex: 500,
  },

  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  photoBox: {
    width: "31%",
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  dragIndicator: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 4,
  },
  dragIndicatorText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },

  photo: {
    width: "100%",
    height: "100%",
  },

  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#0007",
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
  },

  removeX: {
    color: "white",
    fontSize: 20,
    marginTop: -2,
  },

  photoTouchable: {
    width: "100%",
    height: "100%",
  },

  addSlot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  plus: {
    fontSize: 42,
    fontWeight: "200",
  },

  addPhotoBtn: {
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 20,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  addPhotoText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 14,
  },

  bioInput: {
    padding: 14,
    borderRadius: 12,
    minHeight: 120,
    textAlignVertical: "top",
    fontSize: 16,
  },

  infoInput: {
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
  },

  schoolToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  mutedText: {
    fontSize: 13,
    marginBottom: 10,
  },

  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },

  selectorColumn: {
    flexDirection: "column",
  },

  selector: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    marginRight: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  searchInput: {
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 10,
  },

  interestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },

  interestChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    margin: 6,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  expandButton: {
    paddingVertical: 10,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  expandButtonText: {
    fontSize: 16,
  },

  label: {
    fontSize: 16,
    marginBottom: 8,
  },

  sliderContainer: {
    marginBottom: 20,
  },

  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  sliderTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 10,
  },

  sliderFill: {
    height: "100%",
    borderRadius: 2,
  },

  sliderValue: {
    fontSize: 14,
    minWidth: 30,
  },

  sliderLabel: {
    fontSize: 16,
    marginBottom: 8,
  },

  sliderButton: {
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 5,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  smartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  smartDesc: {
    flex: 1,
    paddingRight: 12,
    fontSize: 15,
  },

  errorText: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 16,
  },

  saveBtn: {
    padding: 16,
    borderRadius: 12,
    marginTop: 32,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  saveText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalBox: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },

  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },

  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalDiscardBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalDiscardText: {
    fontSize: 16,
    fontWeight: "600",
  },

  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },

  modalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
  },

  photoStatusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },

  photoStatusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
