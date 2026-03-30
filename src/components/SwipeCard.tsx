//********************************************************************
//
// SwipeCard Component
//
// Renders a single profile card with photo, name, age, distance, dating
// preference, and bio. Strictly presentational component optimized to
// avoid unnecessary re-renders during heavy gesture operations in
// SwipeDeck. Supports photo cycling via tap gestures on left/right halves
// of the image. Uses React.memo for performance optimization.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the profile card
//
// Value Parameters
// ----------------
// profile          UserProfile            Profile data to display
// onPressProfile   function|undefined     Optional callback for profile tap
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// firstName            string                      Extracted first name from full name
// photos               string[]                    Array of photo URLs (with fallback)
// currentImageIndex    number                      Index of currently displayed photo
// previousProfileId    string                      Previous profile ID for reset detection (ref)
// pressStartRef        Object|null                 Press start tracking data (ref)
// currentImageUrl      string                      Currently displayed photo URL
// profileLabel         string                      Accessibility label for photo
// distanceText         string                      Distance text for accessibility
// fullLabel            string                      Complete accessibility label
// hasMultiplePhotos    boolean                     Whether profile has multiple photos
// now                  number                      Current timestamp
// x                    number                      X coordinate of press event
// y                    number                      Y coordinate of press event
// duration             number                      Duration of press gesture
// dx                   number                      Horizontal movement delta
// dy                   number                      Vertical movement delta
//
//*******************************************************************

import { View, Text, StyleSheet, Pressable, Animated, TouchableOpacity, Modal, Alert } from "react-native";
import { memo, useMemo, useRef, useState, useEffect } from "react";
import type { UserProfile } from "../types/user";
import { getDatingPreferenceLabel } from "../utils/datingPreference";
import { normalizePhotos } from "../utils/photoUtils";
import { AppImage } from "./AppImage";
import { useTheme } from "../context/ThemeProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../context/AuthContext";
import { apiPost } from "../services/apiService";
import { buildCardPalette, ensureContrastingColor, isDarkColor } from "../utils/cardPalette";

interface Props {
  profile: UserProfile;
  onPressProfile?: (userId: string) => void;
}

