//********************************************************************
//
// MessagesScreen Component
//
// Displays list of chat threads and pending message requests. Handles
// accepting/rejecting message requests and navigation to chat screens.
// Uses Zustand cache for instant display and updates cache when threads
// change. Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the messages screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// __prerender   boolean     Flag for prerendering (returns minimal view if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors             Object            Theme colors
// cachedThreads      MatchThread[]|null Threads from cache
// setMessagesThreads Function          Zustand setter for threads
// threads            MatchThread[]     Threads from hook
// loading            boolean           Loading state
// reload             Function          Function to reload threads
// prevThreadsRef     MatchThread[]     Previous threads for comparison (ref)
// displayThreads     MatchThread[]     Threads to display (cached or hook)
// other              User              Other user in thread
// preview            string            Last message preview
// res                Object|null       API response
//
//*******************************************************************

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
  useWindowDimensions,
  Modal,
  Alert,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { useChatThreads } from "../../hooks/useChatThreads";
import { apiPost, apiDelete } from "../../services/apiService";
import GlobalBackground from "../../components/GlobalBackground";
import { useTheme } from "../../context/ThemeProvider";
import { useAppCache } from "../../services/appCache";
import { useGlobalRefresh } from "../../context/RefreshContext";
import { AppImage } from "../../components/AppImage";
import { useAuth } from "../../context/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import { FLAGGED_WORDS } from "../../constants/flaggedWords";

import type { MatchThread } from "../../types/chat";

interface MessagesScreenProps {
  navigation?: any;
  __prerender?: boolean;
}

