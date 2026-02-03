//********************************************************************
//
// clearTokens Function
//
// Clears any locally stored authentication data. Currently a no-op
// as tokens are managed exclusively by Cognito SDK. Kept for
// API compatibility with existing logout/delete account flows.
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

import * as SecureStore from "expo-secure-store";

const OAUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface OAuthRecord {
  value: string;
  expiresAt: number;
}

export async function clearTokens() {
  // Tokens are managed exclusively by Cognito SDK
  // No SecureStore token storage needed
  // This function is kept for API compatibility but does nothing
}

//********************************************************************
//
// saveOAuthData Function
//
// Stores OAuth-provided name and email from Google/Apple sign-in.
// Used to pre-fill onboarding form. Cleared after onboarding completes.
//
// Return Value
// ------------
// Promise<void>
//
// Value Parameters
// ---------------- 
// name     string|null    User's name from OAuth provider
// email    string|null    User's email from OAuth provider
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
export async function saveOAuthData(name: string | null, email: string | null) {
  const now = Date.now();
  const expiresAt = now + OAUTH_TTL_MS;

  try {
    if (name) {
      const record: OAuthRecord = { value: name, expiresAt };
      await SecureStore.setItemAsync("oauthName", JSON.stringify(record));
    }
    if (email) {
      const record: OAuthRecord = { value: email, expiresAt };
      await SecureStore.setItemAsync("oauthEmail", JSON.stringify(record));
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[authStorage] Failed to save OAuth data", error);
    }
  }
}

//********************************************************************
//
// getOAuthData Function
//
// Retrieves stored OAuth name and email. Returns null if not found.
// Used to pre-fill onboarding form.
//
// Return Value
// ------------
// Promise<{ name: string | null; email: string | null }>
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
export async function getOAuthData(): Promise<{ name: string | null; email: string | null }> {
  try {
    const nameRaw = await SecureStore.getItemAsync("oauthName");
    const emailRaw = await SecureStore.getItemAsync("oauthEmail");

    const decode = (raw: string | null) => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as OAuthRecord;
        if (!parsed?.value || !parsed?.expiresAt) return null;
        if (Date.now() > parsed.expiresAt) {
          return "expired" as const;
        }
        return parsed.value;
      } catch {
        // Legacy plain string fallback
        return raw;
      }
    };

    const name = decode(nameRaw);
    const email = decode(emailRaw);

    if (name === "expired") {
      await SecureStore.deleteItemAsync("oauthName");
    }
    if (email === "expired") {
      await SecureStore.deleteItemAsync("oauthEmail");
    }

    return {
      name: typeof name === "string" ? name : null,
      email: typeof email === "string" ? email : null,
    };
  } catch (error) {
    if (__DEV__) {
      console.warn("[authStorage] Failed to read OAuth data", error);
    }
    return { name: null, email: null };
  }
}

//********************************************************************
//
// clearOAuthData Function
//
// Deletes stored OAuth name and email from SecureStore.
// Called after onboarding completes or user logs out.
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
export async function clearOAuthData() {
  try {
    await SecureStore.deleteItemAsync("oauthName");
    await SecureStore.deleteItemAsync("oauthEmail");
  } catch (error) {
    if (__DEV__) {
      console.warn("[authStorage] Failed to clear OAuth data", error);
    }
  }
}
