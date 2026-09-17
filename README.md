# 404 Cyber House — billing & booking module

Fastify + Prisma + TypeScript backend for club billing and PC booking.
This module was built from scratch on an empty repository (see commit
history) — it does *not* assume any pre-existing wizard/auth/admin code.

## Scope

In scope (v1, per agreed priorities):

- Zones/Devices (панель ПК, статус-машина, WOL point of extension)
- Tariffs: BASE (poминутный), PACKAGE (fixed duration / fixed end),
  SUBSCRIPTION (flat price, consumed across visits)
- Booking + Session lifecycle, with the agreed business rules:
  - 5-minute minimum lead time before a booking can start
  - 60-minute minimum gap between two bookings on the same device
  - one device = one code, even inside a room/zone
  - booking code is valid strictly until the paid window ends (no grace)
  - session extension capped at "next booking start − 30 minutes"
- Guest (minimal) + delta-based BalanceLedger + ManualBalanceLog audit trail
- Loyalty: hour-based tiers, manual groups, auto-bonus rules, birthday bonus,
  cashback wired into booking/session charges
- Refunds workflow (ст. 32 ЗоЗПП): PENDING → APPROVED/REJECTED → COMPLETED
- Payments + fiscalization: **stub adapters** (`src/modules/payments/provider.ts`,
  `src/modules/fiscal/provider.ts`) — real Т-Банк (СБП/эквайринг + ОФД) wiring
  is a deliberate follow-up, not part of this module

Out of scope (owned by other modules, not built here):

- Registration wizard, phone+password auth, door/intercom codes, guest CRUD UI
- Smart home / CCBoot integration (Home Assistant, MikroTik WOL is stubbed
  behind `WakeOnLanPort` — `src/modules/devices/wol.ts`)
- Bot (Telegram/VK) — decommissioned per project decision, not reintroduced
- Frontend (station widget/lock screen, admin UI, guest-facing booking page)
- Promo codes, dynamic pricing, cash/shift reports — second wave

## Known v1 simplifications (documented in code)

- Day-type resolution uses UTC weekday, not the club's timezone
  (`src/modules/tariffs/daytype.ts`)
- `BalanceService.applyDelta` reads-then-writes without a row lock — fine at
  v1 traffic, needs `SELECT … FOR UPDATE` or serializable transactions before
  high-concurrency production use (`src/modules/balance/service.ts`)
- Loyalty recalculation period is read from the first `LoyaltySettings` row
  found, since Guest isn't tied to one club in this schema
  (`src/modules/loyalty/service.ts`)

## Getting started

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run prisma:migrate
npm run dev
```

```bash
npm run typecheck
npm test
```
