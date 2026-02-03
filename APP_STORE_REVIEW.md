# App Store Review Testing Guide

## Demo Account Credentials

Use the following test account to review the app:

**Phone Number:** (555) 012-3456
**Verification Code:** 800008

**School Email (optional):** reviewer@missouristate.edu
**Email Verification Code:** 800008

---

### Reviewer Sandbox Accounts (private pool)

All sandbox accounts use the same verification code: `800008`. When `ENABLE_DEMO_ACCOUNT=true`, these accounts are siloed: they only see each other (and the primary reviewer) and are hidden from all real users.

| Role / Scenario | Phone number | Verification code | Usage |
| --- | --- | --- | --- |
| Reviewer (pre-seeded account) | (555) 012-3456 | `800008` | Use to verify an account that's already set up |
| Reviewer (fresh onboarding) | (555) 012-3457 | `800008` | Use to run through onboarding from scratch |
| Scenario 1 | (555) 012-3458 | `800008` | Has sent a message and review to reviewer |
| Scenario 2 | (555) 012-3459 | `800008` | Existing match with reviewer |
| Scenario 3 | (555) 012-3460 | `800008` | Incoming message request |
| Scenario 4 | (555) 012-3461 | `800008` | Like sent, waiting for reviewer to swipe |
| Scenario 5 | (555) 012-3462 | `800008` | Profile to swipe on, try an undo |
| Scenario 6 | (555) 012-3463 | `800008` | Profile to swipe on, try a message request |

All seeded profiles are invisible to the main feed. Only users logged in with these credentials can see the sandbox accounts.

---

## Backend Configuration

To enable demo account for App Store review, set the following environment variables:

```bash
ENABLE_DEMO_ACCOUNT=true
DEMO_VERIFICATION_CODE=800008
```

**Security Notes:**
- The verification code is used for both phone OTP and email verification
- Generate a new code for each App Store submission
- Only Apple reviewers will know the code from your review notes
- Disable after review by setting `ENABLE_DEMO_ACCOUNT=false`

---

## App Store Connect Review Notes Template

Copy this to your App Store Connect review notes field:

```
Demo Account for Testing:

Phone: (555) 012-3456
Verification Code: 800008

School Email Verification (optional feature in Settings):
Email: reviewer@missouristate.edu
Code: 800008

Note: Location permission is required to view nearby profiles.
```

---

## Complete Feature Testing Checklist

### 1. Authentication & Onboarding

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Phone sign-up | Enter (555) 012-3456, then code | Proceeds to onboarding |
| OTP entry | Enter 800008 | Code accepted, moves forward |
| Session restore | Close app, reopen | Auto-logged in, no login screen |
| Sign out | Settings > Sign Out | Returns to login screen |

### 2. Profile Setup (Onboarding Flow)

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Photo upload | Tap photo slot, select from library | Photo appears with crop option |
| Photo cropping | Pinch/zoom on photo | Crop saves correctly |
| Name entry | Enter first name | Accepts alphabetic characters |
| Birthday | Select date | Must be 18+ to proceed |
| Gender selection | Tap Male/Female/Non-binary | Single selection only |
| Height picker | Scroll height selector | Height saved to profile |
| Race selection | Tap race options | Up to 2 selections allowed |
| Religion/Politics | Tap options | Single selection each |
| Education level | Tap option | Single selection |
| Lifestyle (drinking/smoking/marijuana) | Tap options | Single selection each |
| Interests | Search and tap interests | Multiple selections, min 3 |
| Bio | Type in text field | 500 char limit, saves |
| Terms of Service | Tap to view | Modal displays full terms |
| Privacy Policy | Tap to view | Modal displays full policy |
| Guidelines | Tap to view | Modal displays guidelines |

### 3. Discovery / Swiping

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| View profiles | Swipe screen loads | Shows nearby user profiles |
| Swipe right (like) | Swipe card right | Card animates off, next shows |
| Swipe left (pass) | Swipe card left | Card animates off, next shows |
| Tap for details | Tap on profile card | Expanded view with all photos/bio |
| Photo carousel | Swipe photos horizontally | Navigate through user's photos |
| Empty queue | Pass all profiles | "No more profiles" message |
| Refresh queue | Pull down or shuffle button | Fetches new profiles |
| Location permission | First launch | Prompts for location access |

### 4. Premium Features (Tokens Required)

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Undo swipe | Tap undo button | Returns last swiped profile |
| Send message with like | Tap message icon on card | Opens message composer |
| Search by name | Profile tab > Search | Opens search screen |
| Purchase undo tokens | Tap undo when empty | Shows purchase modal |
| Purchase message tokens | Tap message when empty | Shows purchase modal |
| Purchase search tokens | Tap search when empty | Shows purchase modal |

