//********************************************************************
//
// MatchesScreen Component
//
// Displays list of matches that haven't been messaged yet and pending
// message requests. Shows match profile photo, name, and navigation to chat.
// Displays message request cards that open a modal for accepting/declining.
// Uses Zustand cache for instant display and refreshes in background.
// Supports prerender mode.
//
// Return Value
// ------------
// React.ReactElement    JSX element representing the matches screen
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
// colors          Object            Theme colors
// cachedMatches   BackendMatch[]|null Matches from cache
// setMatches      Function          Zustand setter for matches
// messageRequests MessageRequest[]  Array of pending message requests
// selectedRequest MessageRequest|null Currently selected request for modal
// modalVisible    boolean           Whether message request modal is visible
// data            BackendMatch[]|null Response from API
// unmessaged      BackendMatch[]    Matches without first message
// err             Error             Error object if request fails
// matches         BackendMatch[]    Matches to display
// senderName      string            Sender's first name for modal
// senderPhoto     string|null       Sender's photo URL for modal
//
//*******************************************************************

import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "../../services/socket";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { apiGet, apiPost, apiDelete } from "../../services/apiService";
import { useTheme } from "../../context/ThemeProvider";
import GlobalBackground from "../../components/GlobalBackground";
import { useAppCache } from "../../services/appCache";
import { MessageRequestModal } from "../../components/MessageRequestModal";
import { AppImage } from "../../components/AppImage";
import { prefetchMatchAvatars } from "../../utils/imagePrefetch";
import { useAuth } from "../../context/AuthContext";
import { useIsFocused } from "@react-navigation/native";
import { useGlobalRefresh } from "../../context/RefreshContext";
import { normalizePhotos } from "../../utils/photoUtils";

interface BackendMatch {
  matchId: string;
  userUid: string;
  profile: {
    name: string;
    age?: number;
    photos: string[];
  } | null;
  createdAt: string;
  status: "active" | "restored" | "expired" | "archived";
  lastActivityAt: string;
  firstMessageAt?: string | null;
}

interface MessageRequest {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    uid: string;
    firstName: string;
    age?: number;
    photos: string[];
    profileImageUrl?: string;
  } | null;
}

interface MatchesScreenProps {
  navigation?: any;
  __prerender?: boolean;
}

