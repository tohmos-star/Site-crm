-- CreateEnum
CREATE TYPE "DeviceKind" AS ENUM ('PC', 'TV', 'TERMINAL', 'ADMIN_PC');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('FREE', 'BUSY', 'CONNECTING', 'TECH_MODE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RelayType" AS ENUM ('NONE', 'IR', 'IP_RELAY');

-- CreateEnum
CREATE TYPE "TariffType" AS ENUM ('BASE', 'PACKAGE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PackageMode" AS ENUM ('FIXED_DURATION', 'FIXED_END');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionSource" AS ENUM ('BOOKING', 'WALK_IN_LOGIN');

-- CreateEnum
CREATE TYPE "BalanceKind" AS ENUM ('MONEY', 'BONUS');

-- CreateEnum
CREATE TYPE "BalanceSource" AS ENUM ('TOPUP', 'SESSION_CHARGE', 'SUBSCRIPTION_PURCHASE', 'REFUND', 'MANUAL_ADJUST', 'LOYALTY_CASHBACK', 'BIRTHDAY_BONUS', 'AUTO_BONUS_REGISTRATION', 'AUTO_BONUS_TOPUP');

-- CreateEnum
CREATE TYPE "BalanceReferenceType" AS ENUM ('NONE', 'BOOKING', 'SESSION', 'REFUND', 'MANUAL_LOG', 'PAYMENT');

-- CreateEnum
CREATE TYPE "ManualLogChannel" AS ENUM ('ADMIN_CONSOLE', 'BONUS_CONSOLE', 'GUEST_BALANCE_PAGE', 'API');

-- CreateEnum
CREATE TYPE "RecalcPeriod" AS ENUM ('M1', 'M2', 'M3', 'M4', 'M6', 'M12');

-- CreateEnum
CREATE TYPE "AutoBonusTrigger" AS ENUM ('REGISTRATION', 'TOPUP');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "SourceChannel" AS ENUM ('CASH_DESK', 'APP', 'TERMINAL');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentProviderType" AS ENUM ('STUB', 'TBANK_SBP', 'TBANK_ACQUIRING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "FiscalProviderType" AS ENUM ('STUB', 'TBANK_OFD');

-- CreateEnum
CREATE TYPE "FiscalStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED');

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Samara',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRoom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "kind" "DeviceKind" NOT NULL DEFAULT 'PC',
    "name" TEXT NOT NULL,
    "cardNumber" INTEGER NOT NULL,
    "physicalName" TEXT,
    "mac" TEXT,
    "ip" TEXT,
    "hostname" TEXT,
    "uuid" TEXT,
    "relayType" "RelayType" NOT NULL DEFAULT 'NONE',
    "color" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'FREE',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayType" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "weekdays" INTEGER[],

    CONSTRAINT "DayType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayOverride" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayTypeId" TEXT NOT NULL,

    CONSTRAINT "HolidayOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffGroup" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TariffGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "type" "TariffType" NOT NULL,
    "name" TEXT NOT NULL,
    "isFullBalance" BOOLEAN NOT NULL DEFAULT false,
    "packageMode" "PackageMode",
    "packageDurationMin" INTEGER,
    "packageFixedEndMin" INTEGER,
    "subscriptionDurationMin" INTEGER,
    "subscriptionLifetimeHrs" INTEGER,
    "subscriptionPrice" DECIMAL(12,2),
    "allowOnlineBooking" BOOLEAN NOT NULL DEFAULT true,
    "mobileOnly" BOOLEAN NOT NULL DEFAULT false,
    "ignoreLoyaltyDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "allowCreditLine" BOOLEAN NOT NULL DEFAULT false,
    "bonusEarnPercent" INTEGER NOT NULL DEFAULT 0,
    "bonusSpendMaxPercent" INTEGER NOT NULL DEFAULT 0,
    "refundUnusedTime" BOOLEAN NOT NULL DEFAULT false,
    "minChargedMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSubscription" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "remainingMinutes" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffRule" (
    "id" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "dayTypeId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "pricePerMinute" DECIMAL(10,2) NOT NULL,
    "displayStartMinute" INTEGER,
    "displayEndMinute" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TariffRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "birthDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manualGroupId" TEXT,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "paidMinutes" INTEGER NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "bookingId" TEXT,
    "tariffId" TEXT,
    "source" "SessionSource" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExtension" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "minutesAdded" INTEGER NOT NULL,
    "previousEnd" TIMESTAMP(3) NOT NULL,
    "newEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedger" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "kind" "BalanceKind" NOT NULL,
    "amountDelta" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "source" "BalanceSource" NOT NULL,
    "referenceType" "BalanceReferenceType" NOT NULL DEFAULT 'NONE',
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualBalanceLog" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "staffId" TEXT,
    "sourceChannel" "ManualLogChannel" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualBalanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltySettings" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "sumDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "recalcPeriod" "RecalcPeriod" NOT NULL DEFAULT 'M3',
    "birthdayBonusEnabled" BOOLEAN NOT NULL DEFAULT false,
    "birthdayBonusAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "LoyaltySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minHours" INTEGER NOT NULL,
    "maxHours" INTEGER,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "cashbackPercent" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoyaltyTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestManualGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "cashbackPercent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuestManualGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestLoyaltyState" (
    "guestId" TEXT NOT NULL,
    "currentTierId" TEXT,
    "playedMinutesInPeriod" INTEGER NOT NULL DEFAULT 0,
    "periodStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRecalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBirthdayBonusYear" INTEGER,

    CONSTRAINT "GuestLoyaltyState_pkey" PRIMARY KEY ("guestId")
);

-- CreateTable
CREATE TABLE "AutoBonusRule" (
    "id" TEXT NOT NULL,
    "clubId" TEXT,
    "trigger" "AutoBonusTrigger" NOT NULL,
    "minAmount" DECIMAL(12,2),
    "maxAmount" DECIMAL(12,2),
    "rewardType" "RewardType" NOT NULL,
    "rewardValue" DECIMAL(12,2) NOT NULL,
    "sourceChannel" "SourceChannel",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoBonusRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByStaffId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionComment" TEXT,
    "ledgerEntryId" TEXT,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "provider" "PaymentProviderType" NOT NULL DEFAULT 'STUB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "ledgerEntryId" TEXT,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalReceipt" (
    "id" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "provider" "FiscalProviderType" NOT NULL DEFAULT 'STUB',
    "status" "FiscalStatus" NOT NULL DEFAULT 'PENDING',
    "fiscalDocNumber" TEXT,
    "fiscalUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "FiscalReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Zone_clubId_idx" ON "Zone"("clubId");

-- CreateIndex
CREATE INDEX "Device_zoneId_idx" ON "Device"("zoneId");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Device_clubId_cardNumber_key" ON "Device"("clubId", "cardNumber");

-- CreateIndex
CREATE INDEX "DayType_clubId_idx" ON "DayType"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayOverride_clubId_date_key" ON "HolidayOverride"("clubId", "date");

-- CreateIndex
CREATE INDEX "TariffGroup_clubId_idx" ON "TariffGroup"("clubId");

-- CreateIndex
CREATE INDEX "Tariff_groupId_idx" ON "Tariff"("groupId");

-- CreateIndex
CREATE INDEX "GuestSubscription_guestId_idx" ON "GuestSubscription"("guestId");

-- CreateIndex
CREATE INDEX "TariffRule_tariffId_idx" ON "TariffRule"("tariffId");

-- CreateIndex
CREATE INDEX "TariffRule_zoneId_dayTypeId_idx" ON "TariffRule"("zoneId", "dayTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_phone_key" ON "Guest"("phone");

-- CreateIndex
CREATE INDEX "Guest_phone_idx" ON "Guest"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");

-- CreateIndex
CREATE INDEX "Booking_deviceId_startAt_idx" ON "Booking"("deviceId", "startAt");

-- CreateIndex
CREATE INDEX "Booking_guestId_idx" ON "Booking"("guestId");

-- CreateIndex
CREATE INDEX "Booking_code_idx" ON "Booking"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_bookingId_key" ON "Session"("bookingId");

-- CreateIndex
CREATE INDEX "Session_deviceId_status_idx" ON "Session"("deviceId", "status");

-- CreateIndex
CREATE INDEX "Session_guestId_idx" ON "Session"("guestId");

-- CreateIndex
CREATE INDEX "SessionExtension_sessionId_idx" ON "SessionExtension"("sessionId");

-- CreateIndex
CREATE INDEX "BalanceLedger_guestId_kind_idx" ON "BalanceLedger"("guestId", "kind");

-- CreateIndex
CREATE INDEX "BalanceLedger_referenceType_referenceId_idx" ON "BalanceLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualBalanceLog_ledgerEntryId_key" ON "ManualBalanceLog"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "ManualBalanceLog_guestId_idx" ON "ManualBalanceLog"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltySettings_clubId_key" ON "LoyaltySettings"("clubId");

-- CreateIndex
CREATE INDEX "LoyaltyTier_minHours_maxHours_idx" ON "LoyaltyTier"("minHours", "maxHours");

-- CreateIndex
CREATE INDEX "AutoBonusRule_trigger_active_idx" ON "AutoBonusRule"("trigger", "active");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRequest_ledgerEntryId_key" ON "RefundRequest"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "RefundRequest_guestId_status_idx" ON "RefundRequest"("guestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_ledgerEntryId_key" ON "PaymentTransaction"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_guestId_status_idx" ON "PaymentTransaction"("guestId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalReceipt_paymentTransactionId_key" ON "FiscalReceipt"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "FiscalReceipt_status_idx" ON "FiscalReceipt"("status");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayType" ADD CONSTRAINT "DayType_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayOverride" ADD CONSTRAINT "HolidayOverride_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayOverride" ADD CONSTRAINT "HolidayOverride_dayTypeId_fkey" FOREIGN KEY ("dayTypeId") REFERENCES "DayType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffGroup" ADD CONSTRAINT "TariffGroup_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TariffGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSubscription" ADD CONSTRAINT "GuestSubscription_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSubscription" ADD CONSTRAINT "GuestSubscription_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_dayTypeId_fkey" FOREIGN KEY ("dayTypeId") REFERENCES "DayType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffRule" ADD CONSTRAINT "TariffRule_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_manualGroupId_fkey" FOREIGN KEY ("manualGroupId") REFERENCES "GuestManualGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "Tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExtension" ADD CONSTRAINT "SessionExtension_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBalanceLog" ADD CONSTRAINT "ManualBalanceLog_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBalanceLog" ADD CONSTRAINT "ManualBalanceLog_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "BalanceLedger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestLoyaltyState" ADD CONSTRAINT "GuestLoyaltyState_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestLoyaltyState" ADD CONSTRAINT "GuestLoyaltyState_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "LoyaltyTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoBonusRule" ADD CONSTRAINT "AutoBonusRule_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalReceipt" ADD CONSTRAINT "FiscalReceipt_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
