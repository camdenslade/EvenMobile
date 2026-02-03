# Frontend Manual Test Suite

Source of truth: `MANUAL_TESTING_CHECKLIST.md`. This suite organizes those cases for execution, captures environment, and adds result columns so runs can be tracked.

## How to run
- Devices: iOS (latest), Android (latest), and Web (if applicable). Use real devices for push, camera, and in-app purchase flows.
- Accounts: fresh user, returning user, admin-capable user, and a refunded/chargeback fixture where noted.
- Build: use production-like env and API base; ensure feature flags match launch configuration.
- Record results inline with ✅/❌ and notes for each case; include build hash and device in the run header.

## Sections & Cases (inherit expected outcomes and severities from the checklist)

### Authentication & Account Lifecycle
- [ ] Happy paths (phone signup/login, Google Android, Apple iOS, sign out, update email, pause/resume, delete)
- [ ] Edge cases (bad codes, platform-mismatched OAuth, revoked tokens, invalid email, delete with matches, re-signup, multi-device logout)
- [ ] Failure states (SMS unavailable, OAuth/network errors, backend 500s, revocation failures)

### Onboarding Flow
- [ ] Happy paths (full required fields, OAuth-prefill, multi-photo upload, optional skips)
- [ ] Edge cases (resume after app close, moderation flag, min/max age, no location permission, size/type limits)
- [ ] Failure states (backend errors, S3/presign failures, duplicate UID, invalid dates)

### Profile Creation & Editing
- [ ] Happy paths (view self, edit details, add/delete photos, update location, view moderation status)
- [ ] Edge cases (bio max/empty, 6th photo, delete all photos, out-of-region location, all photos pending)
- [ ] Failure states (401, presign fail, delete fail, timeouts)

### Photo Uploads & Media Handling
- [ ] Happy paths (presigned upload, display, moderation approve/flag)
- [ ] Edge cases (pending status, size boundary, presign reuse, delete-before-moderation, rapid multi-upload)
- [ ] Failure states (S3 down, presign fail, Vision API down, network fail, 403/404 display)

### Swipe / Discovery Logic
- [ ] Happy paths (queue populate, like/skip, shuffle, distance/age/sex preference enforcement)
- [ ] Edge cases (empty queue state, ...)
- [ ] Failure states (network drops, rate-limit/backoff messaging, Redis outage fallback if exposed to client)

### Matches & Messaging
- [ ] Happy paths (view matches, open chat, send/receive, message requests accept/decline, push notifications)
- [ ] Edge cases (blocked users, deleted threads, stale presigned URLs for avatars)
- [ ] Failure states (send fail, fetch fail, reconnect/retry UI)

### Purchases & Receipts
- [ ] Apple validation success/fail, gated Google flow (NOT_IMPLEMENTED path), entitlement grant/revoke, refund/chargeback handling UX, receipt retention messaging.

### Notifications & Settings
- [ ] Opt-in/out flows, token scope handling, per-device revocation, settings saves with and without network.

### Profile Search & Reviews
- [ ] Search debounce/empty guard, error UI, profile fetch retry/backoff, review list/detail/write flows, accessibility text for gauges.

### Accessibility & UI States
- [ ] Screen reader labels on critical controls, loading/placeholder states (avatars, match modal), error banners, pull-to-refresh where available.

### Compliance / Legal Signals
- [ ] Sensitive attribute handling (race/religion/politics/substance), consent messaging, takedown/deletion visibility, DSAR-friendly export/delete paths exposed in UI.

## Recording results
For each run, add a small header with:
```
Run: YYYY-MM-DD / Build hash / Device+OS
Executor: Name
Notes: e.g., flags, known issues
```
Then mark each case with ✅/❌ and a brief note or ticket link.

## Coverage mapping
All cases above correspond 1:1 to the items in `MANUAL_TESTING_CHECKLIST.md`. If that file changes, update this suite to match so coverage stays aligned.
