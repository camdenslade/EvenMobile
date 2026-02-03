//********************************************************************
//
// useChatThread Hook
//
// This React hook manages a single chat thread's messages and socket
// connection. Supports both existing threads (with threadId) and new
// threads created on first message (matchId only). Handles joining/
// leaving socket rooms and receiving live messages.
//
// Return Value
// ------------
// Object containing:
//   threadId     string|null         Current thread ID
//   messages     ChatMessage[]       Array of chat messages
//   sendMessage  (text, imageUrl) => void    Function to send message
//   reload       () => Promise       Function to reload messages
//
// Value Parameters
// ----------------
// initialThreadId    string|null    Optional existing thread ID
// matchId            string         Required match ID
//
// Reference Parameters
// --------------------
// None (React hook)
//
// Local Variables
// ---------------
// threadId           string|null         Local state for thread ID
// messages           ChatMessage[]       Local state for messages
// isMounted          boolean             Component mount status (ref)
// socket             Socket|null         Socket.io connection instance
// data               ChatMessage[]|null Response from API
// payload            Object              Socket event payload
// msg                ChatMessage         Incoming message object
//
//*******************************************************************

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Alert } from "react-native";

import { apiGet, apiPost } from "../services/apiService";
import { initSocket, getSocket, refreshSocketAuth } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import { useSessionData } from "../context/SessionDataContext";

import type { ChatMessage } from "../types/chat";

interface UseChatThreadParams {
  threadId?: string | null;
  matchId?: string | null;
}

