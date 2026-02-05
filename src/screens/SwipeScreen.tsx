//********************************************************************
//
// SwipeScreen Component
//
// Main swipe screen displaying profile cards for swiping. Manages swipe
// queue, location requirements, match modal, and bottom button state.
// Handles like/skip actions and navigation to profile view.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the swipe screen
//
// Value Parameters
// ----------------
// navigation    any         Navigation object for routing
// __prerender   boolean     Flag for prerendering (returns null if true)
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// colors                 Object            Theme colors
// profiles               UserProfile[]     Array of swipeable profiles
// state                  SwipeState        Current swipe state machine state
// currentProfile         UserProfile|null Top profile in queue
// interactionDisabled    boolean          Whether interactions are disabled
// contextLocation        Object           Location from context
// requireLocation        Function         Function to ensure location available
// locationReady          boolean          Whether location is ready
// locationLat            number|null      Latitude from context
// locationLng            number|null      Longitude from context
// hasLocation            boolean          Whether location exists
// matchOpen              boolean          Whether match modal is open
// matchId                string|null      Match ID if match found
// matchPhotos            Object           Match photos (me, them)
// swipeDeckRef           SwipeDeckRef     Ref to SwipeDeck component
// pendingLikeProfileRef  UserProfile|null Profile pending like action
// profileToLike          UserProfile      Profile being liked
// res                    Object|null      API response
// error                  Error            Error object if like fails
//
//*******************************************************************

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Text, AccessibilityInfo, Platform, Alert, Modal, TextInput, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { hasSeenTutorial, markTutorialComplete } from "../utils/tutorialStorage";
import type { RouteProp } from "@react-navigation/native";

import { useSwipeQueue } from "../hooks/useSwipeQueue";
import { apiGet, apiPost } from "../services/apiService";
import SwipeDeck, { SwipeDeckRef } from "../components/SwipeDeck";
import { MatchModal } from "../components/MatchModal";
import { useLocation } from "../hooks/useLocation";
import { useTheme } from "../context/ThemeProvider";
import GlobalBackground from "../components/GlobalBackground";
import { useBottomButtons } from "../context/BottomButtonsContext";
import { useSessionData } from "../context/SessionDataContext";
import { useAuth } from "../context/AuthContext";
import type { UserProfile } from "../types/user";
import { PurchaseOptionsModal } from "../components/PurchaseOptionsModal";
import { FLAGGED_WORDS } from "../constants/flaggedWords";
import type { RootStackParamList } from "../../App";
import { TutorialOverlay } from "../components/TutorialOverlay";

const MAX_MESSAGE_REQ_LEN = 240;

interface SwipeScreenProps {
  navigation?: any;
  route?: RouteProp<RootStackParamList, "Swipe">;
  __prerender?: boolean;
}

