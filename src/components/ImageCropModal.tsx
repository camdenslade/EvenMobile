//********************************************************************
//
// ImageCropModal Component
//
// Instagram-style image cropping modal with simultaneous pinch and pan
// gestures. Features intelligent auto-contrast grid (samples center of
// image to determine light/dark), grid fade-in during gestures and
// fade-out after 400ms idle, theme-based background masks, accurate crop
// mathematics, and padding-based cover sizing to prevent black bars.
// Uses react-native-gesture-handler for pinch and PanResponder for pan.
//
// Return Value
// ------------
// React.ReactElement|null    JSX element representing the crop modal or null
//
// Value Parameters
// ----------------
// visible      boolean         Whether modal is visible
// imageUri     string          URI of image to crop
// onCrop       function        Callback with cropped image URI
// onCancel     function        Callback to cancel cropping
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors           Object                  Theme colors
// isDark           boolean                 Whether dark theme is active
// imageSize        Object                  Original image dimensions
// displayedSize    Object                  Display dimensions after cover + padding
// gridColor        string                  Grid color (white/black based on brightness)
// gridOpacity      Animated.Value          Animated opacity for grid fade
// gridFadeTimeout  NodeJS.Timeout|null     Timeout reference for grid fade-out
// scale            Animated.Value          Scale animation value
// baseScale        number                  Base scale value (ref)
// pinchStartScale  number                  Scale when pinch started (ref)
// translateX       Animated.Value          Horizontal translation animation
// translateY       Animated.Value          Vertical translation animation
// offsetX          number                  X offset accumulation (ref)
// offsetY          number                  Y offset accumulation (ref)
// pinchRef         Ref                     Reference to pinch gesture handler
// cropX            number                  Crop window X position
// cropY            number                  Crop window Y position
// maskColor        string                  Background mask color
// borderBottomColor string                  Border color for nav bar
// small            Object                  Resized 3x3 image for brightness detection
// raw              string                  Base64 decoded image data
// bright           number                  Calculated brightness value
// r                number                  Red channel value
// g                number                  Green channel value
// b                number                  Blue channel value
// base             number                  Base scale for cover sizing
// s                number                  Final scale value
// imgW             number                  Scaled image width
// imgH             number                  Scaled image height
// dx               number                  Final X translation
// dy               number                  Final Y translation
// imageLeft        number                  Left edge of displayed image
// imageTop         number                  Top edge of displayed image
// scaleX           number                  X scale factor (original to displayed)
// scaleY           number                  Y scale factor (original to displayed)
// originX          number                  Crop origin X in original image coords
// originY          number                  Crop origin Y in original image coords
// cropW            number                  Crop width in original image coords
// cropH            number                  Crop height in original image coords
// finalX           number                  Final clamped crop X
// finalY           number                  Final clamped crop Y
// result           Object                  Result from image manipulation
// evt              GestureEvent            Pan responder event
// gesture          PanResponderGestureState Gesture state from pan responder
// e                any                     Pinch event object
// total            number                  Total calculated scale
// clamped          number                  Clamped scale value (1-6)
// final            number                  Final scale value after pinch
// state            number                  Current gesture state
// oldState         number                  Previous gesture state
//
//*******************************************************************

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  State,
} from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeProvider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CROP_ASPECT = 3 / 4;
const CROP_WIDTH = SCREEN_WIDTH * 0.9;
const CROP_HEIGHT = CROP_WIDTH / CROP_ASPECT;

const PADDING_FACTOR = 1.2;

