import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useTheme } from "../context/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost } from "../services/apiService";
import GlobalBackground from "../components/GlobalBackground";

interface Referral {
  id: string;
  referredEmail: string;
  status: "pending" | "signed_up" | "qualified" | "rewarded";
  referrerRewarded: boolean;
  referredRewarded: boolean;
  minutesActive: number;
  createdAt: string;
}

interface ReferralStats {
  referrals: Referral[];
  totalReferred: number;
  totalRewarded: number;
}

function buildStats(referrals: Referral[]): ReferralStats {
  return {
    referrals,
    totalReferred: referrals.length,
    totalRewarded: referrals.filter((r) => r.referrerRewarded).length,
  };
}

const STATUS_LABELS: Record<Referral["status"], string> = {
  pending: "Invited",
  signed_up: "Signed Up",
  qualified: "Active (earning reward)",
  rewarded: "Rewarded",
};

const STATUS_COLORS: Record<Referral["status"], string> = {
  pending: "#999",
  signed_up: "#f59e0b",
  qualified: "#3b82f6",
  rewarded: "#10b981",
};

export default function ReferralScreen({ navigation }: { navigation?: any }) {
  const { colors } = useTheme();
  const { idToken } = useAuth();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReferrals = useCallback(async () => {
    if (!idToken) return;
    try {
      // Backend returns Referral[] directly
      const data = await apiGet<Referral[]>("/referrals/my", idToken);
      if (Array.isArray(data)) setStats(buildStats(data));
    } catch (err) {
      console.error("Failed to fetch referrals:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [idToken]);

  useEffect(() => {
    void fetchReferrals();
  }, [fetchReferrals]);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (!idToken) return;

    setSending(true);
    try {
      await apiPost("/referrals/send", { email: trimmed }, idToken);
      setEmail("");
      Alert.alert(
        "Invite Sent!",
        `An invitation has been sent to ${trimmed}. You'll earn 1 free search token when they sign up and use the app for an hour.`
      );
      await fetchReferrals();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send invite.";
      Alert.alert("Error", msg);
    } finally {
      setSending(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchReferrals();
  }, [fetchReferrals]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <TouchableOpacity
        onPress={() => navigation?.goBack()}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={28} color={colors.text} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={[styles.title, { color: colors.text }]}>Refer a Friend</Text>

        <View style={[styles.rewardCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.rewardTitle, { color: colors.text }]}>How it works</Text>
          <View style={styles.rewardRow}>
            <Ionicons name="search" size={20} color={colors.accent} />
            <Text style={[styles.rewardText, { color: colors.text }]}>
              You earn{" "}
              <Text style={{ fontWeight: "700" }}>1 free search token</Text> when
              your friend uses the app for 1 hour
            </Text>
          </View>
          <View style={styles.rewardRow}>
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} />
            <Text style={[styles.rewardText, { color: colors.text }]}>
              They earn{" "}
              <Text style={{ fontWeight: "700" }}>1 free message request token</Text>{" "}
              after 1 hour of activity
            </Text>
          </View>
          <Text style={[styles.rewardNote, { color: colors.subtitle }]}>
            Referred users must have a verified school email domain. You cannot
            re-refer someone who has already been invited.
          </Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>
            Enter their school email
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="friend@university.edu"
              placeholderTextColor={colors.subtitle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.background, borderColor: colors.border },
              ]}
              accessibilityLabel="Referral email input"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={sending || !email.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    sending || !email.trim()
                      ? (colors.accent ?? "#007AFF") + "66"
                      : colors.accent,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send invite"
            >
              {sending ? (
                <ActivityIndicator color={colors.buttonText ?? "#fff"} size="small" />
              ) : (
                <Text style={[styles.sendBtnText, { color: colors.buttonText ?? "#fff" }]}>
                  Send Invite
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 32 }}
            color={colors.accent}
            size="large"
          />
        ) : (
          <>
            {stats && (
              <View style={styles.statRow}>
                <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.statNum, { color: colors.accent }]}>
                    {stats.totalReferred}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.subtitle }]}>Invited</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.statNum, { color: colors.accent }]}>
                    {stats.totalRewarded}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.subtitle }]}>Rewarded</Text>
                </View>
              </View>
            )}

            {stats && stats.referrals.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Your Invites
                </Text>
                {stats.referrals.map((r) => (
                  <View
                    key={r.id}
                    style={[styles.referralRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.referralLeft}>
                      <Text
                        style={[styles.referralEmail, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {r.referredEmail}
                      </Text>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: STATUS_COLORS[r.status] },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: colors.subtitle }]}>
                          {STATUS_LABELS[r.status]}
                        </Text>
                        {r.status === "qualified" && (
                          <Text style={[styles.progressText, { color: colors.subtitle }]}>
                            {" "}· {r.minutesActive}/60 min
                          </Text>
                        )}
                      </View>
                    </View>
                    {r.referrerRewarded && (
                      <Ionicons name="checkmark-circle" size={22} color="#10b981" />
                    )}
                  </View>
                ))}
              </>
            ) : (
              !loading && (
                <Text style={[styles.emptyText, { color: colors.subtitle }]}>
                  No referrals yet. Invite your friends!
                </Text>
              )
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: "absolute",
    top: 54,
    left: 16,
    zIndex: 10,
    padding: 4,
  },
  scroll: {
    paddingTop: 100,
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 4,
  },
  rewardCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rewardText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  rewardNote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  sendBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 100,
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  statNum: {
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
  },
  referralRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  referralLeft: { flex: 1, gap: 4 },
  referralEmail: { fontSize: 15, fontWeight: "500" },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 13 },
  progressText: { fontSize: 13 },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 32,
  },
});
