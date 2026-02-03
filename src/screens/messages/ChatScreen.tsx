//********************************************************************
//
// ChatScreen Component
//
// Displays chat messages in a thread and allows sending new messages.
// Shows review button when both users have exchanged at least 2 messages.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the chat screen
//
// Value Parameters
// ----------------
// route        any         Route params containing threadId and targetId
// navigation   any         Navigation object for routing
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// threadId         string|null         Thread ID from route params
// targetId          string              Target user ID from route params
// colors            Object              Theme colors
// isDark            boolean             Whether dark theme is active
// messages          ChatMessage[]       Array of chat messages
// sendMessage       Function            Function to send message
// uid               string|null         Current user's Cognito sub
// text              string              Message input text
// listRef           FlatList            Ref to message list
// u                 User|null           Cognito current user
// isMine            boolean             Whether message is from current user
// myMessages        ChatMessage[]       Messages from current user
// theirMessages     ChatMessage[]      Messages from other user
//
//*******************************************************************

import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Keyboard,
  Alert,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";

import { useChatThread } from "../../hooks/useChatThread";
import { useAuth } from "../../context/AuthContext";
import GlobalBackground from "../../components/GlobalBackground";
import { useTheme } from "../../context/ThemeProvider";
import { useAppCache } from "../../services/appCache";
import { apiGet } from "../../services/apiService";
import { FLAGGED_WORDS } from "../../constants/flaggedWords";

const INPUT_BAR_HEIGHT = 92;

