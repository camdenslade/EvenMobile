import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { closeSocket } from "../services/socket";
import { clearAuthCaches } from "../services/apiService";

type AuthUser = {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  appleSub?: string | null;
  providerData?: Array<{ providerId?: string }>;
};

interface AuthContextType {
  user: AuthUser | null;
  idToken: string | null; // access_token used for API calls
  loading: boolean;
  error: string | null;
  startPhoneAuth: (phoneNumber: string) => Promise<{ session: string; expiresInMs?: number | null }>;
  resendPhoneCode: (phoneNumber: string) => Promise<{ session: string; expiresInMs?: number | null }>;
  verifyPhoneCode: (input: { phoneNumber: string; code: string; session: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  idToken: null,
  loading: true,
  error: null,
  startPhoneAuth: async () => ({ session: "" }),
  resendPhoneCode: async () => ({ session: "" }),
  verifyPhoneCode: async () => {},
  logout: async () => {},
});

const ACCESS_TOKEN_KEY = "EvenApp_access_token";
const REFRESH_TOKEN_KEY = "EvenApp_refresh_token";
const EXPIRES_AT_KEY = "EvenApp_access_token_expires_at";
const LEGACY_STORAGE_KEY = "EvenApp_cognito_tokens";
const COGNITO_DOMAIN = "https://us-east-1mggdopo3g.auth.us-east-1.amazoncognito.com";
const CLIENT_ID = process.env.EXPO_PUBLIC_COGNITO_APP_CLIENT_ID;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

type StoredTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

type VerifyResponse = {
  accessToken: string;
  refreshToken?: string | null;
  idToken?: string | null;
  expiresIn?: number | null;
  tokenType?: string | null;
};

function requireClientId(): string {
  if (!CLIENT_ID) {
    throw new Error("Cognito client ID not configured (EXPO_PUBLIC_COGNITO_APP_CLIENT_ID)");
  }
  return CLIENT_ID;
}

function decodeUser(accessToken: string): AuthUser | null {
  try {
    const decoded = jwtDecode<any>(accessToken);
    return {
      uid: decoded.sub,
      email: decoded.email ?? null,
      phoneNumber: decoded.phone_number ?? null,
      appleSub: decoded.apple_sub ?? null,
      providerData: decoded.apple_sub
        ? [{ providerId: "apple.com" }]
        : [{ providerId: "cognito" }],
    };
  } catch (err) {
    if (__DEV__) {
      console.warn("Failed to decode access token", err);
    }
    return null;
  }
}

async function postJson<T>(path: string, body: any): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("API base URL is not configured");
  }

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (__DEV__) {
    console.log("[auth] postJson", { url, status: res.status, text });
  }
  const parsed = text ? (JSON.parse(text) as T & { message?: string }) : null;

  if (!res.ok) {
    const message =
      (parsed as any)?.message || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshInProgressRef = useRef(false); // Blocker #3 - prevent concurrent refreshes

  const secureStoreOptions = {
    keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
  };

  const saveTokens = useCallback(async (tokens: StoredTokens) => {
    await SecureStore.setItemAsync(
      ACCESS_TOKEN_KEY,
      tokens.accessToken,
      secureStoreOptions,
    );
    if (tokens.refreshToken) {
      await SecureStore.setItemAsync(
        REFRESH_TOKEN_KEY,
        tokens.refreshToken,
        secureStoreOptions,
      );
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
    if (tokens.expiresAt) {
      await SecureStore.setItemAsync(
        EXPIRES_AT_KEY,
        String(tokens.expiresAt),
        secureStoreOptions,
      );
    } else {
      await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
    }
    await SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY);
  }, []);

  const clearTokens = useCallback(async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(EXPIRES_AT_KEY);
    await SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY);
  }, []);

  const restoreTokens = useCallback(async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (accessToken) {
        const refreshToken =
          (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)) || undefined;
        const expiresRaw = await SecureStore.getItemAsync(EXPIRES_AT_KEY);
        const expiresAt = expiresRaw ? Number(expiresRaw) : undefined;
        return {
          accessToken,
          refreshToken,
          expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
        };
      }

      const raw = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredTokens;
      if (!parsed?.accessToken) return null;
      await saveTokens(parsed);
      return parsed;
    } catch {
      return null;
    }
  }, [saveTokens]);

  const setSession = useCallback(
    async (tokens: StoredTokens | null) => {
      if (!tokens?.accessToken) {
        setUser(null);
        setIdToken(null);
        setTokenExpiresAt(null);
        await clearTokens();
        clearAuthCaches();
        return;
      }
      const authUser = decodeUser(tokens.accessToken);
      setUser(authUser);
      setIdToken(tokens.accessToken);
      setTokenExpiresAt(tokens.expiresAt ?? null);
      setError(null);
      await saveTokens(tokens);
      clearAuthCaches();
    },
    [clearTokens, saveTokens],
  );

  const startPhoneAuth = useCallback(
    async (phoneNumber: string) => {
      setError(null);
      const response = await postJson<{
        session: string;
        expiresInMs?: number | null;
      }>("/auth/phone/start", { phoneNumber });

      if (!response?.session) {
        throw new Error("Failed to start phone authentication");
      }

      return {
        session: response.session,
        expiresInMs: response.expiresInMs ?? null,
      };
    },
    [],
  );

  const resendPhoneCode = useCallback(
    async (phoneNumber: string) => {
      setError(null);
      const response = await postJson<{
        session: string;
        expiresInMs?: number | null;
      }>("/auth/phone/resend", { phoneNumber });

      if (!response?.session) {
        throw new Error("Failed to resend code");
      }

      return {
        session: response.session,
        expiresInMs: response.expiresInMs ?? null,
      };
    },
    [],
  );

  const verifyPhoneCode = useCallback(
    async (input: { phoneNumber: string; code: string; session: string }) => {
      setError(null);
      const response = await postJson<VerifyResponse>("/auth/phone/verify", input);

      if (!response?.accessToken) {
        throw new Error("Verification failed");
      }

      await setSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || undefined,
        expiresAt: response.expiresIn
          ? Date.now() + response.expiresIn * 1000
          : undefined,
      });
    },
    [setSession],
  );

  const refreshAccessToken = useCallback(async () => {
    // Blocker #3 - prevent concurrent refresh attempts
    if (refreshInProgressRef.current) {
      return;
    }

    refreshInProgressRef.current = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) return;
      let clientId: string;
      try {
        clientId = requireClientId();
      } catch (err) {
        if (__DEV__) {
          console.warn("Token refresh skipped:", err);
        }
        return;
      }

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        refresh_token: refreshToken,
      }).toString();

      const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        refresh_token?: string;
      };

      if (!data?.access_token) {
        return;
      }

      await setSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: typeof data.expires_in === "number"
          ? Date.now() + data.expires_in * 1000
          : undefined,
      });
    } catch (err) {
      console.warn("Token refresh failed", err);
    } finally {
      // Blocker #3 - always clear lock
      refreshInProgressRef.current = false;
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      const raw = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
      const legacyParsed = raw ? (JSON.parse(raw) as StoredTokens) : null;
      const tokenToRevoke =
        refreshToken || accessToken || legacyParsed?.refreshToken || legacyParsed?.accessToken;
      if (tokenToRevoke) {
        const clientId = requireClientId();
        await fetch(`${COGNITO_DOMAIN}/oauth2/revoke`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `token=${encodeURIComponent(tokenToRevoke)}&client_id=${encodeURIComponent(clientId)}`,
        });
      }
    } catch (err) {
      console.warn("Token revocation failed", err);
    }

    await setSession(null);
    closeSocket();
  }, [setSession]);

  useEffect(() => {
    if (!idToken || !tokenExpiresAt) return;
    const refreshBufferMs = 5 * 60 * 1000;
    const delayMs = Math.max(tokenExpiresAt - Date.now() - refreshBufferMs, 0);
    const timer = setTimeout(() => {
      void refreshAccessToken();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [idToken, tokenExpiresAt, refreshAccessToken]);

  // Initial restore
  useEffect(() => {
    (async () => {
      const restored = await restoreTokens();
      if (restored?.accessToken) {
        await setSession(restored);
      } else {
        setUser(null);
        setIdToken(null);
      }
      setLoading(false);
    })().catch((err) => {
      console.error("Auth restore failed", err);
      setLoading(false);
    });
  }, [restoreTokens, setSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        idToken,
        loading,
        error,
        startPhoneAuth,
        resendPhoneCode,
        verifyPhoneCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
