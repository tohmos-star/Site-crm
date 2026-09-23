import { randomInt } from "node:crypto";
import { Prisma, type DeviceStatus, type PrismaClient } from "@prisma/client";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import type { WakeOnLanPort } from "./wol.js";
import type { DeviceBody } from "./schemas.js";

// Токен станции вводит вручную владелец/сисадмин клуба при установке
// виджета на ПК — значит он должен быть коротким и без символов, которые
// легко перепутать на глаз (0/O, 1/I/L исключены). 8 символов из 31-буквенного
// алфавита — это ~8.5×10^11 комбинаций, вводится за несколько секунд и
// достаточно устойчив к подбору (плюс токен можно перевыпустить в любой
// момент, если он скомпрометирован).
const STATION_TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const STATION_TOKEN_LENGTH = 8;

// Разрешённые переходы статуса ПК (панель управления устройствами LANGAME
// как референс для набора статусов; логика решений — здесь, HA — исполнитель).
const ALLOWED_TRANSITIONS: Record<DeviceStatus, DeviceStatus[]> = {
  FREE: ["BUSY", "CONNECTING", "TECH_MODE", "LOCKED", "DISABLED"],
  BUSY: ["FREE", "LOCKED", "DISABLED"],
  CONNECTING: ["FREE", "BUSY", "DISABLED"],
  TECH_MODE: ["FREE", "DISABLED"],
  LOCKED: ["FREE", "TECH_MODE", "DISABLED"],
  DISABLED: ["FREE", "TECH_MODE"],
};

export class DeviceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly wol: WakeOnLanPort,
  ) {}

  async list(filter: { clubId?: string; zoneId?: string; status?: DeviceStatus }) {
    return this.prisma.device.findMany({
      where: filter,
      orderBy: { cardNumber: "asc" },
    });
  }

  async get(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundError("Device", id);
    return device;
  }

  async create(body: DeviceBody) {
    const cardNumber = body.cardNumber ?? (await this.nextCardNumber(body.clubId));
    return this.prisma.device.create({ data: { ...body, cardNumber } });
  }

  // Номер карточки больше не вводится вручную в форме — берём следующий
  // свободный в рамках клуба (уникальность — @@unique([clubId, cardNumber])).
  private async nextCardNumber(clubId: string) {
    const result = await this.prisma.device.aggregate({
      where: { clubId },
      _max: { cardNumber: true },
    });
    return (result._max.cardNumber ?? 0) + 1;
  }

  async update(id: string, body: Partial<DeviceBody>) {
    await this.get(id);
    return this.prisma.device.update({ where: { id }, data: body });
  }

  async delete(id: string) {
    await this.get(id);
    await this.prisma.device.delete({ where: { id } });
  }

  async setStatus(id: string, status: DeviceStatus) {
    const device = await this.get(id);
    if (device.status === status) return device;

    const allowed = ALLOWED_TRANSITIONS[device.status];
    if (!allowed.includes(status)) {
      throw new DomainError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition device from ${device.status} to ${status}`,
        409,
      );
    }

    return this.prisma.device.update({ where: { id }, data: { status } });
  }

  async bulkSetStatus(deviceIds: string[], status: DeviceStatus) {
    const results = await Promise.allSettled(
      deviceIds.map((id) => this.setStatus(id, status)),
    );
    return deviceIds.map((id, i) => {
      const result = results[i];
      return result?.status === "fulfilled"
        ? { id, ok: true as const }
        : { id, ok: false as const, error: (result?.reason as Error)?.message };
    });
  }

  async wakeUp(id: string) {
    const device = await this.get(id);
    if (!device.mac) {
      throw new DomainError("NO_MAC", `Device ${id} has no MAC address configured`, 422);
    }
    await this.wol.wake(device.mac);
  }

  // Выдача токена ПК-станции при настройке (см. authenticateDevice в
  // src/plugins/auth.ts) — виден админу постоянно в списке устройств
  // (agentToken больше не вырезается из ответов), перевыпуск инвалидирует
  // старый.
  async issueAgentToken(id: string) {
    await this.get(id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = this.generateStationToken();
      try {
        await this.prisma.device.update({ where: { id }, data: { agentToken: token } });
        return { agentToken: token };
      } catch (err) {
        // P2002 — редчайшее совпадение с уже выданным токеном другой
        // станции (agentToken @unique глобально) — просто пробуем ещё раз.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }
    throw new DomainError(
      "TOKEN_GENERATION_FAILED",
      "Не удалось сгенерировать уникальный токен станции, попробуйте ещё раз",
      500,
    );
  }

  private generateStationToken(): string {
    let token = "";
    for (let i = 0; i < STATION_TOKEN_LENGTH; i++) {
      token += STATION_TOKEN_ALPHABET[randomInt(STATION_TOKEN_ALPHABET.length)];
    }
    return token;
  }

  async revokeAgentToken(id: string) {
    await this.get(id);
    await this.prisma.device.update({ where: { id }, data: { agentToken: null } });
  }
}
