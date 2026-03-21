//********************************************************************
//
// useSwipeQueue Hook (FULLY PATCHED — LIVE REFS, NO STALE CLOSURES)
//
// Fixes:
//   • Swipe looping same person (profiles[0] stale inside like/skip)
//   • Ensures top profile always advances correctly
//   • Keeps queue stable across animations
//   • Works with match popup
//
//********************************************************************

import { useState, useEffect, useCallback, useRef } from "react";
import { Alert, Platform } from "react-native";
import { apiGet, apiPost } from "../services/apiService";
import { UserProfile } from "../types/user";
import { useAppCache } from "../services/appCache";
import type { UserProfile as MyProfile } from "../types/user";
import { useSessionData } from "../context/SessionDataContext";
import { useAuth } from "../context/AuthContext";
import { prefetchProfilePhotos } from "../utils/imagePrefetch";
import { purchaseFeature } from "../services/purchaseClient";

import {
  IdleState,
  LoadingState,
  MatchFoundState,
  SwipeState,
} from "../types/state";

type UndoEntry = { profile: UserProfile };

export function useSwipeQueue() {
  //──────────────────────────────────────────────────────────────────
  // SESSION DATA
  //──────────────────────────────────────────────────────────────────
  const { userSummary, refreshSessionData, paymentFlags, userFlags } = useSessionData();
  const { idToken } = useAuth();

  const canUseFeature = useCallback(
    (feature: "undo" | "search" | "messageRequest") => {
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

      const flagKey =
        feature === "undo"
          ? pf.enableUndoTokens
          : feature === "search"
          ? pf.enableSearchTokens
          : pf.enableMessageReqTokens;
      if (!flagKey) return true;

      const unlimited =
        feature === "undo"
          ? uf.unlimitedUndo
          : feature === "search"
          ? uf.unlimitedSearch
          : uf.unlimitedMessageReq;
      if (unlimited) return true;

      const tokens =
        feature === "undo"
          ? userSummary?.undoTokens ?? 0
          : feature === "search"
          ? userSummary?.searchTokens ?? 0
          : userSummary?.messageTokens ?? 0;

      return tokens > 0;
    },
    [paymentFlags, userFlags, userSummary?.undoTokens, userSummary?.searchTokens, userSummary?.messageTokens]
  );

  //──────────────────────────────────────────────────────────────────
  // GLOBAL CACHE (Zustand)
  //──────────────────────────────────────────────────────────────────
  const cachedQueue = useAppCache((s) => s.queue);
  const setQueue = useAppCache((s) => s.setQueue);
  const seenIds = useAppCache((s) => s.seenIds);
  const addSeenIds = useAppCache((s) => s.addSeenIds);
  const removeSeenIds = useAppCache((s) => s.removeSeenIds);
  const clearSeen = useAppCache((s) => s.clearSeen);
  const myProfile = useAppCache((s) => s.profile) as MyProfile | null;

  //──────────────────────────────────────────────────────────────────
  // LOCAL STATE
  //──────────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<UserProfile[]>(cachedQueue ?? []);
  const [state, setState] = useState<SwipeState>({
    status: "IDLE",
    currentProfile: cachedQueue?.[0] ?? null,
  });
  const [pendingSenderUids, setPendingSenderUids] = useState<Set<string>>(new Set());
  const [blockedUids, setBlockedUids] = useState<Set<string>>(new Set());

  //──────────────────────────────────────────────────────────────────
  // LIVE REFS — FIXES STALE CLOSURE BUG
  //──────────────────────────────────────────────────────────────────
  const profilesRef = useRef<UserProfile[]>(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const undoStack = useRef<UndoEntry[]>([]);
  const initializedRef = useRef(false);
  const isSwipingRef = useRef(false);
  const profilesLengthRef = useRef(profiles.length);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const processingActionRef = useRef(false);

  //──────────────────────────────────────────────────────────────────
  // PRELOAD IMAGES
  //──────────────────────────────────────────────────────────────────
  const preloadImages = useCallback((list: UserProfile[]) => {
    // Prefetch first 20 profiles with high priority (visible soon)
    const highPriorityProfiles = list.slice(0, 20);
    prefetchProfilePhotos(highPriorityProfiles, "high", 3);
    
    // Prefetch next 30 profiles with normal priority (likely to be seen)
    const normalPriorityProfiles = list.slice(20, 50);
    prefetchProfilePhotos(normalPriorityProfiles, "normal", 2);
  }, []);

  //──────────────────────────────────────────────────────────────────
  // loadQueue — fetch stable backend queue
  //──────────────────────────────────────────────────────────────────
  const sanitizeList = useCallback(
    (list: UserProfile[]) => list.filter((p): p is UserProfile => Boolean(p && p.userUid)),
    [],
  );

  // Fetch fresh queue in the background and prepend any newly-visible profiles
  // (e.g. just-unpaused profiles) without disrupting the current view.
  const backgroundRefreshQueue = useCallback(async () => {
    const data = await apiGet<UserProfile[]>("/profiles/queue", idToken ?? undefined);
    if (!data) return;

    let list = data.map((p) => {
      const photos = Array.isArray(p.photos)
        ? p.photos.filter((ph) => typeof ph === "string" && ph.trim().length > 0)
        : [];
      const prefixed =
        photos.length > 0 && p.profileImageUrl
          ? [p.profileImageUrl, ...photos.filter((ph) => ph !== p.profileImageUrl)]
          : photos.length > 0
          ? photos
          : p.profileImageUrl
          ? [p.profileImageUrl]
          : [];
      return { ...p, photos: prefixed };
    });
    list = sanitizeList(list);
    list = list.filter((p) => !seenIds.has(p.userUid));
    if (blockedUids.size > 0) {
      list = list.filter((p) => !blockedUids.has(p.userUid));
    }
    if (pendingSenderUids.size > 0) {
      list = list.filter((p) => !pendingSenderUids.has(p.userUid));
    }

    // Find profiles from server that aren't already in the current visible queue
    const currentUids = new Set(profilesRef.current.map((p) => p.userUid));
    const newProfiles = list.filter((p) => !currentUids.has(p.userUid));
    if (newProfiles.length === 0) return;

    // Prepend newly-visible profiles (e.g. just-unpaused) to the current queue
    const merged = sanitizeList([...newProfiles, ...profilesRef.current]);
    preloadImages(newProfiles);
    setQueue(merged);
    profilesLengthRef.current = merged.length;
    setProfiles(merged);
    setState((prev) => ({
      ...prev,
      currentProfile: merged[0] ?? null,
    }));
  }, [blockedUids, idToken, setQueue, preloadImages, seenIds, pendingSenderUids, sanitizeList]);

  const loadQueue = useCallback(async () => {
    setState({ status: "LOADING", targetProfileId: "" } as LoadingState);
    undoStack.current = [];
    setUndoAvailable(false);

    const data = await apiGet<UserProfile[]>("/profiles/queue", idToken ?? undefined);
    let latestBlocked = blockedUids;
    try {
      const blockedRes = await apiGet<{ blocked: string[] }>("/blocks/me", idToken ?? undefined);
      latestBlocked = new Set(blockedRes?.blocked ?? []);
      setBlockedUids(latestBlocked);
    } catch {
      // ignore failures; fall back to existing blocked cache
    }
    let list = (data ?? []).map((p) => {
      const photos = Array.isArray(p.photos)
        ? p.photos.filter((ph) => typeof ph === "string" && ph.trim().length > 0)
        : [];
      const prefixed =
        photos.length > 0 && p.profileImageUrl
          ? [p.profileImageUrl, ...photos.filter((ph) => ph !== p.profileImageUrl)]
          : photos.length > 0
          ? photos
          : p.profileImageUrl
          ? [p.profileImageUrl]
          : [];
      return { ...p, photos: prefixed };
    });
    list = sanitizeList(list);

    // 🔥 FRONTEND-ONLY FILTER: remove people already swiped
    list = list.filter((p) => !seenIds.has(p.userUid));
    // Remove blocked users
    if (latestBlocked.size > 0) {
      list = list.filter((p) => !latestBlocked.has(p.userUid));
    }
    // Drop senders with pending message requests
    if (pendingSenderUids.size > 0) {
      list = list.filter((p) => !pendingSenderUids.has(p.userUid));
    }

    preloadImages(list);
    setQueue(list);

    profilesLengthRef.current = list.length;
    setProfiles(list);

    setState({
      status: "IDLE",
      currentProfile: list[0] ?? null,
    });
  }, [blockedUids, idToken, setQueue, preloadImages, seenIds, pendingSenderUids, sanitizeList]);

  //──────────────────────────────────────────────────────────────────
  // INITIAL MOUNT
  //──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (cachedQueue && cachedQueue.length > 0) {
      // Filter by seenIds before using cached queue to prevent reappearing profiles
      let filtered = cachedQueue.filter((p) => !seenIds.has(p.userUid));
      if (blockedUids.size > 0) {
        filtered = filtered.filter((p) => !blockedUids.has(p.userUid));
      }
      if (pendingSenderUids.size > 0) {
        filtered = filtered.filter((p) => !pendingSenderUids.has(p.userUid));
      }
      filtered = sanitizeList(filtered);
      profilesLengthRef.current = filtered.length;
      setProfiles(filtered);
      setState({
        status: "IDLE",
        currentProfile: filtered[0] ?? null,
      });
      preloadImages(filtered);
      // Background refresh to pick up newly-unpaused profiles without disrupting the view
      void backgroundRefreshQueue();
      return;
    }

    loadQueue();
  }, [blockedUids, cachedQueue, loadQueue, backgroundRefreshQueue, pendingSenderUids, preloadImages, seenIds]);

  // Fetch pending message requests to exclude those senders from the queue
  useEffect(() => {
    (async () => {
      try {
        const pending = await apiGet<Array<{ sender: { uid: string } | null }>>(
          "/message-request/pending",
          idToken ?? undefined
        );
        const uids = new Set(
          (pending || [])
            .map((p) => p.sender?.uid)
            .filter((uid): uid is string => !!uid)
        );
        setPendingSenderUids(uids);
      } catch {
        // ignore fetch errors; queue will remain unchanged
      }
    })();
  }, [idToken]);

  // Fetch blocked users to exclude from queue
  useEffect(() => {
    (async () => {
      if (!idToken) return;
      try {
        const res = await apiGet<{ blocked: string[] }>("/blocks/me", idToken ?? undefined);
        if (res?.blocked) {
          setBlockedUids(new Set(res.blocked));
        }
      } catch {
        // ignore fetch errors; queue will remain unchanged
      }
    })();
  }, [idToken]);

  // Whenever pending senders change, prune any matching profiles currently in the deck/cache
  useEffect(() => {
    if (pendingSenderUids.size === 0) return;
    const filtered = sanitizeList(
      profilesRef.current.filter((p) => !pendingSenderUids.has(p.userUid)),
    );
    profilesLengthRef.current = filtered.length;
    setProfiles(filtered);
    setState((prevState) => ({
      ...prevState,
      currentProfile: filtered[0] ?? null,
    }));
    // Defer cache update to avoid setState during render warnings
    setTimeout(() => setQueue(filtered), 0);
  }, [pendingSenderUids, setQueue]);

  // Prune blocked users already in deck/cache
  useEffect(() => {
    if (blockedUids.size === 0) return;
    const filtered = sanitizeList(
      profilesRef.current.filter((p) => !blockedUids.has(p.userUid)),
    );
    profilesLengthRef.current = filtered.length;
    setProfiles(filtered);
    setState((prevState) => ({
      ...prevState,
      currentProfile: filtered[0] ?? null,
    }));
    setTimeout(() => setQueue(filtered), 0);
  }, [blockedUids, setQueue]);

  //──────────────────────────────────────────────────────────────────
  // maybeRefill — REMOVED: Queue should only refresh on explicit shuffle
  //──────────────────────────────────────────────────────────────────
  // Auto-refill removed per user requirement - queue only refreshes when shuffle button is pressed

  //********************************************************************
  //
  // skip — remove current profile locally
  //
  //********************************************************************
  const skip = useCallback(() => {
    const current = profilesRef.current;
    if (!current.length) return;

    isSwipingRef.current = true;

    // Add to seenIds
    addSeenIds([current[0].userUid]);

    undoStack.current.push({ profile: current[0] });
    setUndoAvailable(true);

    const next = sanitizeList(current.slice(1));
    profilesLengthRef.current = next.length;

    setProfiles(next);
    setQueue(next); // Update cache to keep it in sync
    setState({
      status: "IDLE",
      currentProfile: next[0] ?? null,
    });

    setTimeout(() => {
      isSwipingRef.current = false;
      // Removed auto-refill - queue only refreshes on explicit shuffle
    }, 350);
  }, [addSeenIds, setQueue]);

  //********************************************************************
  //
  // like — remove locally → send API → match popup
  //
  //********************************************************************
  const like = useCallback(async () => {
    // Prevent concurrent like operations
    if (processingActionRef.current) {
      console.warn("Like already in progress, ignoring duplicate call");
      return;
    }

    const current = profilesRef.current[0];
    if (!current) return;

    processingActionRef.current = true;

    // Remove locally FIRST (fixes stale top)
    isSwipingRef.current = true;

    // Add to seenIds
    addSeenIds([current.userUid]);
    undoStack.current.push({ profile: current });
    setUndoAvailable(true);

    const next = sanitizeList(profilesRef.current.slice(1));
    profilesLengthRef.current = next.length;

    setProfiles(next);
    setQueue(next); // Update cache to keep it in sync
    setState({
      status: "IDLE",
      currentProfile: next[0] ?? null,
    });

    setTimeout(() => {
      isSwipingRef.current = false;
      // Removed auto-refill - queue only refreshes on explicit shuffle
    }, 350);

    // Backend call SECOND
    try {
      const res = await apiPost<{ match: boolean; matchId?: string }>(
        "/like",
        { targetUid: current.userUid }
      );

      if (res?.match) {
        // Get my profile photo from cache
        const myPhoto = myProfile?.photos?.[0] ?? myProfile?.profileImageUrl ?? null;
        setState({
          status: "MATCH_FOUND",
          matchId: res.matchId!,
          targetProfile: current,
          mePhoto: myPhoto,
          themPhoto: current.profileImageUrl ?? current.photos?.[0] ?? null,
        } as MatchFoundState);
      }

      processingActionRef.current = false;
    } catch (err) {
      console.error("like error:", err);
      // Restore profile to queue on failure - CRITICAL: Also clean up seenIds and undo stack
      const restored = sanitizeList([current, ...next]);
      setProfiles(restored);
      setQueue(restored);
      setState({
        status: "IDLE",
        currentProfile: current,
      });

      // Remove from seenIds since like failed
      removeSeenIds([current.userUid]);

      // Remove from undo stack since like never succeeded
      const lastUndo = undoStack.current[undoStack.current.length - 1];
      if (lastUndo?.profile.userUid === current.userUid) {
        undoStack.current.pop();
        setUndoAvailable(undoStack.current.length > 0);
      }

      processingActionRef.current = false;
      Alert.alert("Error", "Could not complete like. Please try again.");
    }
  }, [addSeenIds, setQueue, myProfile, removeSeenIds]);

  //********************************************************************
  //
  // undo
  //
  //********************************************************************
  const undo = useCallback(async () => {
    // Prevent concurrent undo operations
    if (processingActionRef.current) {
      console.warn("Undo already in progress, ignoring duplicate call");
      return;
    }

    const last = undoStack.current[undoStack.current.length - 1];
    if (!last) return;

    processingActionRef.current = true;

    const canUndo = canUseFeature("undo");
    if (!canUndo) {
      processingActionRef.current = false;
      if (Platform.OS === "ios") {
        Alert.alert("Get more undo tokens", "You need an undo token to continue. Purchase one now?", [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Purchase",
            onPress: async () => {
              try {
                await purchaseFeature("undo");
                await refreshSessionData();
                // Retry undo - don't call recursively, let user press again
                Alert.alert("Success", "Undo tokens added! You can now undo.");
              } catch (err: any) {
                Alert.alert("Purchase failed", err?.message || "Unable to complete purchase.");
              }
            },
          },
        ]);
      }
      return;
    }

    // Check tokens before allowing undo using SessionDataContext
    if (userSummary && (userSummary.undoTokens ?? 0) <= 0) {
      processingActionRef.current = false;
      alert('Insufficient undo tokens. Please get more from Get Perks.');
      return;
    }

    // Remove from undo stack AFTER validating tokens
    undoStack.current.pop();
    setUndoAvailable(undoStack.current.length > 0);

    try {
      // Call backend to decrement token
      await apiPost('/like/undo', {});

      // Remove from seenIds to allow the profile to appear in queue again
      removeSeenIds([last.profile.userUid]);

      const list = sanitizeList([last.profile, ...profilesRef.current]);
      profilesLengthRef.current = list.length;

      setProfiles(list);
      setQueue(list); // Update cache to keep it in sync
      setState({
        status: "IDLE",
        currentProfile: last.profile,
      });
      setUndoAvailable(undoStack.current.length > 0);

      // Refresh session data to update token counts (non-blocking)
      refreshSessionData().catch((err) => {
        console.error("Failed to refresh session data after undo:", err);
        // Undo still succeeded, just token count might be stale
      });

      processingActionRef.current = false;
    } catch (err: any) {
      // API call failed - restore everything
      console.error("Undo API failed:", err);
      undoStack.current.push(last);
      setUndoAvailable(true);
      processingActionRef.current = false;

      if (err?.message?.includes('insufficient')) {
        Alert.alert('Insufficient tokens', 'You need an undo token to continue.');
      } else {
        Alert.alert('Error', 'Could not complete undo. Please try again.');
      }
    }
  }, [userSummary, refreshSessionData, setQueue, removeSeenIds, canUseFeature]);

  //********************************************************************
  //
  // shuffle
  //
  //********************************************************************
  const shuffle = useCallback(async () => {
    if (shuffling) return; // Prevent multiple rapid presses

    setShuffling(true);
    try {
      // Clear seenIds to get fresh queue
      clearSeen();

      // Reload queue to get fresh profiles
      await loadQueue();
    } finally {
      setShuffling(false);
    }
  }, [clearSeen, loadQueue, shuffling]);

  //********************************************************************
  //
  // reload
  //
  //********************************************************************
  const reload = useCallback(async () => {
    undoStack.current = [];
    setUndoAvailable(false);
    await loadQueue();
  }, [loadQueue]);

  return {
    state,
    currentProfile: profilesRef.current[0] ?? null,
    profiles,
    skip,
    like,
    undo,
    shuffle,
    reload,
    undoAvailable,
    shuffling,
    clearMatch: () => {
      setState({
        status: "IDLE",
        currentProfile: profilesRef.current[0] ?? null,
      });
    },
    markPendingSender: (uid: string) => {
      setPendingSenderUids((prev) => {
        const next = new Set(prev);
        next.add(uid);
        return next;
      });
    },
  };
}