export const SwipeCard = memo(function SwipeCard({ profile, onPressProfile }: Props) {
  const { colors } = useTheme();
  const { idToken } = useAuth();
  const firstName = useMemo(() => profile.name.split(" ")[0], [profile.name]);
  const [showMenu, setShowMenu] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const isDarkBackground = useMemo(
    () => isDarkColor(colors.background),
    [colors.background],
  );
  const cardPalette = useMemo(
    () => buildCardPalette(colors.background),
    [colors.background],
  );
  const isMissouriState =
    profile.school?.toLowerCase().includes("missouri state") ?? false;
  const baseSchoolColor =
    (colors.accent as string | undefined) ||
    (isDarkBackground ? "#8aa0ff" : "#2d4cff");
  const schoolColor = isMissouriState
    ? "#5D001E"
    : ensureContrastingColor(
        baseSchoolColor,
        cardPalette.surface,
        cardPalette.text,
      );

  // Normalize photos using centralized utility (prevents divergence with ProfileScreen)
  const photos = useMemo(() => {
    const normalized = normalizePhotos(profile.photos, profile.profileImageUrl);
    // Ensure fallback to profileImageUrl if nothing else
    if (!normalized.length && profile.profileImageUrl) {
      return [profile.profileImageUrl];
    }
    return normalized;
  }, [profile.photos, profile.profileImageUrl]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const previousProfileId = useRef(profile.id);
  const pressStartRef = useRef<{ time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (previousProfileId.current !== profile.id) {
      setCurrentImageIndex(0);
      previousProfileId.current = profile.id;
    }
  }, [profile.id]);

  //********************************************************************
  //
  // handlePressIn Function
  //
  // Handles press start on left or right half of photo. Records timestamp
  // and position for tap detection. Only active if multiple photos exist.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // side    'left'|'right'    Which half of photo was pressed
  // event   any                Press event object
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // now    number    Current timestamp
  // x      number    X coordinate from event
  // y      number    Y coordinate from event
  //
  //*******************************************************************
  const handlePressIn = (side: 'left' | 'right', event: any) => {
    if (photos.length <= 1) return;
    
    const now = Date.now();
    const x = event.nativeEvent?.pageX ?? 0;
    const y = event.nativeEvent?.pageY ?? 0;
    
    pressStartRef.current = { time: now, x, y };
  };

  //********************************************************************
  //
  // handlePressOut Function
  //
  // Handles press end on left or right half of photo. Detects if gesture
  // was a quick tap (< 200ms, < 10px movement) and cycles photos accordingly.
  // Left tap cycles backward, right tap cycles forward.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // side    'left'|'right'    Which half of photo was released
  // event   any                Release event object
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // now      number    Current timestamp
  // duration number    Duration of press gesture
  // x        number    X coordinate from event
  // y        number    Y coordinate from event
  // dx       number    Horizontal movement delta
  // dy       number    Vertical movement delta
  //
  //*******************************************************************
  const handlePressOut = (side: 'left' | 'right', event: any) => {
    if (photos.length <= 1 || !pressStartRef.current) {
      pressStartRef.current = null;
      return;
    }
    
    const now = Date.now();
    const duration = now - pressStartRef.current.time;
    const x = event.nativeEvent?.pageX ?? pressStartRef.current.x;
    const y = event.nativeEvent?.pageY ?? pressStartRef.current.y;
    const dx = Math.abs(x - pressStartRef.current.x);
    const dy = Math.abs(y - pressStartRef.current.y);
    
    if (duration < 200 && dx < 10 && dy < 10) {
      if (side === 'right') {
        setCurrentImageIndex((prev) => (prev + 1) % photos.length);
      } else {
        setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length);
      }
    }
    
    pressStartRef.current = null;
  };

  const currentImageUrl = photos.length > 0 && currentImageIndex < photos.length 
    ? photos[currentImageIndex] 
    : null;
  const profileLabel = `Photo of ${firstName}, age ${profile.age}`;
  const distanceText = profile.distance !== undefined ? `, ${profile.distance} miles away` : "";
  const fullLabel = `${profileLabel}${distanceText}`;
  const hasMultiplePhotos = photos.length > 1;

  const handleBlock = async () => {
    if (!idToken) {
      Alert.alert("Error", "You must be logged in to block a user.");
      return;
    }

    Alert.alert(
      "Block User",
      `Are you sure you want to block ${firstName}? You won't see each other anymore.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBlocking(true);
            try {
              await apiPost(`/blocks/${profile.userUid}`, {}, idToken);
              Alert.alert("Success", `${firstName} has been blocked.`);
              setShowMenu(false);
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to block user.");
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[styles.card, { backgroundColor: cardPalette.surface }]}
      accessible={false}
      importantForAccessibility="no"
    >
      <View style={styles.photoContainer}>
        {currentImageUrl ? (
          <AppImage
            source={currentImageUrl}
            style={styles.photo}
            accessibilityLabel={fullLabel}
            accessibilityRole="image"
            priority="high"
          />
        ) : (
          <View style={[styles.photo, { backgroundColor: "#eaeaea", justifyContent: "center", alignItems: "center" }]}>
            <Text style={{ color: "#999", fontSize: 16 }}>No Photo</Text>
          </View>
        )}
        {hasMultiplePhotos && (
          <>
            <Pressable
              style={styles.photoLeftHalf}
              onPressIn={(e) => handlePressIn('left', e)}
              onPressOut={(e) => handlePressOut('left', e)}
              delayLongPress={300}
              accessible={false}
              importantForAccessibility="no"
            />
            <Pressable
              style={styles.photoRightHalf}
              onPressIn={(e) => handlePressIn('right', e)}
              onPressOut={(e) => handlePressOut('right', e)}
              delayLongPress={300}
              accessible={false}
              importantForAccessibility="no"
            />
          </>
        )}
      </View>

      <View style={styles.info} accessible={false} importantForAccessibility="no">
        <View style={styles.nameRow} accessible={false} importantForAccessibility="no">
          <Text 
            style={[styles.name, { color: cardPalette.text }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {firstName}
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
              style={[styles.distance, { color: cardPalette.muted }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {" • "}{profile.distance} mi
            </Text>
          )}
        </View>

        {profile.school && profile.showSchoolInfo ? (
          <View
            style={[
              styles.schoolCard,
              {
                backgroundColor: isMissouriState ? "#5D001E" : schoolColor + "1A",
                borderColor: isMissouriState ? "#5D001E" : schoolColor,
              },
            ]}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`School: ${profile.school}${profile.major ? `, ${profile.major}` : ""}${profile.gradYear ? `, class of ${profile.gradYear}` : ""}`}
          >
            <Text style={[styles.schoolName, { color: isMissouriState ? "#FFFFFF" : schoolColor }]} numberOfLines={1}>
              {profile.school}
            </Text>
            {(profile.major || profile.gradYear) && (
              <Text
                style={[styles.schoolSub, { color: isMissouriState ? "rgba(255,255,255,0.75)" : cardPalette.subtitle }]}
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
          style={[styles.prefPill, { backgroundColor: cardPalette.pill }]}
          accessible={true}
          accessibilityLabel={getDatingPreferenceLabel(profile.datingPreference, profile.age)}
          accessibilityRole="text"
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

        {profile.bio ? (
          <Text 
            style={[styles.bio, { color: cardPalette.subtitle }]} 
            numberOfLines={4}
            allowFontScaling={true}
            accessible={true}
            accessibilityLabel={`Bio: ${profile.bio}`}
            accessibilityRole="text"
          >
            {profile.bio}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },

    elevation: 8,
  },

  photoContainer: {
    width: "100%",
    height: "68%",
    position: "relative",
  },

  photo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
    backgroundColor: "#eaeaea",
  },

  photoLeftHalf: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "50%",
    height: "100%",
  },

  photoRightHalf: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "50%",
    height: "100%",
  },

  info: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 18,
    flexGrow: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 0,
  },

  name: {
    color: "#111",
    fontSize: 30,
    fontWeight: "700",
    includeFontPadding: false,
  },

  age: {
    marginLeft: 6,
    fontSize: 26,
    paddingBottom: 1.5,
    color: "#333",
  },

  distance: {
    marginLeft: 6,
    fontSize: 18,
    color: "#555",
    paddingBottom: 6,
  },

  prefPill: {
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 6,
    alignSelf: "flex-start",
  },

  prefText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "700",
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

  bio: {
    color: "#222",
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
});
