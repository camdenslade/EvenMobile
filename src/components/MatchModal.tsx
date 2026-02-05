//********************************************************************
//
// MatchModal Component
//
// Displays a modal when a match is found after liking a profile. Shows
// both users' photos, "It's a Match!" title, and action buttons. Purely
// visual component - parent handles navigation logic via callbacks.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the match modal
//
// Value Parameters
// ----------------
// visible      boolean         Whether modal is visible
// mePhoto      string|null     Current user's profile photo URL
// themPhoto    string|null     Matched user's profile photo URL
// onClose      () => void      Callback to close modal and continue swiping
// onMessage    () => void      Callback to navigate to chat (parent injects matchId)
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

import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeProvider';
import { AppImage } from './AppImage';
import defaultAvatar from '../../assets/default-avatar.jpg';

interface Props {
  visible: boolean;
  mePhoto: string | null;
  themPhoto: string | null;
  onClose: () => void;
  onMessage: () => void;
}

export function MatchModal({
  visible,
  mePhoto,
  themPhoto,
  onClose,
  onMessage,
}: Props) {
  const titleRef = useRef<Text>(null);
  const { colors } = useTheme();

  // Focus management: Announce match when modal opens
  useEffect(() => {
    if (visible) {
      // Announce match found to screen readers
      AccessibilityInfo.announceForAccessibility("It's a Match! You've matched with someone.");
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <View
        style={styles.modalCenter}
        accessible={false}
        importantForAccessibility="no"
      >
        <View
          style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}
          accessible={false}
          importantForAccessibility="no"
        >
          <Text
            ref={titleRef}
            style={[styles.title, { color: colors.text }]}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="It's a Match!"
            allowFontScaling={true}
          >
            It's a Match!
          </Text>

          <View
            style={styles.row}
            accessible={true}
            accessibilityLabel="Match photos"
            accessibilityRole="image"
          >
            {mePhoto ? (
              <AppImage
                source={mePhoto}
                style={[styles.photo, { backgroundColor: colors.border }]}
                accessibilityLabel="Your profile photo"
              />
            ) : (
              <AppImage
                source={defaultAvatar}
                style={[styles.photo, { backgroundColor: colors.border }]}
                accessibilityLabel="Your profile photo"
              />
            )}
            {themPhoto ? (
              <AppImage
                source={themPhoto}
                style={[styles.photo, { backgroundColor: colors.border }]}
                accessibilityLabel="Matched user's profile photo"
              />
            ) : (
              <AppImage
                source={defaultAvatar}
                style={[styles.photo, { backgroundColor: colors.border }]}
                accessibilityLabel="Matched user's profile photo"
              />
            )}
          </View>

          <TouchableOpacity
            onPress={onMessage}
            style={[styles.modalBtn, { backgroundColor: colors.accent }]}
            accessible={true}
            accessibilityLabel="Send a message"
            accessibilityRole="button"
            accessibilityHint="Opens chat with your match"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.modalBtnText, { color: colors.buttonText }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Send a Message
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.modalBtnOutline, { borderColor: colors.text }]}
            accessible={true}
            accessibilityLabel="Keep swiping"
            accessibilityRole="button"
            accessibilityHint="Closes match modal and returns to swiping"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[styles.modalBtnOutlineText, { color: colors.text }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Keep Swiping
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  modalBox: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 16,
  },

  photo: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },

  modalBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBtnText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },

  modalBtnOutline: {
    width: '100%',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBtnOutlineText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