export default function MessagesScreen({
  navigation,
  __prerender,
}: MessagesScreenProps) {
  const { colors, isDark } = useTheme();
  const { refresh, refreshing, registerRefresher } = useGlobalRefresh();
  const { width: screenWidth } = useWindowDimensions();
  const { user } = useAuth();

  const cachedThreads = useAppCache((s) => s.messagesThreads);
  const setMessagesThreads = useAppCache((s) => s.setMessagesThreads);

  const { threads, loading, reload } = useChatThreads();

  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);
  const [confirmUnmatchVisible, setConfirmUnmatchVisible] = useState(false);
  const [pendingUnmatchId, setPendingUnmatchId] = useState<string | null>(null);
  const [requestModal, setRequestModal] = useState<{ item: MatchThread | null; visible: boolean }>({
    item: null,
    visible: false,
  });
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const prevThreadsRef = useRef<MatchThread[]>([]);
  useEffect(() => {
    const threadsChanged =
      threads.length !== prevThreadsRef.current.length ||
      threads.some((t, i) => {
        const prev = prevThreadsRef.current[i];
        if (!prev) return true;
        // Check threadId for active/restored threads
        if (t.status !== 'pending' && prev.status !== 'pending') {
          return (
            t.threadId !== prev.threadId ||
            t.lastMessage !== prev.lastMessage ||
            t.lastMessageSenderId !== prev.lastMessageSenderId
          );
        }
        // Check requestId for pending requests
        if (t.status === 'pending' && prev.status === 'pending') {
          return (
            t.requestId !== prev.requestId ||
            t.lastMessage !== prev.lastMessage
          );
        }
        // Different statuses mean thread changed
        return true;
      });
    
    if (threadsChanged) {
      prevThreadsRef.current = threads;
      const timer = setTimeout(() => {
        setMessagesThreads(threads);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [threads, setMessagesThreads]);

  useEffect(() => {
    return registerRefresher(reload);
  }, [reload, registerRefresher]);

  if (__prerender) {
    return <View style={{ width: 1, height: 1, opacity: 0 }} />;
  }

  // Use fresh threads from API (which includes lastMessageSenderId) instead of cache
  // Cache might have old data without this field
  const displayThreads = threads.length > 0 ? threads : (cachedThreads || []);

  //********************************************************************
  //
  // handleAccept Function
  //
  // Accepts a pending message request. Makes API call to accept endpoint,
  // then navigates to chat screen with thread and match IDs.
  //
  // Return Value
  // ------------
  // Promise<void>
  //
  // Value Parameters
  // ----------------
  // item    MatchThread    Thread item containing request to accept
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // res    Object|null    API response with accepted status and IDs
  //
  //*******************************************************************
  const handleAccept = async (item: MatchThread) => {
    if (item.status !== "pending") return;

    // Optimistically keep the request in cache to avoid disappearing threads
    const insertAcceptedThread = (threadId: string, matchId: string, firstMessage?: string) => {
      const currentList: MatchThread[] =
        threads.length > 0 ? threads : (cachedThreads || []);
      const filtered: MatchThread[] = currentList.filter((t: MatchThread) =>
        t.status === "pending" ? t.requestId !== item.requestId : t.threadId !== threadId
      );
      const accepted: MatchThread = {
        status: "active",
        threadId,
        matchId,
        user: item.user,
        lastMessage: firstMessage ?? item.lastMessage ?? null,
        lastTimestamp: Date.now(),
        lastMessageSenderId: firstMessage ? user?.uid ?? null : null,
      };
      setMessagesThreads([accepted, ...filtered]);
    };

    const res = await apiPost<{
      accepted: boolean;
      threadId: string;
      matchId: string;
      firstMessage?: string;
    }>(`/message-request/${item.requestId}/accept`, {});

    if (res?.accepted) {
      insertAcceptedThread(res.threadId, res.matchId, res.firstMessage);
      await reload();
      navigation.navigate("Chat", {
        threadId: res.threadId,
        matchId: res.matchId,
        targetId: item.user.uid,
        targetName: item.user.name,
        initialMessage: res.firstMessage,
      });
      setRequestModal({ item: null, visible: false });
    }
  };

  //********************************************************************
  //
  // handleReject Function
  //
  // Rejects a pending message request. Makes API call to reject endpoint,
  // then reloads thread list.
  //
  // Return Value
  // ------------
  // Promise<void>
  //
  // Value Parameters
  // ----------------
  // item    MatchThread    Thread item containing request to reject
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // res    Object|null    API response
  //
  //*******************************************************************
  const handleReject = async (item: MatchThread) => {
    if (item.status !== "pending") return;

    const res = await apiPost(`/message-request/${item.requestId}/reject`, {});
    if (res) {
      await reload();
      setRequestModal({ item: null, visible: false });
    }
  };

  const renderSwipeActions = (matchId: string) => {
    const unmatchBgColor = "#d92d20";
    const unmatchTextColor = "#ffffff";
    
    // Calculate dimensions
    const cardWidth = screenWidth - 40; // 20 padding on each side
    const maxSwipeWidth = cardWidth * 0.4; // 40% visible
    
    return (
      <View
        style={[
          styles.unmatchActionWrapper,
          {
            width: maxSwipeWidth, // Only 25% width - limits what Swipeable reveals
            overflow: 'hidden', // Clip the card to 25%
            marginLeft: -20, // Extend to left edge (accounting for screen padding)
          },
        ]}
      >
        <View
          style={[
            styles.unmatchActionContainer,
            {
              backgroundColor: unmatchBgColor,
              borderColor: isDark ? "#ffffff" : "#222222",
              borderWidth: 1,
              width: cardWidth + 20, // Full width card extending to left edge
              position: 'absolute',
              right: 0, // Align right edge with wrapper (original card position)
              top: 0,
              bottom: 0,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.unmatchAction}
            onPress={() => handleUnmatchPress(matchId)}
            accessible={true}
            accessibilityLabel="Unmatch"
            accessibilityRole="button"
            accessibilityHint="Unmatches with this person and removes the chat"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text
              style={[
                styles.unmatchActionText,
                { color: unmatchTextColor },
              ]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              Unmatch
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleUnmatchPress = (matchId: string) => {
    // Close the swipe first, then show modal
    const ref = swipeRefs.current[matchId];
    ref?.close();
    
    // Small delay to ensure swipe closes smoothly before showing modal
    setTimeout(() => {
      setPendingUnmatchId(matchId);
      setConfirmUnmatchVisible(true);
    }, 100);
  };

  const handleConfirmUnmatch = async () => {
    if (!pendingUnmatchId) return;
    
    const matchId = pendingUnmatchId;
    const ref = swipeRefs.current[matchId];
    
    setConfirmUnmatchVisible(false);
    setPendingUnmatchId(null);
    
    try {
      setUnmatchingId(matchId);
      await apiDelete(`/matches/${matchId}`);
      await reload();
    } finally {
      setUnmatchingId(null);
      ref?.close();
    }
  };

  const handleCancelUnmatch = () => {
    if (pendingUnmatchId) {
      const ref = swipeRefs.current[pendingUnmatchId];
      ref?.close();
    }
    setConfirmUnmatchVisible(false);
    setPendingUnmatchId(null);
  };

  const renderItem = ({ item }: { item: MatchThread }) => {
    const other = item.user;

    if (item.status === "pending") {
      return (
        <TouchableOpacity
          style={[
            styles.row,
            {
              backgroundColor: '#ffffff',
              borderColor: '#e0e0e0',
              borderWidth: 1,
            },
            styles.rowShadow,
          ]}
          activeOpacity={0.8}
          onPress={() => setRequestModal({ item, visible: true })}
          accessible={true}
          accessibilityLabel={`Message request from ${other.name}. ${item.lastMessage || "Sent you a message request"}`}
          accessibilityRole="button"
          >
          <View style={styles.pendingOverlay}>
            <Text style={[styles.pendingBadge, { color: colors.buttonText, backgroundColor: colors.accent }]}>
              Message Request
            </Text>
          </View>
          <View style={styles.avatarWrap}>
            <AppImage
              source={other.profileImageUrl || "https://via.placeholder.com/100"}
              style={styles.avatar}
              accessibilityLabel={`Profile photo of ${other.name}`}
              accessibilityRole="image"
              priority="normal"
            />
            <View style={styles.avatarShade} />
            <Ionicons
              name="chatbubble-ellipses"
              size={24}
              color="#ffffff"
              style={styles.avatarIcon}
              accessible={false}
              importantForAccessibility="no"
            />
          </View>

          <View
            style={styles.textCol}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text
              style={[styles.name, { color: '#000000' }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {other.name}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.sub, { color: '#666666' }]}
              allowFontScaling={true}
              accessible={false}
              importantForAccessibility="no"
            >
              {item.lastMessage || "Sent you a message request"}
            </Text>

            <View
              style={styles.pendingButtons}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: colors.accent }]}
                onPress={() => handleAccept(item)}
                accessible={true}
                accessibilityLabel={`Accept message from ${other.name}`}
                accessibilityRole="button"
                accessibilityHint="Accepts the message request and opens chat"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.acceptText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Accept
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rejectBtn,
                  { backgroundColor: '#ffffff', borderColor: '#999999' },
                ]}
                onPress={() => handleReject(item)}
                accessible={true}
                accessibilityLabel={`Reject message from ${other.name}`}
                accessibilityRole="button"
                accessibilityHint="Rejects the message request"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.rejectText, { color: '#666666' }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Reject
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    const preview = item.lastMessage || null;
    
    const isLastMessageFromMe = item.status === 'active' || item.status === 'restored'
      ? (item.lastMessageSenderId && user?.uid && String(item.lastMessageSenderId) === String(user.uid))
      : false;

    // Only show swipe for threads with matchId (not pending requests)
    if (item.matchId) {
      return (
        <Swipeable
          key={item.threadId}
          ref={(ref) => {
            swipeRefs.current[item.matchId] = ref;
          }}
          renderRightActions={() => renderSwipeActions(item.matchId)}
          overshootRight={false}
          rightThreshold={(screenWidth - 40) * 0.40}
          friction={1}
          enableTrackpadTwoFingerGesture={false}
        >
            <TouchableOpacity
              style={[
                styles.row,
                {
                  backgroundColor: '#ffffff',
                  borderColor: '#e0e0e0',
                  borderWidth: 1,
                  zIndex: 1,
                  opacity: 1,
                },
                styles.rowShadow,
              ]}
            activeOpacity={1}
            onPress={() =>
              navigation.navigate("Chat", {
                threadId: item.threadId,
                matchId: item.matchId,
                targetId: other.uid,
                targetName: other.name,
              })
            }
            disabled={unmatchingId === item.matchId}
            accessible={true}
            accessibilityLabel={`Message from ${other.name}. ${preview || "No messages yet"}`}
            accessibilityRole="button"
            accessibilityHint="Opens chat with this person"
          >
            <AppImage
              source={other.profileImageUrl || "https://via.placeholder.com/100"}
              style={styles.avatar}
              accessibilityLabel={`Profile photo of ${other.name}`}
              accessibilityRole="image"
              priority="normal"
            />

            <View
              style={styles.textCol}
              accessible={false}
              importantForAccessibility="no"
            >
              <Text
                style={[styles.name, { color: '#000000' }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                {other.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.sub,
                  {
                    color: preview
                      ? (isLastMessageFromMe
                          ? '#999999'
                          : '#000000')
                      : '#666666',
                  },
                  preview && styles.subBold,
                ]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                {preview || "Tap to start chatting"}
              </Text>
            </View>
          </TouchableOpacity>
        </Swipeable>
      );
    }

    return (
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: '#ffffff',
            borderColor: '#e0e0e0',
            borderWidth: 1,
          },
          styles.rowShadow,
        ]}
        onPress={() =>
          navigation.navigate("Chat", {
            threadId: item.threadId,
            matchId: item.matchId,
            targetId: other.uid,
            targetName: other.name,
          })
        }
        accessible={true}
        accessibilityLabel={`Message from ${other.name}. ${preview || "No messages yet"}`}
        accessibilityRole="button"
        accessibilityHint="Opens chat with this person"
      >
        <AppImage
          source={other.profileImageUrl || "https://via.placeholder.com/100"}
          style={styles.avatar}
          accessibilityLabel={`Profile photo of ${other.name}`}
          accessibilityRole="image"
          priority="normal"
        />

        <View
          style={styles.textCol}
          accessible={false}
          importantForAccessibility="no"
        >
          <Text
            style={[styles.name, { color: '#000000' }]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {other.name}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.sub,
              {
                color: preview
                  ? (isLastMessageFromMe
                      ? '#999999'
                      : '#000000')
                  : '#666666',
              },
              preview && styles.subBold,
            ]}
            allowFontScaling={true}
            accessible={false}
            importantForAccessibility="no"
          >
            {preview || "Tap to start chatting"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <Text 
        style={[styles.header, { color: colors.text }]}
        accessible={true}
        accessibilityRole="header"
        allowFontScaling={true}
      >
        Messages
      </Text>

      {displayThreads.length === 0 && (
        <Text 
          style={[styles.placeholder, { color: colors.subtitle }]}
          accessible={true}
          accessibilityRole="text"
          allowFontScaling={true}
        >
          No messages yet.
        </Text>
      )}

      <FlatList
        data={displayThreads}
        renderItem={renderItem}
        keyExtractor={(item) =>
          item.status === "pending" ? item.requestId : item.threadId
        }
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={refresh}
        accessible={false}
        importantForAccessibility="no"
      />

      {/* Unmatch Confirmation Modal */}
      <Modal
        visible={confirmUnmatchVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelUnmatch}
        accessible={true}
        accessibilityViewIsModal={true}
      >
        <View
          style={styles.modalOverlay}
          accessible={false}
          importantForAccessibility="no"
        >
          <View
            style={[styles.modalBox, { backgroundColor: colors.card }]}
            accessible={false}
            importantForAccessibility="no"
          >
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Unmatch?
            </Text>
            <Text
              style={[styles.modalMessage, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              This will remove the match and its chat.
            </Text>

            <View
              style={styles.modalButtonsRow}
              accessible={false}
              importantForAccessibility="no"
            >
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalCancelButton,
                  { backgroundColor: colors.card, borderColor: colors.subtitle },
                ]}
                onPress={handleCancelUnmatch}
                accessible={true}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
                accessibilityHint="Cancels the unmatch action"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalCancelText, { color: colors.subtitle }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalConfirmButton,
                  { backgroundColor: colors.accent },
                ]}
                onPress={handleConfirmUnmatch}
                accessible={true}
                accessibilityLabel="Unmatch"
                accessibilityRole="button"
                accessibilityHint="Confirms unmatching with this person"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text
                  style={[styles.modalConfirmText, { color: colors.buttonText }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Unmatch
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  header: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 20,
    marginTop: 50,
  },

  placeholder: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  rowShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },

  textCol: { 
    flex: 1 
  },

  name: {
    fontSize: 18,
    fontWeight: "600",
  },

  sub: {
    marginTop: 4,
    fontSize: 14,
  },
  subBold: {
    fontWeight: "600",
  },

  pendingButtons: {
    flexDirection: "row",
    marginTop: 8,
    gap: 10,
  },

  acceptBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginRight: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptText: {
    fontWeight: "600",
  },

  rejectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    minWidth: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
    alignItems: "center",
  },
  rejectText: {
    fontWeight: "600",
  },

  unmatchActionWrapper: {
    position: "relative",
  },
  unmatchActionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    // Matches exact dimensions of styles.row (top card)
    // Height determined by top/bottom positioning to match wrapper
  },
  unmatchAction: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },
  unmatchActionText: {
    fontWeight: "700",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalBox: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: "center",
    lineHeight: 22,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    minHeight: Platform.OS === 'ios' ? 44 : 48,
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalConfirmButton: {
    // Uses colors.accent from inline style
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: "700",
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  avatarShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  avatarIcon: {
    position: "absolute",
    bottom: 6,
    right: 6,
  },
  pendingOverlay: {
    position: "absolute",
    left: 12,
    top: 12,
    zIndex: 2,
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
});
