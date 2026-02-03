//********************************************************************
//
// getAccessToken Function
//
// Retrieves a Cognito access token for the current authenticated user.
// Implements token caching to avoid excessive reads from secure storage.
//
//*******************************************************************
import * as SecureStore from "expo-secure-store";

let cachedToken: { token: string; expiresAt: number } | null = null;
let inFlightTokenPromise: Promise<string | null> | null = null;
let inFlightRefreshPromise: Promise<string | null> | null = null;
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes
const ACCESS_TOKEN_KEY = "EvenApp_access_token";
const REFRESH_TOKEN_KEY = "EvenApp_refresh_token";
const EXPIRES_AT_KEY = "EvenApp_access_token_expires_at";
const LEGACY_STORAGE_KEY = "EvenApp_cognito_tokens";
const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_APP_CLIENT_ID;
const COGNITO_DOMAIN =
  process.env.EXPO_PUBLIC_COGNITO_DOMAIN ??
  "https://us-east-1mggdopo3g.auth.us-east-1.amazoncognito.com";

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

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

async function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  const refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    if (!CLIENT_ID) {
      if (__DEV__) {
        console.warn("Missing Cognito client ID; cannot refresh access token.");
      }
      return null;
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }).toString();

    const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!data?.access_token) {
      return null;
    }

    const expiresAt =
      Date.now() +
      (typeof data.expires_in === "number"
        ? data.expires_in * 1000
        : TOKEN_TTL_MS);

    await SecureStore.setItemAsync(
      ACCESS_TOKEN_KEY,
      data.access_token,
      { keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY },
    );
    await SecureStore.setItemAsync(
      EXPIRES_AT_KEY,
      String(expiresAt),
      { keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY },
    );
    if (data.refresh_token) {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_KEY,
        data.refresh_token,
        { keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY },
      );
    }

    cachedToken = { token: data.access_token, expiresAt };
    return data.access_token;
  })();

  inFlightRefreshPromise = refreshPromise;
  try {
    return await refreshPromise;
  } finally {
    inFlightRefreshPromise = null;
  }
}

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }
  if (!forceRefresh && inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  const fetchPromise = (async () => {
    if (forceRefresh) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return refreshed;
    }

    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      const legacy = await migrateLegacyTokens();
      if (legacy?.accessToken) {
        if (legacy.expiresAt && legacy.expiresAt <= Date.now()) {
          const refreshed = await refreshAccessToken();
          return refreshed;
        }
        const legacyExpiresAt =
          legacy.expiresAt ?? Date.now() + TOKEN_TTL_MS;
        cachedToken = { token: legacy.accessToken, expiresAt: legacyExpiresAt };
        return legacy.accessToken;
      }
      return await refreshAccessToken();
    }

    const expiresRaw = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
    const expiresAt = expiresRaw ? Number(expiresRaw) : undefined;
    if (expiresAt && expiresAt <= Date.now()) {
      const refreshed = await refreshAccessToken();
      return refreshed;
    }
    const resolvedExpiresAt = expiresAt ?? Date.now() + TOKEN_TTL_MS;
    cachedToken = { token: accessToken, expiresAt: resolvedExpiresAt };
    return accessToken;
  })();

  inFlightTokenPromise = fetchPromise;
  try {
    return await fetchPromise;
  } finally {
    inFlightTokenPromise = null;
  }
}

export function clearAuthCaches() {
  cachedToken = null;
  inFlightTokenPromise = null;
  inFlightRefreshPromise = null;
  throttleCache.clear();
}

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Request coalescing: Map of in-flight requests keyed by method + endpoint
// All callers requesting the same endpoint simultaneously will await the same Promise
const inFlightRequests = new Map<string, Promise<any>>();

