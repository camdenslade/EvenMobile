/**
 * Phone Number Formatting Utilities
 * 
 * Formats phone numbers for display while maintaining raw digits for API calls.
 */

/**
 * Formats a phone number string to (XXX) XXX-XXXX format as user types
 * @param value - Raw phone number input (digits only)
 * @returns Formatted phone number string
 * 
 * Examples:
 *   formatPhoneNumber("5551234") -> "(555) 123-4"
 *   formatPhoneNumber("5551234567") -> "(555) 123-4567"
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits (US/Canada format)
  const limitedDigits = digits.slice(0, 10);
  
  // Apply formatting based on length
  if (limitedDigits.length === 0) {
    return '';
  } else if (limitedDigits.length <= 3) {
    return `(${limitedDigits}`;
  } else if (limitedDigits.length <= 6) {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  } else {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
  }
}

/**
 * Extracts raw digits from a formatted phone number
 * @param formatted - Formatted phone number string
 * @returns Raw digits only
 * 
 * Example:
 *   extractDigits("(555) 123-4567") -> "5551234567"
 */
export function extractPhoneDigits(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

