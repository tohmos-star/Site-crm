import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { DomainError, InsufficientBalanceError, NotFoundError } from "../../lib/errors.js";
import { BalanceService } from "../balance/service.js";
import type { CreateRefundBody, DecideRefundBody } from "./schemas.js";

// Возврат средств — юридическое обязательство (ст. 32 ЗоЗПП): клуб обязан
// вернуть гостю деньги с баланса по первому требованию. Workflow (не просто
// списание) даёт фиксацию основания для отчётности/проверок:
// PENDING -> APPROVED/REJECTED -> COMPLETED.
export class RefundService {
  private readonly balance: BalanceService;

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
  }

  async get(id: string) {
    const refund = await this.prisma.refundRequest.findUnique({ where: { id } });
    if (!refund) throw new NotFoundError("RefundRequest", id);
    return refund;
  }

  list(guestId?: string) {
    return this.prisma.refundRequest.findMany({
      where: guestId ? { guestId } : undefined,
      orderBy: { requestedAt: "desc" },
    });
  }

  async create(body: CreateRefundBody) {
    const balance = await this.balance.getBalance(body.guestId, "MONEY");
    if (new Decimal(body.amount).gt(balance)) {
      throw new InsufficientBalanceError(
        `Requested refund ${body.amount} exceeds current balance ${balance.toString()}`,
      );
    }
    return this.prisma.refundRequest.create({ data: body });
  }

  async decide(id: string, body: DecideRefundBody) {
    const refund = await this.get(id);
    if (refund.status !== "PENDING") {
      throw new DomainError("REFUND_ALREADY_DECIDED", `Refund ${id} is already ${refund.status}`, 409);
    }
    return this.prisma.refundRequest.update({
      where: { id },
      data: {
        status: body.approve ? "APPROVED" : "REJECTED",
        decidedByStaffId: body.staffId,
        decidedAt: new Date(),
        rejectionComment: body.approve ? undefined : body.rejectionComment,
      },
    });
  }

  async complete(id: string) {
    const refund = await this.get(id);
    if (refund.status !== "APPROVED") {
      throw new DomainError("REFUND_NOT_APPROVED", `Refund ${id} is not approved`, 409);
    }

    return this.prisma.$transaction(async (tx) => {
      const ledgerEntry = await this.balance.applyDelta(tx, {
        guestId: refund.guestId,
        kind: "MONEY",
        delta: refund.amount.neg(),
        source: "REFUND",
        referenceType: "REFUND",
        referenceId: refund.id,
      });

      const completed = await tx.refundRequest.update({
        where: { id },
        data: { status: "COMPLETED", ledgerEntryId: ledgerEntry.id },
      });

      return completed;
    });
  }
}
