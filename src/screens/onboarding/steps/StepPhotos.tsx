//********************************************************************
//
// StepPhotos Component
//
// Step 6 of onboarding flow. Allows user to add, crop, remove, and
// drag-to-reorder photos. Supports up to 6 photos. Clicking an empty
// slot opens multi-selection picker. Clicking an existing photo opens
// crop modal. Photos can be dragged to reorder. At least one photo
// is required to continue.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing photos step
//
// Value Parameters
// ----------------
// colors                Object              Theme colors object
// photos                (string|null)[]     Current photos array
// draggingIndex         number|null         Index of photo being dragged
// hoverIndex            number|null         Index of photo being hovered over
// cropModalVisible      boolean             Whether crop modal is visible
// imageToCrop           string|null         URI of image to crop
// cropTargetIndex       number|null         Target index for cropped image
// error                 string|null         Error message
// setPhotos             function            Photos setter
// setDraggingIndex      function            Dragging index setter
// setHoverIndex         function            Hover index setter
// setCropModalVisible   function            Crop modal visibility setter
// setImageToCrop        function            Image to crop URI setter
// setCropTargetIndex    function            Crop target index setter
// setError              function            Error setter
// pickPhoto             function            Function to open photo picker
// handleCropComplete    function            Function to handle crop completion
// handleCropCancel      function            Function to handle crop cancellation
// removePhoto           function            Function to remove a photo
// panResponders         Object              Pan responder objects for drag
// dragPositions         Object              Animated position values
// measureSlot           function            Function to measure slot position
// isDraggingRef         Ref                 Ref tracking if drag is active
// onContinue            function            Callback to advance to next step
// onBack                function            Callback to go back
//
// Reference Parameters
// --------------------
// None
//
// Local State
// -----------
// None
//
// Side Effects
// ------------
// Opens image picker (native modal)
// Opens crop modal (React Native Modal)
//
//*******************************************************************

import { View, Text, TouchableOpacity, Animated, StyleSheet, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ImageCropModal } from "../../../components/ImageCropModal";
import { ScreenWrap } from "../components/ScreenWrap";
import { onboardingStyles } from "../styles";
import { AppImage } from "../../../components/AppImage";

interface StepPhotosProps {
  colors: any;
  photos: (string | null)[];
  draggingIndex: number | null;
  hoverIndex: number | null;
  cropModalVisible: boolean;
  imageToCrop: string | null;
  cropTargetIndex: number | null;
  error: string | null;
  setDraggingIndex: (index: number | null) => void;
  setHoverIndex: (index: number | null) => void;
  pickPhoto: (index?: number) => Promise<void>;
  handleCropComplete: (croppedUri: string) => Promise<void>;
  handleCropCancel: () => void;
  removePhoto: (index: number) => void;
  panResponders: { [key: number]: any };
  dragPositions: { [key: number]: Animated.ValueXY };
  measureSlot: (index: number, x: number, y: number) => void;
  isDraggingRef: React.MutableRefObject<boolean>;
  onContinue: () => void;
  onBack: () => void;
}

