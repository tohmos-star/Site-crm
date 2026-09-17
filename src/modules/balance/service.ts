import type {
  BalanceKind,
  BalanceReferenceType,
  BalanceSource,
  ManualLogChannel,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { InsufficientBalanceError } from "../../lib/errors.js";

type Tx = Prisma.TransactionClient;

export interface ApplyDeltaInput {
  guestId: string;
  kind: BalanceKind;
  delta: Decimal | number | string;
  source: BalanceSource;
  referenceType?: BalanceReferenceType;
  referenceId?: string;
  allowNegative?: boolean;
}

// Баланс всегда меняется дельтой (никогда абсолютным значением) — единственный
// источник истины — сумма записей BalanceLedger. Текущий баланс кэшируется на
// каждой записи как balanceAfter, чтобы не пересчитывать сумму по всей истории.
//
// Известное ограничение v1: applyDelta читает последнюю запись и вставляет
// новую в одной транзакции Prisma (read-committed) без явного row-lock —
// при очень высокой конкурентности по одному guestId возможна гонка. Для
// продакшена стоит завести SELECT ... FOR UPDATE или сериализуемую транзакцию.
export class BalanceService {
  constructor(private readonly prisma: PrismaClient) {}

  async getBalance(guestId: string, kind: BalanceKind, client: PrismaClient | Tx = this.prisma) {
    const last = await client.balanceLedger.findFirst({
      where: { guestId, kind },
      orderBy: { createdAt: "desc" },
    });
    return last?.balanceAfter ?? new Decimal(0);
  }

  async applyDelta(client: PrismaClient | Tx, input: ApplyDeltaInput) {
    const delta = new Decimal(input.delta);
    const current = await this.getBalance(input.guestId, input.kind, client);
    const balanceAfter = current.add(delta);

    if (!input.allowNegative && balanceAfter.isNegative()) {
      throw new InsufficientBalanceError(
        `Guest ${input.guestId} ${input.kind} balance would go negative (${balanceAfter.toString()})`,
      );
    }

    return client.balanceLedger.create({
      data: {
        guestId: input.guestId,
        kind: input.kind,
        amountDelta: delta,
        balanceAfter,
        source: input.source,
        referenceType: input.referenceType ?? "NONE",
        referenceId: input.referenceId,
      },
    });
  }

  // Ручная корректировка баланса (касса администратора/бонусная касса/страница
  // баланса гостя/API) — всегда пишет в ManualBalanceLog для аудита.
  async manualAdjust(params: {
    guestId: string;
    kind: BalanceKind;
    delta: Decimal | number | string;
    sourceChannel: ManualLogChannel;
    staffId?: string;
    comment?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await this.applyDelta(tx, {
        guestId: params.guestId,
        kind: params.kind,
        delta: params.delta,
        source: "MANUAL_ADJUST",
        allowNegative: true, // возврат/компенсация может обнулять и уходить в минус по решению сотрудника
      });

      const manualLog = await tx.manualBalanceLog.create({
        data: {
          guestId: params.guestId,
          ledgerEntryId: ledgerEntry.id,
          staffId: params.staffId,
          sourceChannel: params.sourceChannel,
          comment: params.comment,
        },
      });

      return { ledgerEntry, manualLog };
    });
  }

  history(guestId: string, kind?: BalanceKind) {
    return this.prisma.balanceLedger.findMany({
      where: { guestId, kind },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