interface Props {
  visible: boolean;
  imageUri: string;
  onCrop: (uri: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({ visible, imageUri, onCrop, onCancel }: Props) {
  const { colors, isDark } = useTheme();

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displayedSize, setDisplayedSize] = useState({ width: 0, height: 0 });
  const [gridColor, setGridColor] = useState("rgba(255,255,255,0.35)");

  const gridOpacity = useRef(new Animated.Value(0)).current;
  const gridFadeTimeout = useRef<NodeJS.Timeout | null>(null);

  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(1);
  const pinchStartScale = useRef(1);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const offsetX = useRef(0);
  const offsetY = useRef(0);

  const pinchRef = useRef(null);

  const cropX = (SCREEN_WIDTH - CROP_WIDTH) / 2;
  const cropY = (SCREEN_HEIGHT - CROP_HEIGHT) / 2;

  useEffect(() => {
    if (!visible || !imageUri) return;

    scale.setValue(1);
    baseScale.current = 1;
    pinchStartScale.current = 1;

    translateX.setValue(0);
    translateY.setValue(0);
    offsetX.current = 0;
    offsetY.current = 0;

    Image.getSize(imageUri, (w, h) => setImageSize({ width: w, height: h }));

    detectImageBrightness(imageUri);

  }, [visible, imageUri]);

  //********************************************************************
  //
  // detectImageBrightness Function
  //
  // Detects image brightness by resizing to 3x3 and sampling center
  // pixels. Sets grid color to white for dark images, black for bright
  // images to ensure visibility.
  //
  // Return Value
  // ------------
  // Promise<void>
  //
  // Value Parameters
  // ----------------
  // uri    string    Image URI to analyze
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // small    Object     Resized 3x3 image result
  // raw      string     Base64 decoded image data
  // bright   number     Calculated brightness average
  // r        number     Red channel value
  // g        number     Green channel value
  // b        number     Blue channel value
  // e        Error      Error object if detection fails
  //
  //*******************************************************************
  const detectImageBrightness = async (uri: string) => {
    try {
      const small = await manipulateAsync(
        uri,
        [{ resize: { width: 3, height: 3 } }],
        { base64: true }
      );

      if (!small.base64) return;

      const raw = atob(small.base64);
      let bright = 0;

      for (let i = 0; i < raw.length; i += 4) {
        const r = raw.charCodeAt(i);
        const g = raw.charCodeAt(i + 1);
        const b = raw.charCodeAt(i + 2);
        bright += 0.299 * r + 0.587 * g + 0.114 * b;
      }
      bright /= 9;

      if (bright < 128) {
        setGridColor("rgba(255,255,255,0.35)");
      } else {
        setGridColor("rgba(0,0,0,0.35)");
      }
    } catch (e) {
      console.error("brightness detection failed:", e);
    }
  };

  useEffect(() => {
    if (!imageSize.width) return;

    const base = Math.max(
      CROP_WIDTH / imageSize.width,
      CROP_HEIGHT / imageSize.height
    );

    setDisplayedSize({
      width: imageSize.width * base * PADDING_FACTOR,
      height: imageSize.height * base * PADDING_FACTOR,
    });
  }, [imageSize]);

  //********************************************************************
  //
  // showGrid Function
  //
  // Immediately shows grid by animating opacity to 1. Clears any pending
  // fade-out timeout to prevent conflicts.
  //
  // Return Value
  // ------------
  // void
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
  // None
  //
  //*******************************************************************
  const showGrid = () => {
    if (gridFadeTimeout.current) clearTimeout(gridFadeTimeout.current);
    Animated.timing(gridOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  //********************************************************************
  //
  // hideGrid Function
  //
  // Schedules grid fade-out after 400ms idle. Clears any existing timeout
  // before setting new one to prevent premature hiding.
  //
  // Return Value
  // ------------
  // void
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
  // None
  //
  //*******************************************************************
  const hideGrid = () => {
    if (gridFadeTimeout.current) clearTimeout(gridFadeTimeout.current);
    gridFadeTimeout.current = setTimeout(() => {
      Animated.timing(gridOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }, 400);
  };

  //********************************************************************
  //
  // onUserGesture Function
  //
  // Called during user gestures to show grid and schedule fade-out.
  // Ensures grid is visible while user is actively interacting.
  //
  // Return Value
  // ------------
  // void
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
  // None
  //
  //*******************************************************************
  const onUserGesture = () => {
    showGrid();
    hideGrid();
  };

  //********************************************************************
  //
  // PanResponder Configuration
  //
  // Handles pan (drag) gestures for moving image within crop window.
  // Accumulates translations in offset refs and updates animated values
  // during gesture. Shows grid on gesture start and hides on release.
  //
  //*******************************************************************
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: () => {
        onUserGesture();
        offsetX.current += (translateX as any)._value;
        offsetY.current += (translateY as any)._value;
        translateX.setOffset(offsetX.current);
        translateX.setValue(0);
        translateY.setOffset(offsetY.current);
        translateY.setValue(0);
      },

      onPanResponderMove: (_evt, gesture) => {
        translateX.setValue(gesture.dx);
        translateY.setValue(gesture.dy);
      },

      onPanResponderRelease: (_evt, gesture) => {
        offsetX.current += gesture.dx;
        offsetY.current += gesture.dy;
        translateX.setOffset(offsetX.current);
        translateX.setValue(0);
        translateY.setOffset(offsetY.current);
        translateY.setValue(0);
        hideGrid();
      },
    })
  ).current;

  //********************************************************************
  //
  // onPinchEvent Handler
  //
  // Handles pinch gesture events to scale image. Clamps scale between
  // 1x and 6x. Shows grid during pinch gesture.
  //
  // Return Value
  // ------------
  // Animated.CompositeAnimation    Animation event handler
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
  // e        any      Native event object from gesture handler
  // total    number   Calculated total scale (base * gesture scale)
  // clamped  number   Scale clamped to 1-6 range
  //
  //*******************************************************************
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    {
      useNativeDriver: false,
      listener: (e: any) => {
        onUserGesture();
        const total = pinchStartScale.current * e.nativeEvent.scale;
        const clamped = Math.max(1, Math.min(6, total));
        scale.setValue(clamped);
      },
    }
  );

