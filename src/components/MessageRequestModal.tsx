//********************************************************************
//
// MessageRequestModal Component
//
// Displays a modal for viewing and responding to a message request.
// Shows sender's photo, name, message content, and Accept/Decline
// buttons. Requires explicit action (no auto-dismiss).
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the message request modal
//
// Value Parameters
// ----------------
// visible      boolean         Whether modal is visible
// senderPhoto  string|null     Sender's profile photo URL
// senderName   string          Sender's first name
// message      string          Message content
// onAccept     () => void      Callback when Accept is pressed
// onDecline    () => void      Callback when Decline is pressed
// onClose      () => void      Callback to close modal (for Android back button)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors      Object      Theme colors
// firstName   string      First name extracted from senderName
//
//*******************************************************************

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useEffect } from 'react';
import { useTheme } from '../context/ThemeProvider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppImage } from './AppImage';

interface Props {
  visible: boolean;
  senderPhoto: string | null;
  senderName: string;
  message: string;
  requestId?: string;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
  onOpenProfile?: () => void;
}

export function MessageRequestModal({
  visible,
  senderPhoto,
  senderName,
  message,
  requestId,
  onAccept,
  onDecline,
  onClose,
  onOpenProfile,
}: Props) {
  const { colors } = useTheme();
  const normalizedSource =
    typeof senderPhoto === 'string' && senderPhoto.trim().length > 0
      ? senderPhoto.trim()
      : 'https://via.placeholder.com/200';

  // Announce modal to screen readers
  useEffect(() => {
    if (visible) {
      AccessibilityInfo.announceForAccessibility(
        `Message request from ${senderName}. ${message}`
      );
    }
  }, [visible, senderName, message, normalizedSource]);

  const firstName = senderName.split(' ')[0];

  if (!visible) return null;

  return (
    <View
      style={styles.overlay}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        accessible={false}
        importantForAccessibility="no"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={onClose}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close message request"
          accessibilityHint="Returns to matches"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={colors.text}
            accessible={false}
            importantForAccessibility="no"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenProfile}
          disabled={!onOpenProfile}
          style={[
            styles.photoBorder,
            {
              borderColor: colors.accent ?? colors.text,
              backgroundColor: colors.background,
            },
          ]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`View ${firstName}'s profile`}
          accessibilityHint="Opens the full profile card"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <AppImage
            key={requestId ?? normalizedSource}
            source={normalizedSource}
            style={styles.profilePhoto}
            contentFit="cover"
            accessibilityLabel={`${firstName}'s profile photo`}
            accessibilityRole="image"
            priority="high"
          />
        </TouchableOpacity>

        <Text
          style={[styles.name, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          accessibilityLabel={`Message from ${firstName}`}
          allowFontScaling={true}
        >
          {firstName}
        </Text>

        <Text
          style={[styles.message, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Message: ${message}`}
          allowFontScaling={true}
        >
          {message}
        </Text>

        <View
          style={styles.buttonContainer}
          accessible={false}
          importantForAccessibility="no"
        >
          <TouchableOpacity
            style={[styles.acceptBtn, { backgroundColor: colors.accent }]}
            onPress={onAccept}
            accessible={true}
            accessibilityLabel={`Accept message from ${firstName}`}
            accessibilityRole="button"
            accessibilityHint="Accepts the message request and opens chat"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.acceptText, { color: colors.buttonText || '#fff' }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Accept
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.declineBtn,
              { backgroundColor: colors.card, borderColor: colors.subtitle },
            ]}
            onPress={onDecline}
            accessible={true}
            accessibilityLabel={`Decline message from ${firstName}`}
            accessibilityRole="button"
            accessibilityHint="Declines the message request"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.declineText, { color: colors.subtitle }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Decline
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    width: '90%',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  photoBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "#000",
    position: "relative",
    marginBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  acceptBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 18,
    fontWeight: '600',
  },
  declineBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
