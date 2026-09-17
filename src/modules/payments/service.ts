import type { PrismaClient, SourceChannel } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import { LoyaltyService } from "../loyalty/service.js";
import { StubFiscalProvider, type FiscalProviderPort } from "../fiscal/provider.js";
import { StubPaymentProvider, type PaymentProviderPort } from "./provider.js";
import type { TopUpBody } from "./schemas.js";

// Приём платежей → фискальный чек → зачисление на баланс — единая атомарная
// цепочка (юридическое требование 54-ФЗ + бухгалтерская целостность): если
// чек не пробился, зачисление не должно "потеряться", и наоборот. Оба
// провайдера (эквайринг, ОФД) — заглушки; см. src/modules/payments/provider.ts
// и src/modules/fiscal/provider.ts для точки расширения на Т-Банк.
export class PaymentService {
  private readonly balance: BalanceService;
  private readonly loyalty: LoyaltyService;
  private readonly paymentProvider: PaymentProviderPort = new StubPaymentProvider();
  private readonly fiscalProvider: FiscalProviderPort = new StubFiscalProvider();

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
    this.loyalty = new LoyaltyService(prisma);
  }

  async get(id: string) {
    const tx = await this.prisma.paymentTransaction.findUnique({
      where: { id },
      include: { fiscalReceipt: true },
    });
    if (!tx) throw new NotFoundError("PaymentTransaction", id);
    return tx;
  }

  list(guestId?: string) {
    return this.prisma.paymentTransaction.findMany({
      where: guestId ? { guestId } : undefined,
      include: { fiscalReceipt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async topUp(body: TopUpBody) {
    const amount = new Decimal(body.amount);

    const charge = await this.paymentProvider.charge({ guestId: body.guestId, amount: amount.toString() });
    if (!charge.succeeded) {
      throw new DomainError("PAYMENT_FAILED", "Payment provider declined the charge", 402);
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentTransaction.create({
        data: {
          guestId: body.guestId,
          amount,
          provider: "STUB",
          status: "SUCCEEDED",
          externalId: charge.externalId,
          completedAt: new Date(),
        },
      });

      const ledgerEntry = await this.balance.applyDelta(tx, {
        guestId: body.guestId,
        kind: "MONEY",
        delta: amount,
        source: "TOPUP",
        referenceType: "PAYMENT",
        referenceId: payment.id,
      });

      await tx.paymentTransaction.update({
        where: { id: payment.id },
        data: { ledgerEntryId: ledgerEntry.id },
      });

      const receipt = await this.fiscalProvider.issueReceipt({
        paymentTransactionId: payment.id,
        amount: amount.toString(),
      });
      await tx.fiscalReceipt.create({
        data: {
          paymentTransactionId: payment.id,
          provider: "STUB",
          status: "ISSUED",
          fiscalDocNumber: receipt.fiscalDocNumber,
          fiscalUrl: receipt.fiscalUrl,
          issuedAt: new Date(),
        },
      });

      await this.loyalty.applyAutoBonus(tx, {
        guestId: body.guestId,
        trigger: "TOPUP",
        clubId: body.clubId,
        amount,
        sourceChannel: body.sourceChannel as SourceChannel | undefined,
      });

      return tx.paymentTransaction.findUniqueOrThrow({
        where: { id: payment.id },
        include: { fiscalReceipt: true },
      });
    });
  }
}