  //********************************************************************
  //
  // onPinchStateChange Function
  //
  // Handles pinch gesture state changes. Saves base scale when gesture
  // becomes active, and commits final scale when gesture ends. Hides grid
  // when gesture completes.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // event    any      Gesture handler event object
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // state     number    Current gesture state
  // oldState  number    Previous gesture state
  // final     number    Final scale value after gesture
  //
  //*******************************************************************
  const onPinchStateChange = (event: any) => {
    const { state, oldState } = event.nativeEvent;

    if (state === State.ACTIVE) {
      pinchStartScale.current = (scale as any)._value || baseScale.current;
      baseScale.current = pinchStartScale.current;
    }

    if (oldState === State.ACTIVE) {
      hideGrid();
      const final = (scale as any)._value || baseScale.current;
      baseScale.current = Math.max(1, Math.min(6, final));
      scale.setValue(baseScale.current);
    }
  };

  //********************************************************************
  //
  // handleCrop Function
  //
  // Performs the actual image crop operation. Calculates crop region
  // in original image coordinates based on current scale and translation,
  // clamps to image boundaries, and applies crop and resize operations.
  // Calls onCrop callback with resulting image URI.
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
  // s         number      Final scale value
  // imgW      number      Scaled image width
  // imgH      number      Scaled image height
  // dx        number      Final X translation
  // dy        number      Final Y translation
  // imageLeft number      Left edge of displayed image
  // imageTop  number      Top edge of displayed image
  // scaleX    number      X scale factor (original to displayed)
  // scaleY    number      Y scale factor (original to displayed)
  // originX   number      Crop origin X in original coordinates
  // originY   number      Crop origin Y in original coordinates
  // cropW     number      Crop width in original coordinates
  // cropH     number      Crop height in original coordinates
  // finalX    number      Final clamped crop X
  // finalY    number      Final clamped crop Y
  // result    Object      Result from image manipulation
  //
  //*******************************************************************
  const handleCrop = async () => {
    const s = baseScale.current;
    const imgW = displayedSize.width * s;
    const imgH = displayedSize.height * s;

    const dx = offsetX.current + (translateX as any)._value;
    const dy = offsetY.current + (translateY as any)._value;

    const imageLeft = SCREEN_WIDTH / 2 - imgW / 2 + dx;
    const imageTop = SCREEN_HEIGHT / 2 - imgH / 2 + dy;

    const scaleX = imageSize.width / imgW;
    const scaleY = imageSize.height / imgH;

    const originX = (cropX - imageLeft) * scaleX;
    const originY = (cropY - imageTop) * scaleY;

    let cropW = CROP_WIDTH * scaleX;
    let cropH = CROP_HEIGHT * scaleY;

    const finalX = Math.max(0, Math.min(originX, imageSize.width - cropW));
    const finalY = Math.max(0, Math.min(originY, imageSize.height - cropH));

    cropW = Math.min(cropW, imageSize.width - finalX);
    cropH = Math.min(cropH, imageSize.height - finalY);

    const result = await manipulateAsync(
      imageUri,
      [
        {
          crop: {
            originX: Math.round(finalX),
            originY: Math.round(finalY),
            width: Math.round(cropW),
            height: Math.round(cropH),
          },
        },
        { resize: { width: 1080 } },
      ],
      { compress: 0.85, format: SaveFormat.JPEG }
    );

    onCrop(result.uri);
  };

  if (!visible) return null;

