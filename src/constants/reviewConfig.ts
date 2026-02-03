//********************************************************************
//
// App Store Review Configuration
//
// Contains test account credentials for Apple App Store review process.
// The demo phone number and email bypass actual verification when the
// backend detects them and accepts a secret-prefixed verification code.
//
// SECURITY:
// 1. Backend must have ENABLE_DEMO_ACCOUNT=true
// 2. Backend must have DEMO_REVIEW_SECRET set (e.g., "APPLE2024")
// 3. Verification code format: {SECRET}-123456 (e.g., "APPLE2024-123456")
// 4. Only Apple reviewers will know the secret from App Store submission notes
//
//*******************************************************************

// Demo account for App Store reviewers
// Format: E.164 international format
export const DEMO_PHONE_NUMBER = "+15550123456";
export const DEMO_PHONE_DISPLAY = "(555) 012-3456";

// Demo school email for testing email verification
export const DEMO_SCHOOL_EMAIL = "reviewer@missouristate.edu";

// Base code (actual code is {SECRET}-123456, provided in App Store review notes)
export const DEMO_BASE_CODE = "123456";

// Check if a phone number is the demo account
export function isDemoAccount(phoneNumber: string): boolean {
  // Normalize phone number by removing all non-digit characters except leading +
  const normalized = phoneNumber.replace(/[^\d+]/g, "");
  return normalized === DEMO_PHONE_NUMBER;
}

// Check if an email is the demo email
export function isDemoEmail(email: string): boolean {
  return email.toLowerCase() === DEMO_SCHOOL_EMAIL;
}