### 5. Matches

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| View matches | Tap Matches tab | Lists all mutual matches |
| Match notification | When mutual like occurs | Shows match animation |
| Open match profile | Tap on match | Shows full profile |
| Start conversation | Tap message button | Opens chat screen |
| Unmatch | Swipe left on match or tap unmatch | Confirmation modal, removes match |

### 6. Messaging

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Message list | Tap Messages tab | Shows all conversations |
| Open conversation | Tap on conversation | Opens chat thread |
| Send message | Type and tap send | Message appears in thread |
| Receive message | Other user sends | Message appears, notification |
| Message request | New match messages | Shows in requests section |
| Accept request | Tap accept | Moves to main messages |
| Decline request | Tap decline | Removes conversation |
| Read receipts | View sent messages | Shows read status |

### 7. Reviews

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| View received reviews | Profile > Reviews | Shows reviews from matches |
| Write review | Chat screen > Review button | Opens review form |
| Rating selection | Tap 1-10 rating | Single selection |
| Review text | Type review | 500 char limit |
| Submit review | Tap submit | Review saved, confirmation |
| Rating gauge | View profile with reviews | Shows average rating visualization |

### 8. Profile & Settings

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| View own profile | Tap Profile tab | Shows your profile |
| Edit profile | Tap Edit | Opens edit screen |
| Change photos | Tap photo, select new | Photo updates |
| Reorder photos | Long press and drag | Order changes |
| Update bio | Edit text | Saves on exit |
| Theme toggle | Settings > Theme | Switches light/dark |
| Custom theme | Settings > Customize | Opens color picker |
| Verify school email | Settings > School Email | Send code flow |
| Pause account | Settings > Pause | Account hidden from discovery |
| Resume account | Settings > Resume | Account visible again |
| Delete account | Settings > Delete | Confirmation, account removed |
| View Terms | Settings > Terms | Opens terms modal |
| View Privacy | Settings > Privacy | Opens privacy modal |
| Analytics consent | Settings > Privacy toggle | Toggles analytics |

### 9. Safety Features

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| Block user | Swipe card > 3-dot menu > Block | User blocked, removed from feed |
| Report user | Swipe card > 3-dot menu > Report | Opens report form for that user |
| Report reasons | In report form, select a category | Multiple options available |
| Safety screen | Swipe card > 3-dot menu > Safety resources | Opens Safety screen |

### 10. Accessibility

| Feature | How to Test | Expected Result |
|---------|-------------|-----------------|
| VoiceOver | Enable in iOS settings | All elements have labels |
| Dynamic type | Increase text size | Text scales appropriately |
| Touch targets | Tap buttons | Min 44pt touch targets |
| Color contrast | View in bright light | Text readable |

---

## Test Scenarios (Step-by-Step)

### Scenario 1: Complete New User Flow
1. Fresh install app
2. Tap "Create Account"
3. Enter phone: (555) 012-3456
4. Enter code: 800008
5. Upload 1-6 photos
6. Enter name, birthday, gender
7. Select height, race, religion, politics, education
8. Select lifestyle preferences
9. Choose 3+ interests
10. Write bio
11. Accept terms and guidelines
12. Grant location permission
13. Start swiping

### Scenario 2: School Email Verification
1. Complete onboarding (Scenario 1)
2. Go to Profile tab
3. Tap Settings (gear icon)
4. Scroll to "Verify School Email"
5. Enter: reviewer@missouristate.edu
6. Tap "Send Code"
7. Enter code: 800008
8. Tap "Verify"
9. Verify badge appears on profile

### Scenario 3: Matching & Messaging
1. Swipe right on several profiles
2. When match occurs, view animation
3. Go to Matches tab
4. Tap on a match
5. View their full profile
6. Tap "Message"
7. Send a message
8. Verify message appears in chat

### Scenario 4: Premium Purchase Flow
1. Use all undo tokens
2. Swipe, then tap Undo
3. Purchase modal appears
4. Select token package
5. Complete sandbox purchase
6. Verify tokens credited
7. Use undo successfully

### Scenario 5: Settings & Account Management
1. Go to Settings
2. Toggle theme (Light/Dark)
3. View Terms of Service
4. View Privacy Policy
5. Toggle analytics consent
6. Tap "Pause Account"
7. Verify paused state
8. Tap "Resume Account"
9. Sign out
10. Sign back in (session should restore)

---

## Known Limitations

1. **Location Required:** App requires location permission to show nearby profiles
2. **Sandbox Isolation:** Demo accounts only see other demo accounts (Scenarios 1-6)
3. **Purchases:** In-app purchases use Apple's sandbox environment
4. **Demo Mode:** Credentials only work when backend has `ENABLE_DEMO_ACCOUNT=true`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid code" error | Ensure code is exactly `800008` |
| No profiles showing | Check location permission is granted |
| Can't verify email | Use exact email: reviewer@missouristate.edu |
| Purchase fails | Use sandbox Apple ID for testing |
| Session not restoring | Check backend is running with demo mode enabled |

---

## Contact

For any questions during review: support@evendating.us
