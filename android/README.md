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

- **Registration**: full 7-step wizard matching `register.html`/`register.js`
  — intro + consent, phone (`+7XXXXXXXXXX` validated), password (6+ chars),
  ФИО (2+ words), document photo, selfie, pending-review screen. No
  auto-login after submitting, same as the site. Document/selfie photos are
  taken with the device camera (`ActivityResultContracts.TakePicturePreview`
  — opens the system Camera app, no `CAMERA` permission declaration needed)
  and shown as a preview, exactly as opaque/unstored as the site's own
  `FormData` upload — nothing downstream reads them. `Guest.regStatus`
  exists for a real backend's benefit but the mock auto-approves immediately
  (there's no admin in this app to do it for real — see `RegStatus` in
  `Models.kt`).
- **Booking**: 3-column station grid (label + room + ₽/час, matching
  `ROOM_LABELS` from `booking.js`), a real Material3 date + time picker
  (not a relative-offset shortcut), duration chips (1ч/3ч/6ч) plus a ±10-min
  stepper, a live price quote, and a dedicated "code" screen after booking
  (big digits + "Забронировать ещё") instead of an inline success message.
  "Мои брони" lists upcoming/active bookings with cancel.
- **Session widget** (`SessionWidget.kt`) — the phone-side equivalent of
  `pc-widget.html`'s station overlay, embedded on the Home screen: exactly
  the 4 actions asked for — Начать сессию/Продлить (redeems the next
  booking's code, or opens an extend dialog with the same 3ч/6ч packages
  and 10-min stepper as the PC widget once a session is active), Пополнить
  баланс, Закончить сессию, Тех.поддержка. "Перезагрузить" from the PC
  widget was deliberately left out — it only makes sense from the station
  itself, not a guest's own phone.
- **End-session report** (`EndSessionScreen.kt`) — carsharing-style
  "confirm before you finish": the 3 checkboxes and 2 required + 1 optional
  camera photos from `report.html`/`report.js`, gating
  `GuestRepository.endActiveSessionWithReport()`. There is no path to end an
  active session without going through this screen.
- Home dashboard: balance, bonus points, door code (shown **only** when a
  session is actually active right now — same hard rule as the site's
  support agent, not left to any model/heuristic)
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

- **No real network calls anywhere** — see scope decision above. Registration
  photos, in particular, go nowhere beyond the preview shown in the wizard —
  same as the site in its own demo/offline fallback path.
- **This sandbox itself still can't compile Android code** — its egress
  policy blocks `dl.google.com` (`google()` Gradle repository plus the
  Android SDK's own component downloads), confirmed by a failed local
  `gradle wrapper` invocation. Real verification happens in CI instead: a
  GitHub Actions workflow (`.github/workflows/android-apk.yml`) builds the
  debug APK on push and publishes it as a release asset — see its run
  history for whether the current `HEAD` actually compiles. It's caught
  real bugs before (an unclosed nested `/*` comment inside a KDoc, a missing
  `getValue` import for a `by` delegate, a wrong explicit `weight` import
  shadowing the real `ColumnScope`/`RowScope` member function) that manual
  review here could not have found without a compiler. Manual import
  cross-checking still happens on every change as a first pass, but the CI
  run is what actually confirms it.

## Running it

```bash
cd android
./gradlew assembleDebug     # or open the android/ folder in Android Studio
```

Requires network access to `google()`/`mavenCentral()` (for Gradle plugin +
AndroidX dependencies) and an installed Android SDK (`compileSdk 34`,
`minSdk 26`) — neither was available in the environment this was built in.