export function StepPhotos({
  colors,
  photos,
  draggingIndex,
  hoverIndex,
  cropModalVisible,
  imageToCrop,
  error,
  pickPhoto,
  handleCropComplete,
  handleCropCancel,
  removePhoto,
  panResponders,
  dragPositions,
  measureSlot,
  isDraggingRef,
  onContinue,
  onBack,
}: StepPhotosProps) {
  return (
    <ScreenWrap scrollEnabled={draggingIndex === null}>
      <ImageCropModal
        visible={cropModalVisible}
        imageUri={imageToCrop || ""}
        onCrop={handleCropComplete}
        onCancel={handleCropCancel}
      />

      <TouchableOpacity
        onPress={onBack}
        style={onboardingStyles.back}
        accessible={true}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        accessibilityHint="Returns to previous step"
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

      <Text
        style={[onboardingStyles.header, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Add photos
      </Text>

      <Text
        style={[onboardingStyles.subheader, { color: colors.subtitle }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        At least one required
      </Text>
      <Text
        style={[onboardingStyles.caption, { color: colors.subtitle, marginTop: 4 }]}
        accessible={true}
        accessibilityRole="text"
        allowFontScaling={true}
      >
        Upload only photos you own. Offensive or unsafe content may be removed during moderation.
      </Text>

      {/* Drag overlay - freezes screen while dragging */}
      {draggingIndex !== null && (
        <View style={onboardingStyles.dragOverlay} pointerEvents="box-none" />
      )}

      <View
        style={onboardingStyles.photoGrid}
        accessible={false}
        importantForAccessibility="no"
      >
        {photos.map((p, idx) => {
          const panResponder = p ? panResponders[idx] : null;
          const isDragging = draggingIndex === idx;
          const isHovered = hoverIndex === idx && draggingIndex !== null && draggingIndex !== idx;

          const animatedStyle = dragPositions[idx]
            ? {
                transform: [
                  ...dragPositions[idx].getTranslateTransform(),
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
              key={idx}
              style={[
                onboardingStyles.photoBox,
                { backgroundColor: colors.card, borderColor: colors.subtitle, borderWidth: 1 },
                animatedStyle,
              ]}
              onLayout={(event) => {
                const { x, y } = event.nativeEvent.layout;
                measureSlot(idx, x, y);
              }}
              {...(panResponder?.panHandlers || {})}
            >
              {p ? (
                <>
                  <View
                    style={onboardingStyles.photoTouchable}
                    accessible={true}
                    accessibilityLabel={`Photo ${idx + 1}`}
                    accessibilityRole="image"
                  >
                    <AppImage
                      source={p}
                      style={onboardingStyles.photo}
                      accessibilityRole="none"
                      priority="normal"
                    />
                    {!isDragging && (
                      <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={0.9}
                        accessible={true}
                        accessibilityLabel={`Edit photo ${idx + 1}`}
                        accessibilityRole="button"
                        accessibilityHint="Opens photo editor to crop this photo"
                        onPress={async () => {
                          if (isDraggingRef.current) return;
                          if (!p) return;
                          await pickPhoto(idx);
                        }}
                      />
                    )}
                  </View>
                  <TouchableOpacity
                    style={onboardingStyles.removeBtn}
                    onPress={() => removePhoto(idx)}
                    accessible={true}
                    accessibilityLabel={`Remove photo ${idx + 1}`}
                    accessibilityRole="button"
                    accessibilityHint="Removes this photo"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={onboardingStyles.removeX}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      ×
                    </Text>
                  </TouchableOpacity>
                  {isDragging && (
                    <View style={onboardingStyles.dragIndicator}>
                      <Text style={onboardingStyles.dragIndicatorText}>↕</Text>
                    </View>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={onboardingStyles.addSlot}
                  onPress={() => pickPhoto()}
                  accessible={true}
                  accessibilityLabel={`Add photo ${idx + 1}`}
                  accessibilityRole="button"
                  accessibilityHint="Adds photos to your profile"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[onboardingStyles.addPhotoText, { color: colors.subtitle }]}
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

      {error && (
        <Text
          style={[onboardingStyles.error, { color: "red" }]}
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={`Error: ${error}`}
          allowFontScaling={true}
        >
          {error}
        </Text>
      )}

      <TouchableOpacity
        style={[onboardingStyles.mainButton, { backgroundColor: colors.accent }]}
        onPress={() => {
          const realPhotos = photos.filter((p) => p !== null);
          if (realPhotos.length < 1) {
            Alert.alert(
              "Required Field",
              "Please add at least one photo to continue.",
              [{ text: "OK" }]
            );
            return;
          }
          onContinue();
        }}
        accessible={true}
        accessibilityLabel="Continue"
        accessibilityRole="button"
        accessibilityHint="Continues to next step"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text
          style={[onboardingStyles.mainButtonText, { color: colors.buttonText }]}
          allowFontScaling={true}
          accessible={false}
          importantForAccessibility="no"
        >
          Continue
        </Text>
      </TouchableOpacity>
    </ScreenWrap>
  );
}

