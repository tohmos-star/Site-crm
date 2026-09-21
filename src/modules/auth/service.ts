import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { DomainError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { BalanceService } from "../balance/service.js";

export interface RegisterInput {
  phone: string;
  password: string;
  fullName: string;
  docPhotoPath: string;
  selfiePhotoPath: string;
}

// Отдельный класс (не просто DomainError) — routes.ts должен различать
// pending/rejected и отвечать телом {status: 'pending'|'rejected'}, как
// ждёт frontend/login.html, а не общим {code, message} остальных ошибок.
export class LoginStatusError extends Error {
  constructor(public readonly loginStatus: "pending" | "rejected") {
    super(`Login blocked: registration is ${loginStatus}`);
  }
}

export class AuthService {
  private readonly balance: BalanceService;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly fastify: FastifyInstance,
  ) {
    this.balance = new BalanceService(prisma);
  }

  async register(input: RegisterInput) {
    if (!/^\+7\d{10}$/.test(input.phone)) {
      throw new DomainError("VALIDATION_ERROR", "Неверный формат телефона (+79991234567)", 400);
    }
    if (input.password.length < 6) {
      throw new DomainError("VALIDATION_ERROR", "Пароль слишком короткий (минимум 6 символов)", 400);
    }
    if (input.fullName.trim().split(/\s+/).length < 2) {
      throw new DomainError("VALIDATION_ERROR", "Укажите ФИО полностью", 400);
    }

    const existing = await this.prisma.guest.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new DomainError("PHONE_TAKEN", "Этот номер телефона уже зарегистрирован", 409);
    }

    const passwordHash = await hashPassword(input.password);
    return this.prisma.guest.create({
      data: {
        phone: input.phone,
        fullName: input.fullName.trim(),
        passwordHash,
        docPhotoPath: input.docPhotoPath,
        selfiePhotoPath: input.selfiePhotoPath,
        regStatus: "PENDING",
      },
    });
  }

  async login(phone: string, password: string) {
    const guest = await this.prisma.guest.findUnique({ where: { phone } });
    if (!guest?.passwordHash || !(await verifyPassword(password, guest.passwordHash))) {
      throw new UnauthorizedError("Неверный телефон или пароль");
    }
    if (guest.regStatus === "PENDING") throw new LoginStatusError("pending");
    if (guest.regStatus === "REJECTED") throw new LoginStatusError("rejected");

    const token = this.fastify.jwt.sign({ sub: guest.id, role: "guest" as const }, { expiresIn: "30d" });
    return { token, guest };
  }

  async adminLogin(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new UnauthorizedError("Неверный email или пароль");
    }
    const token = this.fastify.jwt.sign({ sub: admin.id, role: "admin" as const }, { expiresIn: "12h" });
    return { token, admin };
  }

  async guestBalanceRub(guestId: string): Promise<number> {
    const money = await this.balance.getBalance(guestId, "MONEY");
    return Number(money);
  }

  async guestBonusPoints(guestId: string): Promise<number> {
    const bonus = await this.balance.getBalance(guestId, "BONUS");
    return Number(bonus);
  }

  listRegistrations(status: "PENDING" | "APPROVED" | "REJECTED") {
    return this.prisma.guest.findMany({
      where: { regStatus: status, passwordHash: { not: null } },
      orderBy: { createdAt: "asc" },
    });
  }

  // rejectReason (ключ из REJECT_REASONS на стороне админки) не хранится
  // отдельным полем в v1 — только сам факт отказа. Follow-up: завести поле,
  // если понадобится аудит причины.
  async reviewRegistration(guestId: string, decision: "approved" | "rejected") {
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) throw new NotFoundError("Guest", guestId);
    if (guest.regStatus !== "PENDING") {
      throw new DomainError("ALREADY_REVIEWED", `Guest ${guestId} is already ${guest.regStatus}`, 409);
    }
    return this.prisma.guest.update({
      where: { id: guestId },
      data: { regStatus: decision === "approved" ? "APPROVED" : "REJECTED" },
    });
  }

  // "Клуб" в этой системе один — все ссылки на клуб берут первую (и
  // единственную после seed) запись. Мульти-клубность — follow-up.
  async getSingleClub() {
    const club = await this.prisma.club.findFirst();
    if (!club) throw new DomainError("NO_CLUB", "No club configured — run the seed script", 500);
    return club;
  }
}
