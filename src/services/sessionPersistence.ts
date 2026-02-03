import * as SecureStore from "expo-secure-store";

// Use a SecureStore-safe key (alphanumeric, ".", "-", "_") and clean up old invalid keys.
const STORAGE_KEY = "EvenApp_authSession";
const LEGACY_KEYS = ["@EvenApp/authSession", "EvenApp.authSession"];
const SCHEMA_VERSION = 1;
const MAX_SESSION_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionData {
  uid: string;
  providerId: string;
  timestamp: number;
  version?: number;
  encrypted?: boolean;
}

/**
 * Persists session identity data to SecureStore.
 * @remarks
 * This stores ONLY identity information (uid, providerId).
 * It does NOT store sensitive tokens (idToken, refreshToken).
 * This is used for UI optimism and identity rehydration via the backend.
 * @param sessionData - The identity data to store.
 */
export async function persistSession(sessionData: SessionData): Promise<void> {
  try {
    // Best-effort cleanup of legacy keys that used invalid characters
    for (const legacyKey of LEGACY_KEYS) {
      try {
        await SecureStore.deleteItemAsync(legacyKey);
      } catch {
        // ignore legacy cleanup errors
      }
    }

    const payload: SessionData = {
      ...sessionData,
      version: SCHEMA_VERSION,
      encrypted: true, // Stored in SecureStore
    };
    const jsonString = JSON.stringify(payload);
    await SecureStore.setItemAsync(STORAGE_KEY, jsonString);
  } catch {
    // Fail silently to avoid noisy logs on cold start
  }
}

/**
 * Retrieves session data from SecureStore and validates expiration.
 * @remarks
 * Implements "Soft Expiry" with sliding window: If the session is older than 30 days,
 * it returns null, effectively forcing a fresh login. If the session is valid,
 * the timestamp is updated to the current time, extending the expiry window by another
 * 30 days. This creates a sliding window where active users remain logged in.
 * @returns The session data if found and valid (with updated timestamp), otherwise null.
 */
export async function restoreSession(): Promise<SessionData | null> {
  try {
    // Best-effort cleanup of legacy keys that used invalid characters
    for (const legacyKey of LEGACY_KEYS) {
      try {
        await SecureStore.deleteItemAsync(legacyKey);
      } catch {
        // ignore legacy cleanup errors
      }
    }

    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const session: SessionData = JSON.parse(stored);

    // Validate structure
    if (!session.uid || !session.providerId || !session.timestamp) {
      return null;
    }

    // Validate schema version
    if (session.version && session.version !== SCHEMA_VERSION) {
      return null;
    }

    // Validate Expiry (30 Days)
    const now = Date.now();
    if (now - session.timestamp > MAX_SESSION_AGE) {
      return null;
    }

    // Sliding window: Update timestamp to extend expiry window
    const updatedSession: SessionData = {
      ...session,
      timestamp: now,
      version: SCHEMA_VERSION,
      encrypted: true,
    };

    // Persist the updated session with new timestamp
    await persistSession(updatedSession);

    return updatedSession;
  } catch {
    // Treat all errors (parsing, storage access) as "no session"
    return null;
  }
}

/**
 * Removes session data from SecureStore.
 * @remarks
 * Should be called on Logout, Account Deletion, and upon discovering
 * an invalid or disabled user during restoration.
 */
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    for (const legacyKey of LEGACY_KEYS) {
      try {
        await SecureStore.deleteItemAsync(legacyKey);
      } catch {
        // ignore legacy cleanup errors
      }
    }
  } catch {
    // Silent
  }
}