export default function SwipeScreen({ navigation, route, __prerender }: SwipeScreenProps) {
  const { colors } = useTheme();
  const { idToken } = useAuth();
  const refreshQueueFlag = route?.params?.refreshQueue;

  if (__prerender) return null;

  const {
    profiles,
    state,
    currentProfile,
    skip,
    undo,
    shuffle,
    reload,
    like,
    undoAvailable,
    shuffling,
    clearMatch,
    markPendingSender,
  } = useSwipeQueue();

  const interactionDisabled = state.status !== "IDLE";

  const { location: contextLocation, requireLocation } = useLocation();
  
  const [locationReady, setLocationReady] = useState(() => {
    return !!(contextLocation.latitude && contextLocation.longitude);
  });

  const locationLat = contextLocation.latitude;
  const locationLng = contextLocation.longitude;
  const hasLocation = useMemo(() => !!(locationLat && locationLng), [locationLat, locationLng]);

  useFocusEffect(
    useCallback(() => {
      if (hasLocation) {
        setLocationReady(true);
        return;
      }

      const timer = setTimeout(() => {
        (async () => {
          const loc = await requireLocation();
          if (!loc?.latitude || !loc?.longitude) {
            setLocationReady(false);
            return;
          }
          setLocationReady(true);
        })();
      }, 50);

      return () => clearTimeout(timer);
    }, [requireLocation, hasLocation])
  );

  useFocusEffect(
    useCallback(() => {
      if (refreshQueueFlag) {
        void reload();
        navigation?.setParams?.({ refreshQueue: undefined });
      }
    }, [navigation, reload, refreshQueueFlag])
  );

  const [matchOpen, setMatchOpen] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchPhotos, setMatchPhotos] = useState({ me: "", them: "" });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseFeature, setPurchaseFeature] = useState<"messageRequest" | "undo" | "search">("messageRequest");
  const [confirmUndoVisible, setConfirmUndoVisible] = useState(false);
  const [confirmMessageVisible, setConfirmMessageVisible] = useState(false);
  const [messageRequestText, setMessageRequestText] = useState("Hey there!");
  const [showTutorial, setShowTutorial] = useState(false);

  const swipeDeckRef = useRef<SwipeDeckRef>(null);


  //********************************************************************
  //
  // Empty Deck Detection Effect
  //
  // Detects when the deck becomes empty and logs it. This is safe
  // because it runs in useEffect, not during render. The empty UI
  // is already handled by conditional rendering below. Also announces
  // to screen readers when the deck is exhausted.
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
  useEffect(() => {
    if (locationReady && profiles.length === 0) {
      AccessibilityInfo.announceForAccessibility("No more profiles nearby. Try again later.");
    }
  }, [profiles.length, locationReady]);


  // Check if user has seen tutorial - show it on first load with profiles
  useEffect(() => {
    if (locationReady && profiles.length > 0) {
      (async () => {
        const seen = await hasSeenTutorial();
        if (!seen) {
          // Small delay to let the screen settle before showing tutorial
          setTimeout(() => {
            setShowTutorial(true);
          }, 500);
        }
      })();
    }
  }, [locationReady, profiles.length]);

  //********************************************************************
  //
  // Match Detection Effect
  //
  // Watches for match state from useSwipeQueue and opens match modal
  // when a match is found. This ensures match UI is shown after the
  // like() function completes and updates state. Also announces match
  // to screen readers.
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
  useEffect(() => {
    if (state.status === "MATCH_FOUND" && "matchId" in state) {
      setMatchId(state.matchId);
      setMatchPhotos({
        me: state.mePhoto ?? "",
        them: state.themPhoto ?? "",
      });
      setMatchOpen(true);
    }
  }, [state]);

  //********************************************************************
  //
  // onLikePress Function
  //
  // Handles like button press. Triggers upward animation. The actual
  // like API call is handled by useSwipeQueue's like() function.
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
  const onLikePress = useCallback(() => {
    if (!currentProfile || interactionDisabled) return;
    swipeDeckRef.current?.swipeUp();
  }, [currentProfile, interactionDisabled]);

  //********************************************************************
  //
  // onLikeHandler Function
  //
  // Handles like action after animation completes. Calls useSwipeQueue's
  // like() function which handles the API call and match detection.
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
  // None
  //
  //*******************************************************************
  const onLikeHandler = useCallback(async () => {
    await like();
  }, [like]);

  const onSkip = useCallback(() => skip(), [skip]);

  const handleOpenProfile = useCallback(
    (userId: string) => {
      navigation.navigate("UserProfileView", { userId, fromSwipeCard: true });
    },
    [navigation]
  );

  const { setButtonsState } = useBottomButtons();
  const { userSummary, paymentFlags, userFlags, refreshSessionData } = useSessionData();

  const canUseMessageRequest = useCallback(() => {
    const pf = paymentFlags || {
      enablePayments: true,
      enableSearchTokens: true,
      enableUndoTokens: true,
      enableMessageReqTokens: true,
    };
    const uf = userFlags || {
      unlimitedSearch: false,
      unlimitedUndo: false,
      unlimitedMessageReq: false,
    };

    if (!pf.enablePayments) return true;
    if (!pf.enableMessageReqTokens) return true;
    if (uf.unlimitedMessageReq) return true;
    return (userSummary?.messageTokens ?? 0) > 0;
  }, [paymentFlags, userFlags, userSummary?.messageTokens]);

  const handleUndoPress = useCallback(() => {
    const pf = paymentFlags || {
      enablePayments: true,
      enableSearchTokens: true,
      enableUndoTokens: true,
      enableMessageReqTokens: true,
    };
    const uf = userFlags || {
      unlimitedSearch: false,
      unlimitedUndo: false,
      unlimitedMessageReq: false,
    };

    const hasUndo = !pf.enablePayments || !pf.enableUndoTokens || uf.unlimitedUndo || (userSummary?.undoTokens ?? 0) > 0;
    if (!hasUndo) {
      setPurchaseFeature("undo");
      setShowPurchaseModal(true);
      return;
    }
    setConfirmUndoVisible(true);
  }, [paymentFlags, userFlags, userSummary?.undoTokens]);

  const handleMessagePress = useCallback(() => {
    if (!profiles.length) return;
    if (!canUseMessageRequest()) {
      setPurchaseFeature("messageRequest");
      setShowPurchaseModal(true);
      return;
    }
    setConfirmMessageVisible(true);
  }, [canUseMessageRequest]);

  const handleTutorialComplete = useCallback(async () => {
    await markTutorialComplete();
    setShowTutorial(false);
    AccessibilityInfo.announceForAccessibility("Tutorial complete. You can start swiping now!");
  }, []);

  const handleTutorialSkip = useCallback(async () => {
    await markTutorialComplete();
    setShowTutorial(false);
  }, []);

  const onMessageRequest = useCallback(async () => {
    const target = profiles[0];
    if (!target) {
      Alert.alert("No profile", "No profile available to message.");
      return;
    }

    const sanitized = messageRequestText.replace(/[<>]/g, "").trim();
    if (!sanitized) {
      Alert.alert("Add a note", "Please enter a short message to send.");
      return;
    }
    if (sanitized.length > MAX_MESSAGE_REQ_LEN) {
      Alert.alert(
        "Message too long",
        `Please keep your note under ${MAX_MESSAGE_REQ_LEN} characters.`
      );
      return;
    }
    const lower = sanitized.toLowerCase();
    if (FLAGGED_WORDS.some((w) => lower.includes(w))) {
      Alert.alert(
        "Content blocked",
        "Your message contains words we can't send. Please revise and try again."
      );
      return;
    }

    try {
      const res = await apiPost<{ error?: string; message?: string }>("/message-request", {
        recipientUid: target.userUid,
        content: sanitized || "Hey there!",
      });
      if (!res) {
        // Refresh session data even on failure - token may have been consumed
        refreshSessionData().catch((err) => {
          console.error("Failed to refresh session after message request:", err);
        });
        Alert.alert(
          "Message not sent",
          "We couldn't send that request. It may have been blocked by content filters. Please try a different note."
        );
        return;
      }

      // Refresh session data to update token count (non-blocking)
      refreshSessionData().catch((err) => {
        console.error("Failed to refresh session after message request:", err);
        // Message request succeeded, just token count might be stale
      });

      const deck = swipeDeckRef.current;
      const animateThenHandle = async () => {
        markPendingSender(target.userUid);
        try {
          await like();
          setConfirmMessageVisible(false);
          navigation.navigate("Messages");
        } catch (likeError) {
          console.error("Like failed after message request:", likeError);
          // Message was sent successfully, but like failed
          // Still mark as pending and navigate to messages
          setConfirmMessageVisible(false);
          navigation.navigate("Messages");
        }
      };
      if (deck?.swipeUpCustom) {
        deck.swipeUpCustom(animateThenHandle);
      } else {
        await animateThenHandle();
      }
    } catch (error) {
      console.error("Failed to send message request", error);
      // Refresh session data even on error - token may have been consumed
      refreshSessionData().catch((err) => {
        console.error("Failed to refresh session after message request error:", err);
      });
      Alert.alert(
        "Message request failed",
        "We couldn't send that request. Please try again with a different note."
      );
    }
  }, [profiles, refreshSessionData, navigation, messageRequestText, markPendingSender, like]);

  const buttonsStateMemo = useCallback(
    () => ({
      disabled: interactionDisabled || !locationReady || (profiles.length === 0 && !undoAvailable),
      onUndo: handleUndoPress,
      onLike: onLikePress,
      onMessage: handleMessagePress,
      undoTokens: userSummary?.undoTokens ?? 0,
      messageTokens: userSummary?.messageTokens ?? 0,
    }),
    [
      handleUndoPress,
      handleMessagePress,
      interactionDisabled,
      locationReady,
      onLikePress,
      userSummary?.messageTokens,
      userSummary?.undoTokens,
      undoAvailable,
    ]
  );

  useEffect(() => {
    setButtonsState(buttonsStateMemo());

    return () => {
      setButtonsState(null);
    };
  }, [buttonsStateMemo, setButtonsState]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <View 
        style={styles.deckWrapper}
        accessible={false}
        importantForAccessibility="no"
      >
        {!locationReady ? (
          <View 
            style={styles.centerBox}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel="Location required. Enable location to find people nearby."
          >
            <Text 
              style={[styles.emptyTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Enable Location
            </Text>
            <Text 
              style={[styles.emptySubtitle, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              Location is required to find people nearby.
            </Text>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card }]}
              onPress={async () => {
                const loc = await requireLocation();
                // If still no location, explicitly prompt again
                if (!loc?.latitude || !loc?.longitude) {
                  await requireLocation();
                }
              }}
              accessible={true}
              accessibilityLabel="Retry location"
              accessibilityRole="button"
              accessibilityHint="Attempts to enable location services again"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text 
                style={[styles.actionText, { color: colors.text }]}
                allowFontScaling={true}
                accessible={false}
                importantForAccessibility="no"
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : profiles.length === 0 ? (
          <View 
            style={styles.centerBox}
            accessible={true}
            accessibilityRole="alert"
            accessibilityLabel="No more profiles nearby. Try again later."
          >
            <Text 
              style={[styles.emptyTitle, { color: colors.text }]}
              accessible={true}
              accessibilityRole="header"
              allowFontScaling={true}
            >
              Sorry!
            </Text>
            <Text 
              style={[styles.emptySubtitle, { color: colors.subtitle }]}
              accessible={true}
              accessibilityRole="text"
              allowFontScaling={true}
            >
              Nobody nearby. Try again later.
            </Text>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, opacity: shuffling ? 0.5 : 1 }]}
              onPress={shuffle}
              disabled={shuffling}
              accessible={true}
              accessibilityLabel={shuffling ? "Shuffling..." : "Shuffle queue"}
              accessibilityRole="button"
              accessibilityHint="Refreshes the profile queue to find new matches"
              accessibilityState={{ disabled: shuffling }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {shuffling ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text
                  style={[styles.actionText, { color: colors.text }]}
                  allowFontScaling={true}
                  accessible={false}
                  importantForAccessibility="no"
                >
                  Shuffle
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <SwipeDeck
            ref={swipeDeckRef}
            profiles={profiles}
            onSkip={onSkip}
            onLike={onLikeHandler}
            onPressProfile={handleOpenProfile}
          />
        )}
      </View>

      <PurchaseOptionsModal
        visible={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
        initialFeature={purchaseFeature}
        userSummary={userSummary}
        paymentFlags={paymentFlags}
        onPurchased={async () => {
          await refreshSessionData();
        }}
      />

      <MatchModal
        visible={matchOpen}
        mePhoto={matchPhotos.me}
        themPhoto={matchPhotos.them}
        onClose={() => {
          setMatchOpen(false);
          clearMatch();
        }}
        onMessage={() => {
          setMatchOpen(false);
          clearMatch();
          if (matchId) {
            navigation.navigate("Chat", { matchId });
          } else {
            navigation.navigate("Messages");
          }
        }}
      />

      <Modal
        transparent
        visible={confirmUndoVisible}
        animationType="fade"
        onRequestClose={() => setConfirmUndoVisible(false)}
      >
        <View style={styles.modalCenter}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Use an undo?</Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              This will consume one undo token.
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={() => {
                setConfirmUndoVisible(false);
                undo();
              }}
              accessible={true}
              accessibilityLabel="Use undo"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>Use undo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }]}
              onPress={() => setConfirmUndoVisible(false)}
              accessible={true}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={confirmMessageVisible}
        animationType="fade"
        onRequestClose={() => setConfirmMessageVisible(false)}
      >
        <View style={styles.modalCenter}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.subtitle }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Send message request?</Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtitle }]}>
              This will use one message request token.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.subtitle + "44" },
              ]}
              value={messageRequestText}
              onChangeText={setMessageRequestText}
              placeholder="Add a note..."
              placeholderTextColor={colors.subtitle}
              multiline
              maxLength={200}
            />

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: colors.accent }]}
              onPress={async () => {
                setConfirmMessageVisible(false);
                await onMessageRequest();
              }}
              accessible={true}
              accessibilityLabel="Send message request"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnText, { color: colors.buttonText }]}>Send</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtnOutline, { borderColor: colors.text }]}
              onPress={() => setConfirmMessageVisible(false)}
              accessible={true}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalBtnOutlineText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TutorialOverlay
        visible={showTutorial}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deckWrapper: { 
    flex: 1, 
    marginBottom: 120,
    pointerEvents: 'box-none',
  },

  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  actionBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionText: { 
    fontSize: 18, 
    fontWeight: "600",
  },

  emptyTitle: { 
    fontSize: 24, 
    fontWeight: "bold",
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },
  modalCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalBox: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalBtn: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
  modalBtnOutline: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 44 : 48,
    justifyContent: "center",
  },
  modalBtnOutlineText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});
