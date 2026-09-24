-- CreateTable
CREATE TABLE "_TariffLoyaltyTierAccess" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TariffLoyaltyTierAccess_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TariffLoyaltyTierAccess_B_index" ON "_TariffLoyaltyTierAccess"("B");

-- AddForeignKey
ALTER TABLE "_TariffLoyaltyTierAccess" ADD CONSTRAINT "_TariffLoyaltyTierAccess_A_fkey" FOREIGN KEY ("A") REFERENCES "LoyaltyTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TariffLoyaltyTierAccess" ADD CONSTRAINT "_TariffLoyaltyTierAccess_B_fkey" FOREIGN KEY ("B") REFERENCES "Tariff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