export default function ChatScreen({ route, navigation }: any) {
  const { threadId, targetId, matchId, targetName } = route.params || {};
  const { colors } = useTheme();
  const { user, idToken } = useAuth();
  const cachedThreads = useAppCache((s) => s.messagesThreads);

  const { messages, sendMessage } = useChatThread({ threadId, matchId });

  const [uid, setUid] = useState<string | null>(null);
  const [hasMyReview, setHasMyReview] = useState(false);
  const [reviewStatusLoaded, setReviewStatusLoaded] = useState(false);

  const [text, setText] = useState("");
  const [expandedTimestamp, setExpandedTimestamp] = useState<string | null>(
    null
  );

  const listRef = useRef<FlatList>(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  const headerTitle = useMemo(() => {
    if (targetName) return targetName;

    const thread = cachedThreads?.find((t: any) => {
      if (threadId && t?.threadId === threadId) return true;
      if (targetId && t?.user?.uid === targetId) return true;
      return false;
    });

    return thread?.user?.name || "Chat";
  }, [cachedThreads, targetId, targetName, threadId]);

  useEffect(() => {
    const fetchReviewStatus = async () => {
      if (!targetId || !uid) return;

      setReviewStatusLoaded(false);

      try {
        if (!idToken) return;
        const reviews = await apiGet<any[]>(`/reviews/user/${targetId}`, idToken);
        setHasMyReview(reviews?.some((r) => r.reviewerUid === uid) ?? false);
      } catch (error) {
        console.error("Failed to fetch reviews for user:", error);
        setHasMyReview(false);
      } finally {
        setReviewStatusLoaded(true);
      }
    };

    fetchReviewStatus();

    const unsubscribe = navigation.addListener("focus", fetchReviewStatus);
    return unsubscribe;
  }, [navigation, targetId, uid, idToken]);

  useEffect(() => {
    if (user) setUid(user.uid);
  }, [user]);

  const chatData = useMemo(() => {
    return messages ? [...messages].reverse() : [];
  }, [messages]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -(e.endCoordinates.height - 12),
        duration: e.duration ?? 250,
        useNativeDriver: true,
      }).start();
    });

    const hide = Keyboard.addListener("keyboardWillHide", () => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardOffset]);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (FLAGGED_WORDS.some((w) => lower.includes(w))) {
      Alert.alert(
        "Message blocked",
        "Your message contains words we can't send. Please revise and try again."
      );
      return;
    }
    sendMessage(trimmed);
    setText("");
  };

  const canReview = useMemo(() => {
    if (!uid || !messages || hasMyReview) return false;

    let mine = 0;
    let theirs = 0;

    for (const m of messages) {
      if (m.senderId === uid) mine++;
      else theirs++;
      if (mine >= 2 && theirs >= 2) return true;
    }

    return false;
  }, [uid, messages, hasMyReview]);

  const writeReview = () => {
    if (!canReview) return;
    navigation.navigate("ReviewWrite", { targetId });
  };

  const formatDateSeparator = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();

    const dateStr = date.toDateString();
    const nowStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    let dateLabel: string;
    if (dateStr === nowStr) {
      dateLabel = "Today";
    } else if (dateStr === yesterdayStr) {
      dateLabel = "Yesterday";
    } else {
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffDays < 7) {
        dateLabel = date.toLocaleDateString("en-US", { weekday: "long" });
      } else {
        dateLabel = date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
    }

    return `${dateLabel} ${time}`;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const shouldShowDateSeparator = (current: any, previous: any | null): boolean => {
    if (!previous) return true;
    const currentDate = new Date(current.createdAt);
    const previousDate = new Date(previous.createdAt);
    return currentDate.toDateString() !== previousDate.toDateString();
  };

  const MessageItem = ({ item, isMine, pending, previousMessage, showDateSeparator, isExpanded, onPress }: any) => {
    const animatedHeight = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isExpanded, animatedHeight]);

    const height = animatedHeight.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 20],
    });

    const opacity = animatedHeight.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });

    return (
      <View style={styles.messageWrapper}>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={[styles.dateSeparatorText, { color: colors.subtitle }]}>
              {formatDateSeparator(item.createdAt)}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.messageContainer,
            {
              alignSelf: isMine ? "flex-end" : "flex-start",
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[
              styles.bubble,
              {
                backgroundColor: isMine
                  ? colors.accent
                  : colors.card,
                opacity: pending ? 0.6 : 1,
              },
            ]}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={
              (pending ? "Pending. " : "") +
              (isMine ? `You: ${item.text}` : `Message: ${item.text}`) +
              `. Sent at ${formatTime(item.createdAt)}`
            }
          >
            <Text
              style={{
                color: isMine ? colors.buttonText : colors.text,
                fontSize: 16,
              }}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {item.text}
            </Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.timestampContainer,
              {
                alignSelf: isMine ? "flex-end" : "flex-start",
                height,
                opacity,
              },
            ]}
          >
            <Text
              style={[
                styles.timestampBelow,
                {
                  color: colors.subtitle,
                },
              ]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {formatTime(item.createdAt)}
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }: any) => {
    const isMine = item.senderId === uid;
    const pending = item.pending;
    const previousMessage = chatData[index + 1] || null;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
    const isExpanded = expandedTimestamp === item.id;

    return (
      <MessageItem
        item={item}
        isMine={isMine}
        pending={pending}
        previousMessage={previousMessage}
        showDateSeparator={showDateSeparator}
        isExpanded={isExpanded}
        onPress={() => {
          setExpandedTimestamp(isExpanded ? null : item.id);
        }}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <View style={[styles.header, { zIndex: 3, elevation: 3 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="chevron-back"
            size={30}
            color={colors.text}
            accessible={false}
            importantForAccessibility="no"
          />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {headerTitle}
          </Text>
        </View>
        {matchId && targetId ? (
          reviewStatusLoaded && canReview ? (
            <TouchableOpacity
              onPress={writeReview}
              style={[styles.headerActionBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Write review"
              accessibilityHint="Opens review writing screen"
            >
              <Text style={[styles.headerActionBtnText, { color: colors.buttonText }]}>
                Review
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("UserProfileView", {
                  userId: targetId,
                  matchId: matchId,
                  targetName: targetName || headerTitle,
                  fromChat: true,
                })
              }
              style={styles.profileBtn}
              accessibilityRole="button"
              accessibilityLabel="View profile"
              accessibilityHint="Opens profile view for this match"
            >
              <Text style={[styles.profileBtnText, { color: colors.text }]}>
                View Profile
              </Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>

      <View style={styles.chatWrapper}>
        <Animated.View
          style={[
            styles.chatArea,
            { transform: [{ translateY: keyboardOffset }] },
          ]}
        >
          <View style={styles.listContainer}>
            <FlatList
              ref={listRef}
              data={chatData}
              keyExtractor={(m) => m.id}
              renderItem={renderMessage}
              inverted
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: 12,
                paddingBottom: 8,
              }}
              accessible={false}
              importantForAccessibility="no"
              extraData={expandedTimestamp}
              keyboardDismissMode="interactive"
            />
          </View>

          <Animated.View
            style={[
              styles.inputBarWrapper,
              {
                backgroundColor: colors.background,
                borderColor: colors.subtitle + "22",
              },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.card, color: colors.text },
              ]}
              placeholder="Message..."
              placeholderTextColor={colors.subtitle}
              value={text}
              onChangeText={setText}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              accessible={true}
              accessibilityLabel="Message input"
              accessibilityRole="none"
              accessibilityHint="Type your message here"
              allowFontScaling={true}
            />

            <TouchableOpacity
              onPress={send}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.accent },
              ]}
              accessible={true}
              accessibilityLabel="Send message"
              accessibilityRole="button"
              accessibilityHint="Sends the message"
              accessibilityState={{ disabled: !text.trim() }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text
                style={[styles.sendText, { color: colors.buttonText }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Send
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
    overflow: "hidden",
  },
  chatArea: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },

  headerActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionBtnText: {
    fontWeight: "700",
    fontSize: 14,
  },

  messageWrapper: {
    marginVertical: 4,
  },
  dateSeparator: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontWeight: "600",
  },
  messageContainer: {
    maxWidth: "80%",
    marginVertical: 1,
  },
  bubble: {
    padding: 12,
    borderRadius: 14,
  },
  timestampContainer: {
    overflow: "hidden",
  },
  timestampBelow: {
    fontSize: 11,
    marginTop: 4,
    marginHorizontal: 4,
    opacity: 0.7,
  },

  inputBarWrapper: {
    height: INPUT_BAR_HEIGHT,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },

  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 10,
    fontSize: 16,
  },

  sendBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },

  sendText: {
    fontWeight: "700",
    fontSize: 16,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 60,
    paddingBottom: 10,
    zIndex: 1,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  backText: { fontSize: 24 },
  headerInfo: { flexDirection: "column", flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  profileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  profileBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
