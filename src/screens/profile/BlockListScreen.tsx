import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiDelete } from "../../services/apiService";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AppImage } from "../../components/AppImage";

type BlockedUser = {
  uid: string;
  name: string | null;
  photo: string | null;
};

export default function BlockListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { idToken } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!idToken) {
      setError("Missing auth token.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ blocked: string[] }>("/blocks/me", idToken);
      const uids = res?.blocked || [];

      const profiles = await Promise.all(
        uids.map(async (uid) => {
          try {
            const p = await apiGet<{ name?: string | null; photos?: string[]; profileImageUrl?: string | null }>(
              `/profiles/${uid}`,
              idToken,
            );
            const firstName = p?.name ? p.name.split(" ")[0] : null;
            const photo = (p?.photos && p.photos[0]) || p?.profileImageUrl || null;
            return { uid, name: firstName, photo };
          } catch {
            return { uid, name: null, photo: null };
          }
        }),
      );

      setBlocked(profiles);
    } catch (err: any) {
      setError(err?.message || "Failed to load block list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [idToken]);

  const handleUnblock = async (uid: string) => {
    if (!idToken) return;
    try {
      await apiDelete(`/blocks/${uid}`, idToken);
      setBlocked((prev) => prev.filter((b) => b.uid !== uid));
    } catch (err: any) {
      setError(err?.message || "Failed to unblock user.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        accessibilityHint="Returns to previous screen"
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
        style={[styles.title, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Blocked Users
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={{ color: colors.text }}>{error}</Text>
      ) : blocked.length === 0 ? (
        <Text style={{ color: colors.subtitle }}>You haven't blocked anyone.</Text>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.avatarWrap, { backgroundColor: colors.background }]}
                onPress={() => navigation.navigate("UserProfileView", { userId: item.uid, fromBlockList: true })}
                accessibilityLabel={`Preview ${item.name || "user"}`}
                accessibilityRole="button"
              >
                {item.photo ? (
                  <AppImage source={item.photo} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.border }]} />
                )}
              </TouchableOpacity>
              <View style={styles.textWrap}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name || "Blocked user"}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.unblockBtn, { backgroundColor: colors.accent }]}
                onPress={() => handleUnblock(item.uid)}
                accessibilityLabel="Unblock user"
                accessibilityRole="button"
              >
                <Text style={[styles.unblockText, { color: colors.buttonText }]}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
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
  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  textWrap: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  uid: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
