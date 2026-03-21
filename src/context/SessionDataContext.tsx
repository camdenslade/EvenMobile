//********************************************************************
//
// SessionDataContext Component
//
// Centralized context for session-level data that should be fetched
// exactly once per authentication session. Prevents duplicate API
// calls across multiple screens and hooks by providing a single source
// of truth for profile status, user summary, and review summary.
//
// Return Value
// ------------
// React.ReactElement    JSX element with SessionDataContext.Provider
//
// Value Parameters
// ----------------
// children    ReactNode    Child components to wrap with session data context
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// profileStatus    ProfileStatus|null    Profile completion status
// userSummary      UserSummary|null      User tokens and subscription data
// reviewSummary    ReviewSummary|null    Review summary data
// loading          boolean               Whether session data is loading
// hasLoaded        boolean               Ref to track if data has been loaded
//
//*******************************************************************

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { apiGet } from "../services/apiService";

interface ProfileStatus {
  status: "missing" | "complete";
  paused?: boolean;
}

interface UserSummary {
  isSubscribed: boolean;
  searchTokens: number;
  messageTokens: number;
  undoTokens: number;
  email?: string | null;
  role?: "user" | "admin";
  schoolEmailVerified?: boolean;
  schoolEmailVerifiedAt?: string | null;
  requireSchoolEmailGate?: boolean;
  paymentFlags?: {
    enablePayments: boolean;
    enableSearchTokens: boolean;
    enableUndoTokens: boolean;
    enableMessageReqTokens: boolean;
  };
  userFlags?: {
    unlimitedSearch: boolean;
    unlimitedUndo: boolean;
    unlimitedMessageReq: boolean;
  };
}

interface ReviewSummary {
  average: number | null;
  count: number;
  best: number | null;
}

interface SessionDataContextType {
  profileStatus: ProfileStatus | null;
  userSummary: UserSummary | null;
  reviewSummary: ReviewSummary | null;
  loading: boolean;
  error: string | null;
  refreshSessionData: () => Promise<void>;
  paymentFlags: {
    enablePayments: boolean;
    enableSearchTokens: boolean;
    enableUndoTokens: boolean;
    enableMessageReqTokens: boolean;
  };
  userFlags: {
    unlimitedSearch: boolean;
    unlimitedUndo: boolean;
    unlimitedMessageReq: boolean;
  };
}

const SessionDataContext = createContext<SessionDataContextType>({
  profileStatus: null,
  userSummary: null,
  reviewSummary: null,
  loading: true,
  error: null,
  refreshSessionData: async () => {},
  paymentFlags: {
    enablePayments: true,
    enableSearchTokens: true,
    enableUndoTokens: true,
    enableMessageReqTokens: true,
  },
  userFlags: {
    unlimitedSearch: false,
    unlimitedUndo: false,
    unlimitedMessageReq: false,
  },
});

