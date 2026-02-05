import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeProvider';
import { useBottomButtons } from '../context/BottomButtonsContext';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TutorialStep {
  id: string;
  title: string;
  message: string;
  highlightArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius?: number;
  };
  pointerPosition?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'swipe-up' | 'swipe-down' | 'tap';
}

interface TutorialOverlayProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({ visible, onComplete, onSkip }: TutorialOverlayProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { buttonsLayout } = useBottomButtons();
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [contentHeight, setContentHeight] = useState(0);

  const steps = useMemo<TutorialStep[]>(() => {
    const cardWidth = SCREEN_WIDTH * 0.88;
    const cardHeight = SCREEN_HEIGHT * 0.68;
    const cardLeft = (SCREEN_WIDTH - cardWidth) / 2;
    const cardTop = 58;

    const navBarTopPadding = 16;
    const navBarButtonHeight = Platform.OS === 'android' ? 48 : 44;
    const navBarBottomPadding = 16;
    const navBarSafeAreaPadding =
      Platform.OS === 'android' ? Math.max(insets.bottom, 20) : Math.max(insets.bottom, 34);
    const navBarTotalHeight =
      navBarTopPadding + navBarButtonHeight + navBarBottomPadding + navBarSafeAreaPadding;

    const centerButtonSize = 110;
    const sideButtonSize = 66;
    const buttonsTop = SCREEN_HEIGHT - navBarTotalHeight - centerButtonSize;
    const buttonsCenterY = buttonsTop + centerButtonSize / 2;

    const highlightPadding = 6;
    const toHighlight = (layout?: { x: number; y: number; width: number; height: number }) => {
      if (!layout) return null;
      const size = Math.max(layout.width, layout.height) + highlightPadding * 2;
      return {
        x: layout.x - highlightPadding,
        y: layout.y - highlightPadding,
        width: size,
        height: size,
        borderRadius: size / 2,
      };
    };

    const undoHighlight = toHighlight(buttonsLayout.undo);
    const likeHighlight = toHighlight(buttonsLayout.like);
    const messageHighlight = toHighlight(buttonsLayout.message);

    const undoCenterX = SCREEN_WIDTH * 0.25;
    const likeCenterX = SCREEN_WIDTH * 0.5;
    const messageCenterX = SCREEN_WIDTH * 0.75;

    return [
      {
        id: 'welcome',
        title: 'Welcome to Even Dating!',
        message: "Let's show you how everything works. It'll only take a minute!",
      },
      {
        id: 'card',
        title: 'Meet Someone New',
        message: 'This is a profile card. You can see their photo, name, age, and interests.',
        highlightArea: {
          x: cardLeft,
          y: cardTop,
          width: cardWidth,
          height: cardHeight,
          borderRadius: 20,
        },
        pointerPosition: 'top',
      },
      {
        id: 'like',
        title: 'Like Them?',
        message: 'Swipe up or tap the logo below to like someone. If they like you back, it\'s a match!',
        highlightArea:
          likeHighlight ?? {
            x: likeCenterX - centerButtonSize / 2,
            y: buttonsCenterY - centerButtonSize / 2,
            width: centerButtonSize,
            height: centerButtonSize,
            borderRadius: centerButtonSize / 2,
          },
        pointerPosition: 'bottom',
        action: 'swipe-up',
      },
      {
        id: 'skip',
        title: 'Not Interested?',
        message: 'Swipe left or right to skip to the next person.',
        highlightArea:
          likeHighlight ?? {
            x: likeCenterX - sideButtonSize / 2,
            y: buttonsCenterY - sideButtonSize / 2,
            width: sideButtonSize,
            height: sideButtonSize,
            borderRadius: sideButtonSize / 2,
          },
        pointerPosition: 'bottom',
        action: 'swipe-down',
      },
      {
        id: 'undo',
        title: 'Made a Mistake?',
        message: 'Changed your mind? Tap undo to go back to the last person.',
        highlightArea:
          undoHighlight ?? {
            x: undoCenterX - sideButtonSize / 2,
            y: buttonsCenterY - sideButtonSize / 2,
            width: sideButtonSize,
            height: sideButtonSize,
            borderRadius: sideButtonSize / 2,
          },
        pointerPosition: 'bottom',
      },
      {
        id: 'profile',
        title: 'Want to Know More?',
        message: 'Tap on the card to view their full profile with more photos and details.',
        highlightArea: {
          x: cardLeft,
          y: cardTop,
          width: cardWidth,
          height: cardHeight,
          borderRadius: 20,
        },
        pointerPosition: 'top',
        action: 'tap',
      },
      {
        id: 'message',
        title: 'Send a Message Request',
        message: 'Really interested? Send them a message request to stand out!',
        highlightArea:
          messageHighlight ?? {
            x: messageCenterX - sideButtonSize / 2,
            y: buttonsCenterY - sideButtonSize / 2,
            width: sideButtonSize,
            height: sideButtonSize,
            borderRadius: sideButtonSize / 2,
          },
        pointerPosition: 'bottom',
      },
      {
        id: 'complete',
        title: "You're All Set!",
        message: "That's it! Now go out there and start exploring. Have fun!",
      },
    ];
  }, [buttonsLayout.like, buttonsLayout.message, buttonsLayout.undo, insets.bottom]);

  useEffect(() => {
    if (visible) {
      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Pulse animation for highlight
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible, fadeAnim, pulseAnim]);

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleSkip}
    >
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Dark overlay with cutout for highlighted area */}
        <View style={styles.overlay}>
          {step.highlightArea && (
            <Animated.View
              style={[
                styles.highlight,
                {
                  left: step.highlightArea.x,
                  top: step.highlightArea.y,
                  width: step.highlightArea.width,
                  height: step.highlightArea.height,
                  borderRadius: step.highlightArea.borderRadius || 0,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          )}
        </View>

        {/* Tutorial content card */}
        <View
          style={[
            styles.contentCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.subtitle,
              top: (() => {
                if (contentHeight === 0) return SCREEN_HEIGHT / 2 - 150;
                if (!step.highlightArea) return SCREEN_HEIGHT / 2 - contentHeight / 2;
                const desiredTop =
                  step.pointerPosition === 'top'
                    ? step.highlightArea.y + step.highlightArea.height + 16
                    : step.pointerPosition === 'bottom'
                    ? step.highlightArea.y - contentHeight - 16
                    : SCREEN_HEIGHT / 2 - contentHeight / 2;
                const minTop = 24 + insets.top;
                const maxTop = SCREEN_HEIGHT - contentHeight - (24 + insets.bottom);
                return Math.min(Math.max(desiredTop, minTop), maxTop);
              })(),
            },
          ]}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight !== contentHeight) {
              setContentHeight(nextHeight);
            }
          }}
        >
          {/* Pointer/Arrow */}
          {step.highlightArea && step.pointerPosition === 'top' && (
            <View
              style={[
                styles.pointerTop,
                { borderBottomColor: colors.card },
              ]}
            />
          )}
          {step.highlightArea && step.pointerPosition === 'bottom' && (
            <View
              style={[
                styles.pointerBottom,
                { borderTopColor: colors.card },
              ]}
            />
          )}

          <Text style={[styles.title, { color: colors.text }]}>
            {step.title}
          </Text>
          <Text style={[styles.message, { color: colors.subtitle }]}>
            {step.message}
          </Text>

          {/* Action hint */}
          {step.action && (
            <View style={[styles.actionHint, { backgroundColor: colors.accent + '20' }]}>
              {step.action === 'swipe-up' && (
                <Ionicons name="arrow-up" size={24} color={colors.accent} />
              )}
              {step.action === 'swipe-down' && (
                <Ionicons name="arrow-down" size={24} color={colors.accent} />
              )}
              {step.action === 'tap' && (
                <Ionicons name="hand-left" size={24} color={colors.accent} />
              )}
              <Text style={[styles.actionText, { color: colors.accent }]}>
                {step.action === 'swipe-up' && 'Try swiping up!'}
                {step.action === 'swipe-down' && 'Try swiping down!'}
                {step.action === 'tap' && 'Try tapping!'}
              </Text>
            </View>
          )}

          {/* Progress dots */}
          <View style={styles.progressContainer}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor:
                      index === currentStep ? colors.accent : colors.subtitle + '40',
                    width: index === currentStep ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Navigation buttons */}
          <View style={styles.buttonRow}>
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={handleBack}
                style={[styles.navButton, { borderColor: colors.text }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.skipText, { color: colors.subtitle }]}>
                Skip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextButton, { backgroundColor: colors.accent }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.nextText, { color: colors.buttonText }]}>
                {currentStep === steps.length - 1 ? 'Start Swiping!' : 'Next'}
              </Text>
              {currentStep < steps.length - 1 && (
                <Ionicons name="chevron-forward" size={20} color={colors.buttonText} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
  },

  highlight: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },

  contentCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  pointerTop: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderLeftColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'transparent',
    borderBottomWidth: 10,
  },

  pointerBottom: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderLeftColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'transparent',
    borderTopWidth: 10,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },

  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },

  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },

  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },

  progressDot: {
    height: 8,
    borderRadius: 4,
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  skipButton: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },

  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 22,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
  },

  nextText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
