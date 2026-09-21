import type { Guest, PrismaClient } from "@prisma/client";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import { assignRandomDoorCode } from "../../lib/doorCode.js";
import { BalanceService } from "../balance/service.js";
import type { CreateGuestBody, UpdateGuestBody } from "./schemas.js";

// Façade поверх реального Guest/BalanceLedger — фигура ответа {id, phone,
// fio, bonusPoints, verification} подобрана под уже готовую вкладку
// "Гости" в frontend/admin/app.js (см. коммит), а не наоборот.
export class AdminGuestsService {
  private readonly balance: BalanceService;

  constructor(private readonly prisma: PrismaClient) {
    this.balance = new BalanceService(prisma);
  }

  async list(search?: string) {
    const guests = await this.prisma.guest.findMany({
      where: search ? { phone: { contains: search } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Promise.all(guests.map((g) => this.toFacade(g)));
  }

  async create(body: CreateGuestBody) {
    const doorCode = await assignRandomDoorCode(this.prisma);
    const guest = await this.prisma.guest.create({
      data: {
        phone: body.phone,
        fullName: body.fio,
        // Добавлен админом вручную (касса, у стойки) — сразу подтверждён,
        // без анкеты/фото/пароля. Войти по паролю такой гость не сможет,
        // пока не пройдёт обычную регистрацию сам.
        regStatus: "APPROVED",
        doorCode,
      },
    });
    return this.toFacade(guest);
  }

  async update(id: string, body: UpdateGuestBody) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundError("Guest", id);

    if (body.bonusPoints !== undefined) {
      const current = await this.balance.getBalance(id, "BONUS");
      const delta = body.bonusPoints - Number(current);
      if (delta !== 0) {
        await this.balance.manualAdjust({
          guestId: id,
          kind: "BONUS",
          delta,
          sourceChannel: "ADMIN_CONSOLE",
        });
      }
    }

    const updated = await this.prisma.guest.update({
      where: { id },
      data: {
        phone: body.phone,
        fullName: body.fio,
      },
    });
    return this.toFacade(updated);
  }

  // Для гостей, у которых нет кода (созданы до этой фичи, или пул кодов был
  // пуст на момент их создания) — админ может назначить код вручную, не
  // дожидаясь, пока гость сам откроет "Войти в клуб" (см. GET /entry-access,
  // где это же происходит лениво на стороне гостя).
  async assignDoorCode(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundError("Guest", id);
    const doorCode = await assignRandomDoorCode(this.prisma);
    if (!doorCode) {
      throw new DomainError("NO_DOOR_CODES", "В клубе ещё не задано ни одного кода двери (вкладка «Домофон и коды»)", 409);
    }
    const updated = await this.prisma.guest.update({ where: { id }, data: { doorCode } });
    return this.toFacade(updated);
  }

  async remove(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundError("Guest", id);

    const [bookingCount, sessionCount, ledgerCount] = await Promise.all([
      this.prisma.booking.count({ where: { guestId: id } }),
      this.prisma.session.count({ where: { guestId: id } }),
      this.prisma.balanceLedger.count({ where: { guestId: id } }),
    ]);
    // Намеренно не каскадим удаление на историю броней/сессий/баланса —
    // это финансовый аудит-след, его нельзя молча стирать вместе с гостем.
    // Гостя без истории (добавлен по ошибке, не приходил) удалить можно.
    if (bookingCount > 0 || sessionCount > 0 || ledgerCount > 0) {
      throw new DomainError(
        "GUEST_HAS_HISTORY",
        "Нельзя удалить гостя с историей броней/сессий/баланса — есть данные финансового учёта",
        409,
      );
    }

    await this.prisma.guest.delete({ where: { id } });
  }

  private async toFacade(guest: Guest) {
    const bonus = await this.balance.getBalance(guest.id, "BONUS");
    return {
      id: guest.id,
      phone: guest.phone,
      fio: guest.fullName,
      bonusPoints: Number(bonus),
      doorCode: guest.doorCode,
      verification:
        guest.regStatus === "PENDING" || guest.regStatus === "REJECTED" || guest.passwordHash
          ? { status: guest.regStatus.toLowerCase() }
          : null,
    };
  }
}