export function useChatThread({ threadId: initialThreadId, matchId }: UseChatThreadParams) {
  const { user, idToken } = useAuth();
  const { userSummary } = useSessionData();
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const isMounted = useRef(true);

  //********************************************************************
  //
  // loadMessages Function
  //
  // Loads messages for the current thread from the backend API. Only
  // executes if threadId exists. Updates local state only if component
  // is still mounted.
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
  // data    ChatMessage[]|null    Response from API
  //
  //*******************************************************************
  const loadMessages = useCallback(async () => {
    // Guard: Do not load if user is not authenticated or no token
    if (!user || !idToken || !threadId) return;

    const data = await apiGet<ChatMessage[]>(`/chat/messages/${threadId}`, idToken);

    if (data && isMounted.current) {
      setMessages((prev) => {
        // Preserve any pending optimistic messages that haven't been confirmed yet
        const pendingMessages = prev.filter((m) => m.pending);
        
        // Merge: use server data, but keep pending messages that don't have a match yet
        const serverMessageIds = new Set(data.map((m) => m.id));
        const unmatchedPending = pendingMessages.filter(
          (pending) =>
            !data.some(
              (server) =>
                server.text === pending.text &&
                Math.abs(
                  new Date(server.createdAt).getTime() -
                    new Date(pending.createdAt).getTime()
                ) < 5000
            )
        );

        return [...data, ...unmatchedPending];
      });
    }
  }, [threadId, user, idToken]);

  useEffect(() => {
    isMounted.current = true;

    if (threadId) {
      void loadMessages();
    }

    return () => {
      isMounted.current = false;
      // Socket persists across navigation - only closed on logout (handled in AuthContext)
    };
  }, [threadId, loadMessages]);

  useEffect(() => {
    // Guard: Do not setup socket if user is not authenticated or no token
    if (!user || !idToken) {
      return;
    }

    let socket = getSocket();

    const setupSocket = async () => {
      // Double-check auth before initializing socket
      if (!user || !idToken) {
        return;
      }

      socket = socket ?? (await initSocket(idToken));
      if (!socket) {
        // Blocker #5 - Socket unavailable, REST fallback will be used
        console.warn("Socket connection unavailable - using REST fallback");
        return;
      }

      // Ensure socket auth stays fresh
      await refreshSocketAuth(idToken);

      if (threadId) {
        socket.emit("joinThread", { threadId });
      }

      const handleThreadCreated = (payload?: { matchId?: string; threadId?: string }) => {
        if (!isMounted.current || !payload?.threadId) return;
        if (matchId && payload.matchId && payload.matchId !== matchId) return;

        setThreadId(payload.threadId);

        if (threadId) {
          socket?.emit("leaveThread", { threadId });
        }
        socket?.emit("joinThread", { threadId: payload.threadId });
      };

      const handleIncomingMessage = (msg?: (ChatMessage & { threadId?: string })) => {
        if (!isMounted.current || !msg?.threadId) return;

        if (threadId && msg.threadId !== threadId) return;

        setMessages((prev) => {
          // Try to match with optimistic message by text and approximate time
          // This handles messages we just sent
          const matchingPending = prev.find(
            (m) =>
              m.pending &&
              m.text === msg.text &&
              m.threadId === msg.threadId &&
              // Match if sent within last 5 seconds (handles timing differences)
              Math.abs(
                new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()
              ) < 5000
          );

          if (matchingPending) {
            // Replace optimistic message with real message
            return prev.map((m) =>
              m.localId === matchingPending.localId
                ? { ...msg, pending: false }
                : m
            );
          }

          // Otherwise, check if message already exists (avoid duplicates)
          const exists = prev.some((m) => m.id === msg.id);
          if (exists) {
            return prev;
          }

          // Add new message
          return [...prev, msg as ChatMessage];
        });
      };

      const handleReconnect = () => {
        // Reload messages when socket reconnects to fetch missed messages
        if (threadId) {
          void loadMessages();
          // Rejoin thread room
          socket?.emit("joinThread", { threadId });
        }
      };

      socket.on("connect", handleReconnect);
      socket.on("threadCreated", handleThreadCreated);
      socket.on("newMessage", handleIncomingMessage);

      return () => {
        if (threadId) {
          socket?.emit("leaveThread", { threadId });
        }
        socket?.off("connect", handleReconnect);
        socket?.off("threadCreated", handleThreadCreated);
        socket?.off("newMessage", handleIncomingMessage);
      };
    };

    const cleanupPromise = setupSocket();

    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [threadId, matchId, loadMessages, user, idToken]);

  //********************************************************************
  //
  // sendMessage Function
  //
  // Sends a chat message via socket. If threadId is null, backend will
  // create a new thread and emit "threadCreated" event.
  //
  // Return Value
  // ------------
  // void
  //
  // Value Parameters
  // ----------------
  // text        string          Message text content
  // imageUrl    string|null     Optional image URL
  //
  // Reference Parameters
  // --------------------
  // None
  //
  // Local Variables
  // ---------------
  // socket    Socket|null    Socket.io connection instance
  //
  //*******************************************************************
  const sendMessage = useCallback(
    async (text: string, imageUrl: string | null = null) => {
      // Require a matchId or existing thread to send
      if (!matchId && !threadId) {
        return;
      }

      const localId = `local-${Date.now()}`;

      // Optimistic append so user sees the message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: localId,
          localId,
          pending: true,
          threadId: threadId ?? "pending",
          senderId: user?.uid ?? "me",
          text,
          imageUrl,
          createdAt: new Date().toISOString(),
        },
      ]);

      const socket = getSocket();
      
      // Try WebSocket first, fallback to REST API if not connected
      if (socket && socket.connected) {
        socket.emit("sendMessage", {
          matchId: matchId ?? null,
          threadId: threadId ?? null,
          text,
          imageUrl,
        });
      } else {
        // Fallback to REST API if WebSocket not available
        try {
          if (!matchId) {
            console.error("Cannot send message: matchId required for REST API");
            // Remove failed optimistic message
            setMessages((prev) => prev.filter((msg) => msg.localId !== localId));
            return;
          }
          
          if (!idToken) {
            console.error("Cannot send message: no auth token");
            setMessages((prev) => prev.filter((msg) => msg.localId !== localId));
            return;
          }
          
          const saved = await apiPost(
            `/chat/messages/${matchId}`,
            { content: text },
            idToken
          );
          
          // Update optimistic message with real message data
          if (saved) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.localId === localId
                  ? { ...saved, pending: false }
                  : msg
              )
            );
            
            // Reload messages to ensure consistency
            if (threadId) {
              void loadMessages();
            }
          } else {
            // Remove failed optimistic message if save failed
            setMessages((prev) => prev.filter((msg) => msg.localId !== localId));
          }
        } catch (err) {
          console.error("Failed to send message:", err);
          // Remove failed optimistic message (Blocker #2)
          setMessages((prev) => prev.filter((msg) => msg.localId !== localId));
          Alert.alert("Message failed", "Could not send message. Please check your connection.");
        }
      }
    },
    [threadId, matchId, user, idToken, loadMessages]
  );

  return {
    threadId,
    messages,
    sendMessage,
    reload: loadMessages,
  };
}
