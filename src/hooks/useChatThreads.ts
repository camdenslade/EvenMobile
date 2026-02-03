//********************************************************************
//
// useChatThreads Hook
//
// This React hook manages the chat threads list for the messaging screen.
// It loads threads from the backend on mount and refreshes them when socket
// events occur (threadUpdated, threadCreated, newMessage). Implements
// debouncing to prevent rapid successive API calls.
//
// Return Value
// ------------
// Object containing:
//   threads    MatchThread[]    Array of chat threads and pending requests
//   loading    boolean          Loading state indicator
//   reload     () => Promise    Function to manually reload threads
//
// Value Parameters
// ----------------
// None (React hook)
//
// Reference Parameters
// --------------------
// None (React hook)
//
// Local Variables
// ---------------
// threads          MatchThread[]    Local state for thread list
// loading          boolean          Loading state
// mounted          boolean          Component mount status (ref)
// loadingRef       boolean          Flag to prevent concurrent loads (ref)
// lastLoadTimeRef  number           Timestamp of last load (ref)
// socket           Socket|null      Socket.io connection instance
// refreshTimer     NodeJS.Timeout   Debounce timer for socket events
//
//*******************************************************************

import {
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";

import { apiGet } from "../services/apiService";
import { initSocket, getSocket, refreshSocketAuth } from "../services/socket";
import { useAuth } from "../context/AuthContext";

import type { MatchThread } from "../types/chat";

export function useChatThreads() {
  const { user, idToken } = useAuth();
  const [threads, setThreads] = useState<MatchThread[]>([]);
  const [loading, setLoading] = useState(true);

  const mounted = useRef(true);
  const loadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  //********************************************************************
  //
  // load Function
  //
  // Loads chat threads from the backend API endpoint /chat/threads.
  // Implements debouncing to prevent rapid successive calls (max once
  // per 500ms). Updates local state only if component is still mounted.
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
  // now     number              Current timestamp in milliseconds
  // data    MatchThread[]|null  Response from API
  //
  //*******************************************************************
  const load = useCallback(async () => {
    // Guard: Do not load if user is not authenticated or no token
    if (!user || !idToken) {
      if (mounted.current) {
        setLoading(false);
      }
      return;
    }

    const now = Date.now();
    if (loadingRef.current || (now - lastLoadTimeRef.current < 500)) {
      return;
    }

    loadingRef.current = true;
    lastLoadTimeRef.current = now;
    setLoading(true);

    try {
      // Double-check auth before making request
      if (!user || !idToken) {
        return;
      }

      const data = await apiGet<MatchThread[]>("/chat/threads", idToken);

      if (mounted.current && Array.isArray(data)) {
        setThreads(data);
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [user, idToken]);

  useEffect(() => {
    mounted.current = true;
    void load();

    return () => {
      mounted.current = false;
      // Socket persists across navigation - only closed on logout (handled in AuthContext)
    };
  }, [load]);

  useEffect(() => {
    // Guard: Do not setup socket if user is not authenticated or no token
    if (!user || !idToken) {
      return;
    }

    let socket: ReturnType<typeof getSocket> | null = null;
    let refreshTimer: NodeJS.Timeout | null = null;

    const setup = async () => {
      // Double-check auth before initializing socket
      if (!user || !idToken) {
        return;
      }

      socket = getSocket() ?? (await initSocket(idToken));
      if (!socket) return;

      // Ensure socket auth stays fresh
      await refreshSocketAuth(idToken);

      const refresh = () => {
        if (refreshTimer) return;
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          void load();
        }, 100); // Reduced from 300ms to 100ms for faster updates
      };

      const handleReconnect = () => {
        // Reload threads when socket reconnects to fetch missed updates
        void load();
      };

      socket.on("connect", handleReconnect);
      socket.on("threadUpdated", refresh);
      socket.on("threadCreated", refresh);
      socket.on("newMessage", refresh);
      socket.on("matchCreated", refresh);
      socket.on("matchUpdated", refresh);

      return () => {
        if (refreshTimer) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        socket?.off("connect", handleReconnect);
        socket?.off("threadUpdated", refresh);
        socket?.off("threadCreated", refresh);
        socket?.off("newMessage", refresh);
        socket?.off("matchCreated", refresh);
        socket?.off("matchUpdated", refresh);
      };
    };

    const cleanupPromise = setup();

    return () => {
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, [load, user, idToken]);

  return {
    threads,
    loading,
    reload: load,
  };
}
