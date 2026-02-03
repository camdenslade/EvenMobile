//********************************************************************
//
// RefreshContext
//
// Provides a global pull-to-refresh mechanism. Exposes a single
// refresh handler and a registry so screens can register their own
// refetch callbacks. Ensures refresh runs once at a time and fans out
// to session data plus any registered refreshers.
//
//********************************************************************

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useSessionData } from "./SessionDataContext";

interface RefreshContextValue {
  refreshing: boolean;
  refresh: () => Promise<void>;
  registerRefresher: (fn: () => Promise<void> | void) => () => void;
}

const RefreshContext = createContext<RefreshContextValue>({
  refreshing: false,
  refresh: async () => {},
  registerRefresher: () => () => {},
});

export const RefreshProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { refreshSessionData } = useSessionData();

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const refreshersRef = useRef<Set<() => Promise<void> | void>>(new Set());

  const registerRefresher = useCallback(
    (fn: () => Promise<void> | void) => {
      if (!fn) return () => {};
      refreshersRef.current.add(fn);
      return () => {
        refreshersRef.current.delete(fn);
      };
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!user?.uid) return;
    if (refreshingRef.current) return;

    refreshingRef.current = true;
    setRefreshing(true);

    try {
      await refreshSessionData();

      const handlers = Array.from(refreshersRef.current);
      await Promise.allSettled(
        handlers.map(async (fn) => {
          try {
            await fn();
          } catch (err) {
            console.error("Global refresh handler failed:", err);
          }
        })
      );
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [user?.uid, refreshSessionData]);

  return (
    <RefreshContext.Provider
      value={{
        refreshing,
        refresh,
        registerRefresher,
      }}
    >
      {children}
    </RefreshContext.Provider>
  );
};

export const useGlobalRefresh = () => useContext(RefreshContext);