export const SessionDataProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, idToken } = useAuth();
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentFlags, setPaymentFlags] = useState({
    enablePayments: true,
    enableSearchTokens: true,
    enableUndoTokens: true,
    enableMessageReqTokens: true,
  });
  const [userFlags, setUserFlags] = useState({
    unlimitedSearch: false,
    unlimitedUndo: false,
    unlimitedMessageReq: false,
  });
  const hasLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  //********************************************************************
  //
  // loadSessionData Function
  //
  // Fetches all session-level data from the backend. Only executes
  // once per session using hasLoadedRef guard. Fetches profile status,
  // user summary, and review summary in parallel.
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
  // status        ProfileStatus|null    Response from /profiles/status
  // userData      UserSummary|null      Response from /users/me
  // reviewData    ReviewSummary|null   Response from /reviews/summary/me
  //
  //*******************************************************************
  const loadSessionData = useCallback(async () => {
    if (!user?.uid || !idToken) {
      setLoading(false);
      return;
    }

    // Prevent duplicate calls
    if (isLoadingRef.current) {
      return;
    }

    // Only load once per session unless explicitly refreshed
    if (hasLoadedRef.current) {
      setLoading(false);
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Fetch all session data in parallel
      const [statusResult, userResult, reviewResult] = await Promise.allSettled([
        apiGet<ProfileStatus>("/profiles/status", idToken),
        apiGet<UserSummary>("/users/me", idToken),
        apiGet<ReviewSummary>("/reviews/summary/me", idToken),
      ]);

      if (statusResult.status === "fulfilled" && statusResult.value) {
        setProfileStatus(statusResult.value);
      }

      if (userResult.status === "fulfilled" && userResult.value) {
        setUserSummary({
          isSubscribed: userResult.value.isSubscribed ?? false,
          searchTokens: userResult.value.searchTokens ?? 0,
          messageTokens: userResult.value.messageTokens ?? 0,
          undoTokens: userResult.value.undoTokens ?? 0,
          email: userResult.value.email ?? null,
          role: userResult.value.role,
          schoolEmailVerified: (userResult.value as any).schoolEmailVerified ?? false,
          schoolEmailVerifiedAt: (userResult.value as any).schoolEmailVerifiedAt ?? null,
          requireSchoolEmailGate:
            (userResult.value as any).requireSchoolEmailGate ?? false,
        });
        setPaymentFlags({
          enablePayments: (userResult.value as any).paymentFlags?.enablePayments ?? true,
          enableSearchTokens: (userResult.value as any).paymentFlags?.enableSearchTokens ?? true,
          enableUndoTokens: (userResult.value as any).paymentFlags?.enableUndoTokens ?? true,
          enableMessageReqTokens: (userResult.value as any).paymentFlags?.enableMessageReqTokens ?? true,
        });
        setUserFlags({
          unlimitedSearch: (userResult.value as any).userFlags?.unlimitedSearch ?? false,
          unlimitedUndo: (userResult.value as any).userFlags?.unlimitedUndo ?? false,
          unlimitedMessageReq: (userResult.value as any).userFlags?.unlimitedMessageReq ?? false,
        });
      }

      if (reviewResult.status === "fulfilled" && reviewResult.value) {
        setReviewSummary(reviewResult.value);
      }

      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Failed to load session data:", error);
      setError("Unable to load account data. Pull to retry.");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user?.uid, idToken]);

  //********************************************************************
  //
  // refreshSessionData Function
  //
  // Explicitly refreshes session data. Resets the hasLoadedRef guard
  // and triggers a fresh fetch. Used after mutations like profile
  // updates or subscription changes.
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
  const refreshSessionData = useCallback(async () => {
    hasLoadedRef.current = false;
    await loadSessionData();
  }, [loadSessionData]);

  useEffect(() => {
    // Reset when user changes (logout/login)
    if (!user?.uid) {
      hasLoadedRef.current = false;
      setProfileStatus(null);
      setUserSummary(null);
      setReviewSummary(null);
      setLoading(false);
      setError(null);
      setPaymentFlags({
        enablePayments: true,
        enableSearchTokens: true,
        enableUndoTokens: true,
        enableMessageReqTokens: true,
      });
      setUserFlags({
        unlimitedSearch: false,
        unlimitedUndo: false,
        unlimitedMessageReq: false,
      });
      return;
    }

    // Load data when user and token are available
    if (user?.uid && idToken) {
      loadSessionData();
    }
  }, [user?.uid, idToken, loadSessionData]);

  return (
    <SessionDataContext.Provider
      value={{
        profileStatus,
        userSummary,
        reviewSummary,
        loading,
        error,
        refreshSessionData,
        paymentFlags,
        userFlags,
      }}
    >
      {children}
    </SessionDataContext.Provider>
  );
};

//********************************************************************
//
// useSessionData Hook
//
// Hook to access session data context. Returns profile status, user
// summary, review summary, loading state, and refresh function.
//
// Return Value
// ------------
// SessionDataContextType    Session data context value
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
export const useSessionData = () => useContext(SessionDataContext);

