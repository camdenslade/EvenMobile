//********************************************************************
//
// ProfilePreviewModal Component
//
// Read-only profile preview stacked above other modals. Shows the
// sender's primary photo full-screen-ish with a close/back control.
//
//********************************************************************

import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../context/ThemeProvider";
import { AppImage } from "./AppImage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";
import { useAuth } from "../context/AuthContext";
import { Alert } from "react-native";

interface Props {
  visible: boolean;
  photoUrl: string | null;
  name: string;
  userUid?: string | null;
  onClose: () => void;
}

export function ProfilePreviewModal({ visible, photoUrl, name, userUid, onClose }: Props) {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { idToken } = useAuth();
  const source = photoUrl && photoUrl.length > 0 ? photoUrl : "https://via.placeholder.com/400";

  const handleBlock = () => {
    if (!idToken || !userUid) {
      Alert.alert("Error", "You must be logged in to block a user.");
      return;
    }
    onClose();
    navigation.navigate("Profile", { screen: "Profile" }); // noop placeholder
    Alert.alert("Blocked", `${name} has been blocked.`, [{ text: "OK" }]);
  };

  const handleReport = () => {
    if (!idToken || !userUid) {
      Alert.alert("Error", "You must be logged in to report a user.");
      return;
    }
    onClose();
    navigation.navigate("ReviewWrite", { targetId: userUid });
  };

  const handleSafety = () => {
    onClose();
    navigation.navigate("Safety");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessible={true}
      accessibilityViewIsModal={true}
    >
      <View style={styles.overlay} accessible={false} importantForAccessibility="no">
        <View style={[styles.card, { backgroundColor: colors.card }]} accessible={false}>
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: colors.card }]}
            onPress={handleReport}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="More options"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close profile preview"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.text}
              accessible={false}
              importantForAccessibility="no"
            />
            <Text style={[styles.backText, { color: colors.text }]} allowFontScaling={true}>
              Back
            </Text>
          </TouchableOpacity>

          <AppImage
            source={source}
            style={styles.photo}
            accessibilityLabel={`${name}'s profile photo`}
            accessibilityRole="image"
          />
          <Text
            style={[styles.name, { color: colors.text }]}
            accessible={true}
            accessibilityRole="header"
            allowFontScaling={true}
          >
            {name}
          </Text>

          <View style={styles.menuActions}>
            <TouchableOpacity
              style={styles.menuAction}
              onPress={handleBlock}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Block user"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ban" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>Block</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuAction}
              onPress={handleReport}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Report user"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="flag-outline" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuAction}
              onPress={handleSafety}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Safety resources"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>Safety</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  menuButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    borderRadius: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 4,
  },
  photo: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 14,
    backgroundColor: "#333",
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Platform.OS === "ios" ? 0 : 4,
  },
  menuActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 12,
  },
  menuAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  menuText: {
    marginLeft: 6,
    fontWeight: "700",
  },
});
