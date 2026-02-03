//********************************************************************
//
// getFreshToken Function
//
// Retrieves a Cognito access token for the current authenticated user.
//
// Return Value
// ------------
// Promise<string|null>    Cognito access token or null if no user
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
// user    User|null    Current user
//
//*******************************************************************

import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "EvenApp_access_token";
const EXPIRES_AT_KEY = "EvenApp_access_token_expires_at";
const LEGACY_STORAGE_KEY = "EvenApp_cognito_tokens";

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

// Get socket URL from environment or derive from API base URL
// Matches the same base URL pattern used in apiService.ts
const getSocketUrl = (): string => {
  // Check for explicit WebSocket URL in environment
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }

  // Derive from API base URL (matches apiService.ts BASE_URL pattern)
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL;
  
  // Extract hostname (remove https:// and /api if present)
  const hostname = apiBase.replace(/^https?:\/\//, "").replace(/\/api$/, "");
  
  // Use wss for https, ws for http
  const protocol = apiBase.startsWith("https") ? "wss" : "ws";
  return `${protocol}://${hostname}`;
};

const SOCKET_URL = getSocketUrl();
const SOCKET_DEBUG = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_SOCKET === "true";

let socket: Socket | null = null;

async function migrateLegacyTokens(): Promise<StoredTokens | null> {
  const raw = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as StoredTokens;
  if (!parsed?.accessToken) return null;
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_KEY,
    parsed.accessToken,
    { keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY },
  );
  if (parsed.expiresAt) {
    await SecureStore.setItemAsync(
      EXPIRES_AT_KEY,
      String(parsed.expiresAt),
      { keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY },
    );
  } else {
    await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
  }
  await SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY);
  return parsed;
}

async function getFreshToken(token?: string | null): Promise<string | null> {
  if (token) return token;

  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (accessToken) {
    const expiresRaw = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
    const expiresAt = expiresRaw ? Number(expiresRaw) : undefined;
    if (expiresAt && expiresAt <= Date.now()) {
      return null;
    }
    return accessToken;
  }

  const legacy = await migrateLegacyTokens();
  if (!legacy?.accessToken) return null;
  if (legacy.expiresAt && legacy.expiresAt <= Date.now()) {
    return null;
  }
  return legacy.accessToken;
}

//********************************************************************
//
// initSocket Function
//
// Initializes a singleton authenticated socket.io connection to the
// backend. Refreshes access token on connect and reconnect.
// Returns existing connection if already initialized.
//
// Return Value
// ------------
// Promise<Socket|null>    Socket.io connection instance or null if auth fails
//
// Value Parameters
// ----------------
// token    string|null    Optional Cognito access token from AuthContext
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// freshToken  string|null    Cognito access token
// fresh       string|null    Fresh token for reconnection
// err         Error          Connection error object
//
//*******************************************************************
export async function initSocket(token?: string | null): Promise<Socket | null> {
  if (socket) return socket;

  const freshToken = await getFreshToken(token);
  if (!freshToken) {
    // Silently return null - no warnings for expected unauthenticated state
    return null;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token: freshToken },
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    if (SOCKET_DEBUG) {
      console.log("socket connected:", socket?.id);
    }
  });

  socket.io.on("reconnect_attempt", async () => {
    // Use the provided token for reconnection, or fall back to getting a fresh one
    const fresh = await getFreshToken(token);
    if (socket && fresh) {
      socket.auth = { token: fresh };
    }
  });

  socket.on("connect_error", (err) => {
    if (SOCKET_DEBUG) {
      console.warn("socket connect error:", err?.message || err);
    }
  });

  socket.io.on("reconnect_failed", () => {
    if (SOCKET_DEBUG) {
      console.warn("socket reconnect failed after max attempts");
    }
  });

  socket.on("disconnect", (reason) => {
    if (SOCKET_DEBUG) {
      console.warn("socket disconnected", { reason });
    }
  });

  return socket;
}

//********************************************************************
//
// getSocket Function
//
// Returns the current socket.io connection instance if it exists.
//
// Return Value
// ------------
// Socket|null    Current socket connection or null if not initialized
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
export function getSocket(): Socket | null {
  return socket;
}

export function closeSocket() {
  if (!socket) return;
  try {
    socket.removeAllListeners();
    socket.disconnect();
  } catch (err) {
    if (__DEV__) {
      console.warn("socket disconnect error:", err);
    }
  } finally {
    socket = null;
  }
}

//********************************************************************
//
// refreshSocketAuth Function
//
// Re-applies authentication token to the existing socket and reconnects.
// If no token is available, closes the socket to avoid unauthenticated
// traffic.
//
// Return Value
// ------------
// Promise<void>
//
// Value Parameters
// ----------------
// token    string|null    Optional Cognito access token from AuthContext
//
//*******************************************************************
export async function refreshSocketAuth(token?: string | null): Promise<void> {
  if (!socket) return;
  const fresh = await getFreshToken(token);
  if (!fresh) {
    closeSocket();
    return;
  }
  // Update auth token for future reconnection attempts
  socket.auth = { token: fresh };
  // Only disconnect/reconnect if socket is not already connected
  // If already connected, the token will be used on next reconnect attempt
  if (!socket.connected) {
    socket.connect();
  }
  // If connected, don't disconnect - just update the auth for future use
}

