//********************************************************************
//
// Auth Helpers
//
// Utility functions for authentication flows. Provides phone signup
// isolation to ensure clean auth state for new phone number signups.
//
//*******************************************************************

// Phone signup is handled by Cognito.
export async function ensureSignedOutForPhoneSignup(): Promise<void> {
  return;
}

