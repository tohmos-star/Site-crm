# 404 Cyber House — guest Android app

Kotlin + Jetpack Compose (Material 3) Android app for guests of the club.
Mirrors the guest-facing side of the site prototype (login, booking, balance,
loyalty, AI support chat, promotions, club info) — **no admin panel is
included by design**, per the task this module was built for.

## Scope decision: mock data, no backend wiring yet

This first version talks to **no network backend**. All data (guests,
stations, bookings, FAQ) lives in `MockGuestRepository`, in memory, seeded
with the same demo accounts as the site prototype:

- `+79991234567` / `demo123` (Иванов, баланс 3000 ₽, тир «Завсегдатай»)
- `+79997654321` / `demo123` (Петров, баланс 1500 ₽, без тира)

This was a deliberate choice (asked and confirmed before building): the two
candidate backends in this repo/session don't line up —
`tohmos-star/site-crm`'s own billing/booking API (this repository, branch
`claude/billing-booking-module-83hogx`) has no auth and no support-chat
endpoint, while the fuller site backend (auth, booking, AI support chat) only
exists in a ZIP delivered earlier in the session, not in this repository.
Building against a real backend was deferred rather than guessed at.

**To wire up a real backend later:** implement `GuestRepository` (see
`data/GuestRepository.kt`) against whichever API ends up authoritative —
Retrofit/Ktor client, same method signatures — and swap it in in
`Club404App.onCreate()`. No screen or ViewModel needs to change; that's the
whole point of the interface.

## What's implemented

- Login / registration (mock, in-memory)
- Home dashboard: balance, bonus points, active session / next booking, door
  code (shown **only** when a session is actually active right now — same
  hard rule as the site's support agent, not left to any model/heuristic)
- Booking: pick a station, a quick start-time offset, a duration, see a live
  price quote (tariff grid + loyalty discount/cashback), confirm, cancel
- Balance: top-up (instant demo confirmation), refund request (ст. 32 ЗоЗПП —
  filed as a ticket for staff to action; there's no admin screen in this app
  to approve it, by design)
- AI support chat: same context-building and `ESCALATE:` convention as the
  site's support agent (`backend/src/lib/supportContext.ts` /
  `supportPrompt.ts` in the ZIP-delivered backend) — reimplemented as an
  offline keyword-matching responder (`data/SupportAgent.kt`) since there's
  no LLM call from this mock layer. Escalations create a `SupportTicket`
  visible on the Profile screen.
- Prices/tariffs, promotions, club info, profile/loyalty tier, logout

## What's not implemented (honest list, not hidden)

- **No real network calls anywhere** — see scope decision above.
- **No date/time picker** for booking — quick relative-time chips
  (`+10 мин`, `+1 час`, ...) instead of a calendar. Noted as a follow-up, not
  an oversight.
- **No redeem-code screen** — `GuestRepository.redeemCode()` exists and is
  fully implemented (mirrors the site's code-redemption rule: valid strictly
  until the paid window ends, no grace period) but nothing in the UI calls
  it yet, since redeeming normally happens at the club's PC, not on a
  guest's own phone.
- **No document/selfie upload** in registration — simplified to text fields
  only for this first version.
- **This build was never compiled in this environment.** The sandbox's
  egress policy blocks `dl.google.com` (`google()` Gradle repository plus the
  Android SDK's own component downloads), so neither the Android Gradle
  Plugin nor a `compileSdk` platform could be resolved here — confirmed by a
  failed `gradle wrapper` invocation before working around it from an
  unrelated empty directory. The code was written carefully and
  cross-checked file-by-file against every Compose API call and its import
  (see git history for that pass), but **run `./gradlew assembleDebug` (or
  open in Android Studio) before trusting it compiles clean** — that
  verification could not be done here and should not be assumed done.

## Running it

```bash
cd android
./gradlew assembleDebug     # or open the android/ folder in Android Studio
```

Requires network access to `google()`/`mavenCentral()` (for Gradle plugin +
AndroidX dependencies) and an installed Android SDK (`compileSdk 34`,
`minSdk 26`) — neither was available in the environment this was built in.