// Lightweight throttle/cache for noisy endpoints
type ThrottleRule = { ttlMs: number; cacheResult?: boolean };
const THROTTLE_RULES: Record<string, ThrottleRule> = {
  "GET:/profiles/status": { ttlMs: 10000, cacheResult: true },
  "GET:/users/me": { ttlMs: 10000, cacheResult: true },
  "GET:/reviews/summary/me": { ttlMs: 10000, cacheResult: true },
  "GET:/reviews/me": { ttlMs: 15000, cacheResult: true },
  "GET:/chat/threads": { ttlMs: 10000, cacheResult: true },
};

const throttleCache = new Map<
  string,
  { timestamp: number; data: any | null }
>();

//********************************************************************
//
// safeJson Function
//
// Safely parses a JSON string without throwing exceptions. Returns
// null if the string is empty or contains invalid JSON.
//
// Return Value
// ------------
// T|null    Parsed JSON object of type T, or null if parse fails
//
// Value Parameters
// ----------------
// text    string    JSON string to parse
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
function safeJson<T>(text: string): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  backoffMs = 200,
): Promise<Response> {
  const TIMEOUT_MS = 30000; // 30 second timeout (Batch C)

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), TIMEOUT_MS)
      );

      // Race between fetch and timeout
      return await Promise.race([
        fetch(url, options),
        timeoutPromise
      ]);
    } catch (err) {
      attempt += 1;
      if (attempt > retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt));
    }
  }
}

const RETRYABLE_STATUS = new Set([429, 503, 504]);

async function executeHttpRequest(
  url: string,
  options: RequestInit,
  isIdempotent: boolean
): Promise<Response> {
  const maxAttempts = isIdempotent ? 2 : 1;
  let attempt = 0;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    try {
      const res = await fetchWithRetry(url, options);
      if (
        isIdempotent &&
        RETRYABLE_STATUS.has(res.status) &&
        attempt < maxAttempts - 1
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 200 * Math.pow(2, attempt))
        );
        attempt += 1;
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      attempt += 1;
      if (!isIdempotent || attempt >= maxAttempts) {
        throw err;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  // Should never reach here
  return fetch(url, options);
}

//********************************************************************
//
// apiRequest Function
//
// Core wrapper for all API requests. Attaches Cognito access token to
// Authorization header, handles JSON encoding for POST/PATCH requests,
// and gracefully handles network failures and HTTP error codes.
// Implements request coalescing to prevent duplicate simultaneous requests.
//
// Return Value
// ------------
// Promise<T|null>    Parsed response data of type T, or null on error
//
// Value Parameters
// ----------------
// endpoint    string          API endpoint path (e.g., "/profiles/me")
// options     RequestInit     Fetch API options (method, headers, body)
// token       string|null     Optional Cognito access token from AuthContext
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// requestKey      string              Coalescing key (method + endpoint)
// existingRequest Promise<T|null>     Existing in-flight request if any
// idToken         string|null         Cognito access token
// isJsonBody      boolean             Whether request has JSON body
// headers         Record<string,string> Request headers object
// res             Response            Fetch API response object
// raw             string              Raw response text
// err             Error               Error object if request fails
//
//*******************************************************************
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T | null> {
  const method = options.method || "GET";
  const requestKey = `${method}:${endpoint}`;

  // Throttle guard (idempotent GETs only, with cached responses)
  const rule = method === "GET" ? THROTTLE_RULES[requestKey] : undefined;
  if (rule) {
    const cached = throttleCache.get(requestKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < rule.ttlMs) {
      if (rule.cacheResult) {
        return cached.data as T | null;
      }
    }
  }

  // Check if there's already an in-flight request for this endpoint+method
  // Only coalesce GET requests to avoid issues with mutations
  if (method === "GET") {
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest as Promise<T | null>;
    }
  }

  // Create the request promise
  const requestPromise = (async (): Promise<T | null> => {
    let attemptedRefresh = false;

    const performRequest = async (
      tokenOverride?: string | null,
    ): Promise<T | null> => {
      // Use provided token override if present, otherwise fetch a fresh token
      const idToken =
        tokenOverride !== undefined ? tokenOverride : await getAccessToken();

      // If we still don't have a token, fail fast
      if (!idToken) {
        throw new Error("Missing auth token");
      }

      const isJsonBody =
        options.method &&
        options.method !== "GET" &&
        options.method !== "DELETE";

      const headers: Record<string, string> = {
        ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
        ...(options.headers as Record<string, string>),
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      };

      const res = await executeHttpRequest(
        `${BASE_URL}${endpoint}`,
        {
          ...options,
          headers,
        },
        method === "GET"
      );

      // If auth failed once, force a token refresh and retry a single time
      if (res.status === 401 && !attemptedRefresh) {
        attemptedRefresh = true;
        const fresh = await getAccessToken(true);
        if (fresh && fresh !== idToken) {
          return performRequest(fresh);
        }
        return null;
      }

      if (res.status === 204) return null;

      if (res.status === 403) {
        throw new Error("Profile setup required");
      }

      // Fail closed on authentication errors
      if (res.status === 401) {
        // Token is invalid or revoked - avoid noisy logging when no token was attached
        if (idToken) {
          console.warn("Authentication failed - token invalid or revoked");
        }
        return null;
      }

      const raw = await res.text();

      if (!res.ok) {
        if (res.status !== 404) {
          console.warn("[api] request_failed", {
            endpoint,
            status: res.status,
            method,
          });
        }
        return null;
      }

      const parsed = safeJson<T>(raw);

      // Update throttle cache on success
      if (rule) {
        throttleCache.set(requestKey, {
          timestamp: Date.now(),
          data: parsed,
        });
      }

      return parsed;
    };

    try {
      const initialToken = token !== undefined ? token : await getAccessToken();
      return await performRequest(initialToken);
    } catch (err: any) {
      const errMsg =
        err?.code === "auth/quota-exceeded" || err?.message?.includes("quota-exceeded")
          ? "Auth quota exceeded"
          : err instanceof Error
          ? err.message
          : String(err);

      console.error("[api] network_error", {
        endpoint,
        method,
        message: errMsg,
      });
      return null;
    } finally {
      // Remove from in-flight map once resolved or rejected
      if (method === "GET") {
        inFlightRequests.delete(requestKey);
      }
    }
  })();

  // Store in-flight request for GET requests only
  if (method === "GET") {
    inFlightRequests.set(requestKey, requestPromise);
  }

  return requestPromise;
}

