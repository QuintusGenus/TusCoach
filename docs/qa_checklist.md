# Mobile QA Checklist

Run through this checklist on a **physical device** (iOS + Android) before
every release. Each item should be verified against the **preview** build
pointing at the staging API.

---

## 1. Authentication

- [ ] **Register** — create a new account with valid email + password (8+ chars)
- [ ] **Register validation** — short password shows error, duplicate email shows error
- [ ] **Login** — sign in with existing credentials, lands on Dashboard
- [ ] **Login error** — wrong password shows error message, does not crash
- [ ] **Token persistence** — kill the app, reopen → still logged in
- [ ] **Logout** — tap Settings → Logout → redirects to Login screen

## 2. Onboarding

- [ ] **First launch** — new user sees onboarding flow after registration
- [ ] **TUS date picker** — date picker opens, selection saves
- [ ] **Daily target** — weekday/weekend minute inputs accept numbers
- [ ] **Completion** — finishing onboarding lands on Dashboard with preferences saved

## 3. Dashboard (Home tab)

- [ ] **Stats cards** — today's minutes, target, streak, exam countdown all render
- [ ] **Streak** — shows correct count (cross-check with backend `/v1/stats/summary`)
- [ ] **Exam countdown** — shows days until TUS date (or nothing if not set)
- [ ] **Weekly chart** — bars render for the last 8 weeks
- [ ] **Motivation insight** — correct copy for: 0 minutes / below target / met target
- [ ] **Pull to refresh** — swipe down refreshes all stats

## 4. Progress tab

- [ ] **Weekly chart** — 8-week bar chart renders with correct values
- [ ] **Daily table** — rows show date, minutes, target, and Met/Missed badge
- [ ] **Filter pills** — switching 7d / 30d / 90d updates the table immediately
- [ ] **Empty state** — new user with no sessions sees sensible zero/empty state

## 5. Inbox / Messages tab

- [ ] **Message list** — shows coach messages ordered newest-first
- [ ] **Unread badge** — tab badge shows correct unread count
- [ ] **Read/unread styling** — unread messages visually distinct from read
- [ ] **Tap to open** — opens message detail screen with full body
- [ ] **Mark as read** — opening a message marks it read (badge decrements)
- [ ] **Empty state** — no messages shows a friendly placeholder

## 6. Push Notifications

- [ ] **Permission prompt** — first launch asks for notification permission
- [ ] **Receive push** — trigger a workflow on backend → push arrives on device
- [ ] **Tap notification** — tapping opens the app to the correct message
- [ ] **Background delivery** — notification arrives when app is backgrounded
- [ ] **Quiet hours** — notifications sent during quiet hours are deferred (check DB)

## 7. Settings

- [ ] **Preferences** — daily target and quiet hours display saved values
- [ ] **Edit preferences** — changing values saves to backend
- [ ] **Logout** — clears token and returns to login

## 8. Edge Cases

- [ ] **No network** — shows error/retry UI, does not crash
- [ ] **Slow network** — loading spinners appear, no duplicate submissions
- [ ] **Session expired** — API returns 401 → user is prompted to re-login
- [ ] **Deep link** — opening `tuscoach://message/123` navigates to that message

## 9. Visual / UX

- [ ] **Dark mode** — all screens render correctly in both light and dark mode
- [ ] **Safe area** — no content hidden behind notch / status bar / home indicator
- [ ] **Orientation** — app stays portrait (no layout breaks if rotated)
- [ ] **Keyboard** — inputs not obscured by keyboard on login/register/onboarding

---

## Sign-off

| Platform | Tester | Date | Build # | Pass? |
|----------|--------|------|---------|-------|
| iOS      |        |      |         |       |
| Android  |        |      |         |       |
