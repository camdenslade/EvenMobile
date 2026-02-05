//********************************************************************
//
// loadThemePreference Function
//
// Loads the user's theme preference from AsyncStorage.
// Returns the stored preference or defaults to "default" if not found or
// on error.
//
// Return Value
// ------------
// Promise<ThemeMode>    "light" or "dark" theme mode
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
// stored    string|null    Stored theme preference from AsyncStorage
// error     Error          Error object if storage read fails
//
//*******************************************************************
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "default" | "custom";
const CACHE_VERSION = 1;
const CACHE_STORAGE_KEY = "@EvenApp:cache:v1";

interface AppCacheState {
  profile: any | null;
  setProfile: (data: any) => void;

  matches: any[] | null;
  setMatches: (data: any[]) => void;

  messageRequestAvatars: Record<string, string | null>;
  setMessageRequestAvatar: (uid: string, photoUrl: string | null) => void;

  messagesThreads: any[] | null;
  setMessagesThreads: (data: any[]) => void;

  reviews: any[] | null;
  setReviews: (data: any[]) => void;

  reviewSummary: any | null;
  setReviewSummary: (data: any) => void;

  queue: any[] | null;
  setQueue: (data: any[]) => void;

  seenIds: Set<string>;
  addSeenIds: (ids: string[]) => void;
  removeSeenIds: (ids: string[]) => void;
  clearSeen: () => void;

  settings: any | null;
  setSettings: (data: any) => void;

  user: {
    isSubscribed: boolean;
    searchTokens: number;
    messageTokens: number;
    undoTokens: number;
  } | null;
  setUser: (data: {
    isSubscribed: boolean;
    searchTokens: number;
    messageTokens: number;
    undoTokens: number;
  } | null) => void;

  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  isPreloaded: boolean;
  setPreloaded: (value: boolean) => void;

  clearCache: () => void;
}

const THEME_STORAGE_KEY = "@EvenApp:themeMode";


async function persistCacheSnapshot(state: AppCacheState) {
  const snapshot = {
    version: CACHE_VERSION,
    profile: state.profile,
    queue: state.queue,
    reviews: state.reviews,
    settings: state.settings,
    messageRequestAvatars: state.messageRequestAvatars,
  };
  try {
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.error("Failed to persist app cache:", err);
  }
}

async function hydrateCacheFromStorage(set: any, get: () => AppCacheState) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
      return;
    }
    const next: Partial<AppCacheState> = {};
    if (parsed.profile && !get().profile) next.profile = parsed.profile;
    if (parsed.queue && !get().queue) next.queue = parsed.queue;
    if (parsed.reviews && !get().reviews) next.reviews = parsed.reviews;
    if (parsed.settings && !get().settings) next.settings = parsed.settings;
    if (parsed.messageRequestAvatars && !get().messageRequestAvatars) {
      next.messageRequestAvatars = parsed.messageRequestAvatars;
    }
    if (Object.keys(next).length > 0) {
      set(next);
    }
  } catch (err) {
    console.error("Failed to hydrate app cache:", err);
    await AsyncStorage.removeItem(CACHE_STORAGE_KEY);
  }
}

export async function loadThemePreference(): Promise<ThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (
      stored === "light" ||
      stored === "dark" ||
      stored === "default" ||
      stored === "custom"
    ) {
      return stored;
    }
    if (stored === "placeholder") {
      return "default";
    }
  } catch (error) {
    console.error("Failed to load theme preference:", error);
  }
  return "default";
}

//********************************************************************
//
// arraysEqual Function
//
// Performs shallow comparison of two arrays to determine if they are
// equal. Returns true if arrays are identical by reference or contain
// identical elements in the same order.
//
// Return Value
// ------------
// boolean    True if arrays are equal, false otherwise
//
// Value Parameters
// ----------------
// a    T[]|null    First array to compare
// b    T[]|null    Second array to compare
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// i    number    Loop counter
//
//*******************************************************************
function arraysEqual<T>(a: T[] | null, b: T[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

//********************************************************************
//
// objectsEqual Function
//
// Performs shallow comparison of two objects to determine if they are
// equal. Returns true if objects are identical by reference or contain
// identical key-value pairs.
//
// Return Value
// ------------
// boolean    True if objects are equal, false otherwise
//
// Value Parameters
// ----------------
// a    any    First object to compare
// b    any    Second object to compare
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// keysA    string[]    Array of keys from first object
// keysB    string[]    Array of keys from second object
// key      string      Current key being compared
//
//*******************************************************************
function objectsEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export const useAppCache = create<AppCacheState>((set, get) => {
  // Kick off async hydration (non-blocking)
  hydrateCacheFromStorage(set, get);

  return {
    profile: null,
    setProfile: (data) => {
      if (!objectsEqual(get().profile, data)) {
        set({ profile: data });
        void persistCacheSnapshot(get());
      }
    },

    matches: null,
    setMatches: (data) => {
      if (!arraysEqual(get().matches, data)) {
        set({ matches: data });
      }
    },

    messageRequestAvatars: {},
    setMessageRequestAvatar: (uid, photoUrl) => {
      const current = get().messageRequestAvatars;
      if (current[uid] === photoUrl) return;
      set({
        messageRequestAvatars: {
          ...current,
          [uid]: photoUrl,
        },
      });
    },

    messagesThreads: null,
    setMessagesThreads: (data) => {
      if (!arraysEqual(get().messagesThreads, data)) {
        set({ messagesThreads: data });
      }
    },

    reviews: null,
    setReviews: (data) => {
      if (!arraysEqual(get().reviews, data)) {
        set({ reviews: data });
        void persistCacheSnapshot(get());
      }
    },

    reviewSummary: null,
    setReviewSummary: (data) => {
      if (!objectsEqual(get().reviewSummary, data)) {
        set({ reviewSummary: data });
      }
    },

    queue: null,
    setQueue: (data) => {
      if (!arraysEqual(get().queue, data)) {
        set({ queue: data });
        void persistCacheSnapshot(get());
      }
    },

    seenIds: new Set<string>(),
    addSeenIds: (ids) =>
      set((state) => ({
        seenIds: new Set([...state.seenIds, ...ids]),
      })),
    removeSeenIds: (ids) =>
      set((state) => {
        const newSet = new Set(state.seenIds);
        ids.forEach(id => newSet.delete(id));
        return { seenIds: newSet };
      }),
    clearSeen: () => set({ seenIds: new Set<string>() }),

    settings: null,
    setSettings: (data) => {
      if (!objectsEqual(get().settings, data)) {
        set({ settings: data });
        void persistCacheSnapshot(get());
      }
    },

    user: null,
    setUser: (data) => {
      if (!objectsEqual(get().user, data)) {
        set({ user: data });
      }
    },

    themeMode: "default",
    setThemeMode: async (mode: ThemeMode) => {
      set({ themeMode: mode });
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch (error) {
        console.error("Failed to save theme preference:", error);
      }
    },

    isPreloaded: false,
    setPreloaded: (value) => set({ isPreloaded: value }),

    clearCache: () => {
      set({
        profile: null,
        matches: null,
        messageRequestAvatars: {},
        messagesThreads: null,
        reviews: null,
        reviewSummary: null,
        queue: null,
        seenIds: new Set<string>(),
        settings: null,
        user: null,
        isPreloaded: false,
      });
      AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
    },
  };
});