  const maskColor = colors.background;
  const borderBottomColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  return (
    <Modal visible transparent animationType="slide">
      <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
        
        {/* NAV BAR */}
        <View style={[styles.navBar, { backgroundColor: colors.background }]}>
          <View style={styles.navButtonContainer} />
          <Text style={[styles.navTitle, { color: colors.text }]}>Edit Photo</Text>
          <View style={styles.navButtonContainer} />
        </View>

        <TouchableOpacity 
          onPress={onCancel}
          style={[styles.backArrowButton, { backgroundColor: colors.background }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={30} color={colors.text} accessible={false} importantForAccessibility="no" />
        </TouchableOpacity>

        <PinchGestureHandler
          ref={pinchRef}
          onGestureEvent={onPinchEvent}
          onHandlerStateChange={onPinchStateChange}
        >
          <Animated.View
            style={styles.gestureLayer}
            {...panResponder.panHandlers}
          >
            <View
              style={{
                position: "absolute",
                top: cropY,
                left: cropX,
                width: CROP_WIDTH,
                height: CROP_HEIGHT,
                overflow: "hidden",
                borderRadius: 16,
                backgroundColor: colors.background,
              }}
              pointerEvents="none"
            >
              <Animated.View
                style={{
                  position: "absolute",
                  width: displayedSize.width,
                  height: displayedSize.height,
                  left: CROP_WIDTH / 2 - displayedSize.width / 2,
                  top: CROP_HEIGHT / 2 - displayedSize.height / 2,
                  transform: [
                    { translateX: translateX },
                    { translateY: translateY },
                    { scale: scale },
                  ],
                }}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: displayedSize.width, height: displayedSize.height }}
                />
              </Animated.View>
            </View>
          </Animated.View>
        </PinchGestureHandler>

        <View style={styles.maskContainer} pointerEvents="none">
          <View style={[styles.mask, { top: 56, height: cropY - 56, backgroundColor: maskColor }]} />
          <View style={[styles.mask, { top: cropY + CROP_HEIGHT, bottom: 0, backgroundColor: maskColor }]} />
          <View style={[styles.mask, { top: cropY, height: CROP_HEIGHT, width: cropX, left: 0, backgroundColor: maskColor }]} />
          <View style={[styles.mask, { top: cropY, height: CROP_HEIGHT, left: cropX + CROP_WIDTH, right: 0, backgroundColor: maskColor }]} />
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.gridContainer,
            {
              top: cropY,
              left: cropX,
              width: CROP_WIDTH,
              height: CROP_HEIGHT,
              opacity: gridOpacity,
            },
          ]}
        >
          <View style={[styles.gridLine, { left: CROP_WIDTH / 3, backgroundColor: gridColor }]} />
          <View style={[styles.gridLine, { left: (CROP_WIDTH / 3) * 2, backgroundColor: gridColor }]} />

          <View style={[styles.gridLineH, { top: CROP_HEIGHT / 3, backgroundColor: gridColor }]} />
          <View style={[styles.gridLineH, { top: (CROP_HEIGHT / 3) * 2, backgroundColor: gridColor }]} />
        </Animated.View>

         <View
           style={[
             styles.cropTextContainer,
             {
               top: cropY - 50,
               left: cropX,
               width: CROP_WIDTH,
             },
           ]}
           pointerEvents="none"
         >
           <Text style={[styles.cropText, { color: colors.text }]}>Crop Image</Text>
         </View>

         <View
           pointerEvents="none"
           style={[
             styles.cropBorder,
             { 
               top: cropY, 
               left: cropX, 
               width: CROP_WIDTH, 
               height: CROP_HEIGHT,
               borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
             },
           ]}
         />

        <View style={styles.doneButtonContainer}>
          <TouchableOpacity 
            onPress={handleCrop}
            style={[styles.doneButton, { backgroundColor: colors.accent }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.doneButtonText, { color: colors.buttonText }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
            Drag image • Pinch to zoom
          </Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    height: 56,
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButtonContainer: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  navButton: {
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
  },

  gestureLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },

  maskContainer: {
    ...StyleSheet.absoluteFillObject,
  },

  mask: {
    position: "absolute",
  },

  gridContainer: {
    position: "absolute",
  },

  gridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
  },

  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
  },

  cropTextContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  cropText: {
    fontSize: 28,
    fontWeight: "700",
  },
  cropBorder: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 16,
  },

  backArrowButton: {
    position: "absolute",
    top: 80,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: "600",
  },
  doneButtonContainer: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
    paddingHorizontal: 20,
  },
  doneButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 120,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  instructions: {
    position: "absolute",
    bottom: 50,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  instructionText: {
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
});