//********************************************************************
//
// apiGet Function
//
// Performs a GET request to the specified endpoint.
//
// Return Value
// ------------
// Promise<T|null>    Parsed response data of type T, or null on error
//
// Value Parameters
// ----------------
// endpoint    string    API endpoint path
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
export function apiGet<T>(endpoint: string, token?: string | null) {
  return apiRequest<T>(endpoint, { method: "GET" }, token);
}

//********************************************************************
//
// apiPost Function
//
// Performs a POST request to the specified endpoint with JSON body.
//
// Return Value
// ------------
// Promise<T|null>    Parsed response data of type T, or null on error
//
// Value Parameters
// ----------------
// endpoint    string    API endpoint path
// data        any       Data object to send as JSON body
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
export function apiPost<T>(endpoint: string, data: any, token?: string | null) {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  }, token);
}

//********************************************************************
//
// apiPatch Function
//
// Performs a PATCH request to the specified endpoint with JSON body.
//
// Return Value
// ------------
// Promise<T|null>    Parsed response data of type T, or null on error
//
// Value Parameters
// ----------------
// endpoint    string    API endpoint path
// data        any       Data object to send as JSON body
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
export function apiPatch<T>(endpoint: string, data: any, token?: string | null) {
  return apiRequest<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  }, token);
}

//********************************************************************
//
// apiDelete Function
//
// Performs a DELETE request to the specified endpoint.
//
// Return Value
// ------------
// Promise<T|null>    Parsed response data of type T, or null on error
//
// Value Parameters
// ----------------
// endpoint    string    API endpoint path
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
export function apiDelete<T>(endpoint: string, token?: string | null) {
  return apiRequest<T>(endpoint, { method: "DELETE" }, token);
}