export default function MatchesScreen({ navigation, __prerender }: MatchesScreenProps) {
  const { colors } = useTheme();
  const { user, idToken } = useAuth();
  const { refresh, refreshing, registerRefresher } = useGlobalRefresh();

  const cachedMatches = useAppCache((s) => s.matches);
  const cachedThreads = useAppCache((s) => s.messagesThreads);
  const setMatches = useAppCache((s) => s.setMatches);
  const messageRequestAvatars = useAppCache((s) => s.messageRequestAvatars);
  const setMessageRequestAvatar = useAppCache((s) => s.setMessageRequestAvatar);

  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MessageRequest | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [reopenOnFocus, setReopenOnFocus] = useState(false);
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);
  const [requestsLoaded, setRequestsLoaded] = useState(false);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [gridLoading, setGridLoading] = useState(true);
  const matchesLoadingRef = useRef(false);
  const matchesLastFetchRef = useRef(0);

  //********************************************************************
  //
  // fetchMessageRequests Function
  //
  // Fetches pending message requests from the backend. Called on mount
  // and when screen gains focus.
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
  // data    MessageRequest[]|null    Response from API
  //
  //*******************************************************************
  const fetchMessageRequests = useCallback(async () => {
    // Guard: Do not fetch if user is not authenticated or screen is prerendering
    if (!user || !idToken || __prerender) {
      return;
    }

    try {
      const data = await apiGet<MessageRequest[]>("/message-request/pending", idToken);
      if (Array.isArray(data)) {
        setMessageRequests(data);
        setRequestsLoaded(true);

        const prefetchable = data
          .map((r) => {
            const uid = r.sender?.uid;
            const normalized = normalizePhotos(
              r.sender?.photos,
              r.sender?.profileImageUrl ?? null
            );
            const first = normalized[0] ?? null;
            if (uid && first && first.startsWith("http")) {
              setMessageRequestAvatar(uid, first);
            }
            return {
              profile: { photos: normalized },
            };
          })
          .filter((p) => p.profile.photos.length > 0);

        if (prefetchable.length > 0) {
          prefetchMatchAvatars(prefetchable, "normal");
        }
      }
    } catch (err) {
      console.error("Failed to fetch message requests:", err);
    } finally {
      setRequestsLoaded(true);
    }
  }, [__prerender, idToken, setMessageRequestAvatar]);

  const isFocused = useIsFocused();
  const refreshMatches = useCallback(async () => {
    if (!user || !idToken || __prerender || !isFocused) return;

    if (matchesLoadingRef.current) return;

    const now = Date.now();
    if (now - matchesLastFetchRef.current < 10000) {
      return; // throttle to 10s
    }

    matchesLoadingRef.current = true;
    matchesLastFetchRef.current = now;

    try {
      const data = await apiGet<BackendMatch[]>("/matches/me", idToken);
      if (Array.isArray(data)) {
        const unmessaged = data.filter(
          (m) => !m.firstMessageAt || m.firstMessageAt === null
        );
        setMatches(unmessaged);
        setMatchesLoaded(true);
        const matchesForPrefetch = unmessaged
          .filter((m) => m.profile !== null)
          .map((m) => ({
            profile: {
              photos: m.profile!.photos as (string | null)[],
            },
          }));
        prefetchMatchAvatars(matchesForPrefetch, "normal");
      }
    } catch (err) {
      console.error("Failed to refresh matches:", err);
    } finally {
      matchesLoadingRef.current = false;
      setMatchesLoaded(true);
    }
  }, [__prerender, idToken, isFocused, setMatches, user]);

  // Fetch message requests on mount and screen focus
  useEffect(() => {
    // Guard: Only fetch if screen is focused and user is authenticated
    if (isFocused && user && !__prerender) {
      fetchMessageRequests();
      void refreshMatches();
    }
  }, [fetchMessageRequests, isFocused, __prerender, refreshMatches, user]);

  // Prefetch message request images whenever the list updates
  useEffect(() => {
    const prefetchable = messageRequests
      .map((r) => {
        const photos = normalizePhotos(
          r.sender?.photos,
          r.sender?.profileImageUrl ?? null
        );
        const uid = r.sender?.uid;
        const first = photos[0] ?? null;
        if (uid && first && first.startsWith("http") && messageRequestAvatars[uid] !== first) {
          setMessageRequestAvatar(uid, first);
        }
        return { profile: { photos } };
      })
      .filter((p) => p.profile.photos.length > 0);

    if (prefetchable.length > 0) {
      prefetchMatchAvatars(prefetchable, "normal");
    }
  }, [messageRequests, messageRequestAvatars, setMessageRequestAvatar]);

  useEffect(() => {
    const needsProfile = messageRequests
      .filter((r) => {
        const uid = r.sender?.uid;
        const cached = uid ? messageRequestAvatars[uid] : null;
        if (cached && cached.startsWith?.("http")) return false;
        const normalized = normalizePhotos(
          r.sender?.photos,
          r.sender?.profileImageUrl ?? null
        )[0] ?? null;
        return !normalized || !normalized.startsWith?.("http");
      })
      .map((r) => r.sender?.uid)
      .filter((uid): uid is string => !!uid);

    if (needsProfile.length === 0) return;

    Promise.all(
      needsProfile.map(async (uid) => {
        const profile = await apiGet<{ profileImageUrl?: string }>(`/profiles/${uid}`, idToken);
        if (profile?.profileImageUrl && profile.profileImageUrl.startsWith("http")) {
          setMessageRequestAvatar(uid, profile.profileImageUrl);
        }
      })
    ).catch(() => undefined);
  }, [messageRequests, messageRequestAvatars, setMessageRequestAvatar]);

  useFocusEffect(
    useCallback(() => {
      // If we navigated to profile and returned, reopen the modal seamlessly
      if (reopenOnFocus && selectedRequest) {
        setModalVisible(true);
        setReopenOnFocus(false);
      }
      // Guard: Only fetch if user is authenticated and not prerendering
      if (user && !__prerender) {
        fetchMessageRequests();
        void refreshMatches();
      }
    }, [fetchMessageRequests, refreshMatches, __prerender, user, reopenOnFocus, selectedRequest])
  );

  // WebSocket listener for real-time match updates
  useEffect(() => {
    if (!user || __prerender) return;

    const socket = getSocket();
    if (!socket) return;

    const handleMatchCreated = () => {
      // Refresh matches when a new match is created
      void refreshMatches();
    };

    const handleMatchUpdated = () => {
      // Refresh matches when a match is updated
      void refreshMatches();
    };

    socket.on("matchCreated", handleMatchCreated);
    socket.on("matchUpdated", handleMatchUpdated);

    return () => {
      socket.off("matchCreated", handleMatchCreated);
      socket.off("matchUpdated", handleMatchUpdated);
    };
  }, [user, __prerender, refreshMatches]);

  useEffect(() => {
    // Guard: Do not refresh if user is not authenticated, screen is prerendering, or not focused
    if (!user || __prerender || !isFocused || !cachedMatches) {
      return;
    }

    const timer = setTimeout(() => {
      refreshMatches();
    }, 100);

    return () => clearTimeout(timer);
  }, [cachedMatches, __prerender, isFocused, refreshMatches, user]);

  useEffect(() => {
    return registerRefresher(async () => {
      await fetchMessageRequests();
      await refreshMatches();
    });
  }, [fetchMessageRequests, refreshMatches, registerRefresher]);

  const resolveRequestPhoto = useCallback(
    (request: MessageRequest): string | null => {
      const uid = request.sender?.uid;
      // 1) Cache hit from request avatars
      if (uid && uid in messageRequestAvatars) {
        return messageRequestAvatars[uid];
      }
      // 2) Use already-fetched match profile photos (same source as normal matches)
      if (uid && cachedMatches) {
        const match = cachedMatches.find((m) => m.userUid === uid);
        if (match?.profile?.photos?.length) {
          const matchPhoto = match.profile.photos[0];
          setMessageRequestAvatar(uid, matchPhoto ?? null);
          return matchPhoto ?? null;
        }
      }
      // 3) Normalize sender photos/profileImageUrl
      const photos = normalizePhotos(
        request.sender?.photos,
        request.sender?.profileImageUrl ?? null
      );
      const first = photos[0] ?? null;
      if (uid) {
        setMessageRequestAvatar(uid, first ?? null);
      }
      return first;
    },
    [cachedMatches, messageRequestAvatars, setMessageRequestAvatar]
  );

  //********************************************************************
  //
  // handleRequestPress Function
  //
  // Opens the message request modal when a request card is tapped.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // request    MessageRequest    The message request to display
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
  const fetchPendingThreadPhoto = async (requestId: string) => {
    if (!idToken) return;
    try {
      const threads = await apiGet<any[]>("/chat/threads", idToken);
      const pending = threads?.find?.(
        (t) => t?.status === "pending" && t?.requestId === requestId
      );
      if (pending?.user?.profileImageUrl) {
        setSelectedPhotoUrl(pending.user.profileImageUrl);
      }
    } catch (err) {
      // Keep silent on failure; UI can still render placeholder
    }
  };

  const handleRequestPress = (request: MessageRequest) => {
    const uid = request.sender?.uid;
    const cachedPhoto = uid ? messageRequestAvatars[uid] ?? null : null;
    const pendingThreadPhoto =
      cachedThreads?.find?.(
        (t: any) => t?.status === "pending" && t?.requestId === request.id
      )?.user?.profileImageUrl ?? null;

    const initialPhoto =
      cachedPhoto ||
      pendingThreadPhoto ||
      null;

    setSelectedPhotoUrl(initialPhoto ?? null);
    setSelectedRequest(request);
    setModalVisible(true);

    if (
      (!initialPhoto || !initialPhoto.startsWith("http")) &&
      request.sender?.uid &&
      (!cachedPhoto || !cachedPhoto.startsWith?.("http"))
    ) {
      apiGet<any>(`/profiles/${request.sender.uid}`)
        .then((profile) => {
          if (profile?.profileImageUrl) {
            setSelectedPhotoUrl(profile.profileImageUrl);
            setMessageRequestAvatar(request.sender!.uid, profile.profileImageUrl);
          }
        })
        .catch((err) => {
          void fetchPendingThreadPhoto(request.id);
        });
    } else if (!initialPhoto && request.id) {
      void fetchPendingThreadPhoto(request.id);
    }
  };

  //********************************************************************
  //
  // handleAccept Function
  //
  // Accepts a message request. Calls the accept API endpoint, closes
  // the modal, removes the request from the list, navigates to Messages
  // screen, and opens the newly created chat.
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
  // res    Object|null    API response with accepted status and IDs
  //
  //*******************************************************************
  const handleAccept = async () => {
    if (!selectedRequest || !idToken) return;

    try {
      const res = await apiPost<{
        accepted: boolean;
        threadId: string;
        matchId: string;
      }>(`/message-request/${selectedRequest.id}/accept`, {}, idToken);

      if (res?.accepted) {
        setModalVisible(false);
        setSelectedRequest(null);
        setSelectedPhotoUrl(null);
        setMessageRequests((prev) =>
          prev.filter((r) => r.id !== selectedRequest.id)
        );

        // Navigate to Messages screen first
        navigation.navigate("Messages");
        
        // Then navigate to the chat
        // Use a small delay to ensure Messages screen is mounted
        setTimeout(() => {
          navigation.navigate("Chat", {
            threadId: res.threadId,
            matchId: res.matchId,
            targetId: selectedRequest.sender?.uid ?? '',
            targetName: selectedRequest.sender?.firstName ?? undefined,
          });
        }, 100);
      }
    } catch (err) {
      console.error("Failed to accept message request:", err);
    }
  };

  //********************************************************************
  //
  // handleDecline Function
  //
  // Declines a message request. Calls the reject API endpoint, closes
  // the modal, and removes the request from the list.
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
  // res    Object|null    API response
  //
  //*******************************************************************
  const handleDecline = async () => {
    if (!selectedRequest || !idToken) return;

    try {
      const res = await apiPost(`/message-request/${selectedRequest.id}/reject`, {}, idToken);
      if (res) {
        setModalVisible(false);
        setSelectedRequest(null);
        setSelectedPhotoUrl(null);
        setMessageRequests((prev) =>
          prev.filter((r) => r.id !== selectedRequest.id)
        );
      }
    } catch (err) {
      console.error("Failed to reject message request:", err);
    }
  };

  //********************************************************************
  //
  // handleCloseModal Function
  //
  // Closes the message request modal and clears the selected request.
  // Called when user dismisses modal (e.g., Android back button).
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
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedRequest(null);
    setSelectedPhotoUrl(null);
  };

  if (__prerender) {
    return <View style={{ width: 1, height: 1, opacity: 0 }} />;
  }

  const matches = cachedMatches || [];

  useEffect(() => {
    setGridLoading(!(requestsLoaded && matchesLoaded));
  }, [requestsLoaded, matchesLoaded]);
  const senderName = selectedRequest?.sender?.firstName ?? "User";
  const senderPhoto =
    selectedPhotoUrl ??
    selectedRequest?.sender?.profileImageUrl ??
    normalizePhotos(
      selectedRequest?.sender?.photos,
      selectedRequest?.sender?.profileImageUrl ?? null,
    )[0] ??
    null;


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlobalBackground />

      <ScrollView 
        contentContainerStyle={styles.contentWrap}
        showsVerticalScrollIndicator={false}
        accessible={false}
        importantForAccessibility="no"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent ?? colors.text}
            colors={[colors.accent ?? colors.text]}
          />
        }
      >
        <Text 
          style={[styles.header, { color: colors.text }]}
          accessible={true}
          accessibilityRole="header"
          allowFontScaling={true}
        >
          Matches
        </Text>

        {gridLoading && (
          <View style={styles.loadingGrid} accessible={false} importantForAccessibility="no">
            <ActivityIndicator
              size="large"
              color={colors.accent ?? colors.text}
            />
          </View>
        )}

        {!gridLoading && messageRequests.length === 0 && matches.length === 0 && (
          <Text 
            style={[styles.placeholder, { color: colors.subtitle }]}
            accessible={true}
            accessibilityRole="text"
            allowFontScaling={true}
          >
            No Matches Found
          </Text>
        )}

        {!gridLoading && (
          <View style={styles.matchesGrid}>
            {messageRequests.map((request) => {
              const senderNameCard = request.sender?.firstName ?? "Unknown";
              const cachedMatchAge = cachedMatches?.find((m) => m.userUid === request.sender?.uid)?.profile?.age ?? null;
              const senderAge = request.sender?.age ?? cachedMatchAge;
              const senderDisplayName = senderAge ? `${senderNameCard} • ${senderAge}` : senderNameCard;
              const uid = request.sender?.uid;
              const photo =
                (uid && messageRequestAvatars[uid]) ||
                "https://via.placeholder.com/100";
              return (
                <TouchableOpacity
                  key={request.id}
                  style={[
                    styles.matchCard,
                    styles.cardShadow,
                    { backgroundColor: '#ffffff', borderColor: '#e0e0e0' },
                  ]}
                  onPress={() => handleRequestPress(request)}
                  accessible={true}
                  accessibilityLabel={`Message request from ${senderDisplayName}. Tap to view`}
                  accessibilityRole="button"
                >
                  <View style={styles.imageWrap}>
                    <AppImage
                      source={photo}
                      style={styles.matchCardImage}
                      accessibilityLabel={`Profile photo of ${senderNameCard}`}
                      accessibilityRole="image"
                      priority="normal"
                    />
                    <View style={styles.requestImageOverlay} />
                    <View style={styles.requestIconWrapper} accessible={false} importantForAccessibility="no">
                      <AppImage
                        source={require("../../../assets/icons/message.png")}
                        style={styles.requestIcon}
                        accessibilityRole="none"
                        contentFit="contain"
                      />
                    </View>
                  </View>
                  <View style={[styles.matchCardFooter, { backgroundColor: '#ffffff' }]}>
                    <Text
                      style={[styles.matchCardName, { color: '#000000' }]}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      {senderDisplayName}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {matches.map((m) => {
              const matchName = m.profile?.name ?? "Unknown";
              const matchAge = m.profile?.age;
              const matchDisplayName = matchAge ? `${matchName} • ${matchAge}` : matchName;
              return (
                <TouchableOpacity
                  key={m.matchId}
                  style={[
                    styles.matchCard,
                    styles.cardShadow,
                    { backgroundColor: '#ffffff', borderColor: '#e0e0e0' },
                  ]}
                  onPress={() =>
                    navigation.navigate("UserProfileView", {
                      userId: m.userUid,
                      matchId: m.matchId,
                      targetName: matchName,
                    })
                  }
                  disabled={unmatchingId === m.matchId}
                  accessible={true}
                  accessibilityLabel={`Match with ${matchDisplayName}. Tap to view profile.`}
                  accessibilityRole="button"
                  accessibilityHint="Opens profile view for this match"
                >
                  <View style={styles.imageWrap}>
                    <AppImage
                      source={m.profile?.photos?.[0] ?? "https://via.placeholder.com/100"}
                      style={styles.matchCardImage}
                      accessibilityLabel={`Profile photo of ${matchName}`}
                      accessibilityRole="image"
                      priority="normal"
                    />
                  </View>
                  <View style={[styles.matchCardFooter, { backgroundColor: '#ffffff' }]}>
                    <Text
                      style={[styles.matchCardName, { color: '#000000' }]}
                      allowFontScaling={true}
                      accessible={false}
                      importantForAccessibility="no"
                    >
                      {matchDisplayName}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selectedRequest && (
        <MessageRequestModal
          visible={modalVisible}
          senderPhoto={selectedPhotoUrl}
          senderName={senderName}
          requestId={selectedRequest.id}
          message={selectedRequest.content}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onClose={handleCloseModal}
          onOpenProfile={() => {
            setModalVisible(false);
            setReopenOnFocus(true);
            if (selectedRequest?.sender?.uid) {
              navigation.navigate("UserProfileView", {
                userId: selectedRequest.sender.uid,
                targetName: senderName,
                fromChat: false,
              });
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  contentWrap: {
    paddingTop: 50,
    paddingBottom: 140,
  },

  header: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 20,
  },

  placeholder: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  loadingGrid: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  matchesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  matchCard: {
    width: "48%",
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  matchCardImage: {
    width: "100%",
    height: "100%",
  },

  imageWrap: {
    flex: 1,
    width: "100%",
  },

  requestImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#141414a6",
  },
  requestIconWrapper: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 24,
    height: 24,
    transform: [{ translateX: -12 }, { translateY: -12 }],
    alignItems: "center",
    justifyContent: "center",
  },
  requestIcon: {
    width: 80,
    height: 80,
    tintColor: "#ffffff",
  },

  matchCardFooter: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  matchCardName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
  },
});
