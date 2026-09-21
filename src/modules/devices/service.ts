import { randomBytes } from "node:crypto";
import type { DeviceStatus, PrismaClient } from "@prisma/client";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import type { WakeOnLanPort } from "./wol.js";
import type { DeviceBody } from "./schemas.js";

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

  // agentToken — секрет станции, предъявитель (см. authenticateDevice) —
  // никогда не должен уходить в обычных списках/карточках устройства,
  // только через отдельную ручку issueAgentToken (один раз, сразу после
  // выпуска).
  private stripToken<T extends { agentToken: string | null }>(device: T) {
    const { agentToken, ...rest } = device;
    return { ...rest, hasAgentToken: agentToken !== null };
  }

  async list(filter: { clubId?: string; zoneId?: string; status?: DeviceStatus }) {
    const devices = await this.prisma.device.findMany({
      where: filter,
      orderBy: { cardNumber: "asc" },
    });
    return devices.map((d) => this.stripToken(d));
  }

  async get(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundError("Device", id);
    return this.stripToken(device);
  }

  async create(body: DeviceBody) {
    const device = await this.prisma.device.create({ data: body });
    return this.stripToken(device);
  }

  async update(id: string, body: Partial<DeviceBody>) {
    await this.getRaw(id);
    const device = await this.prisma.device.update({ where: { id }, data: body });
    return this.stripToken(device);
  }

  private async getRaw(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundError("Device", id);
    return device;
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

    const updated = await this.prisma.device.update({ where: { id }, data: { status } });
    return this.stripToken(updated);
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

  // Разовая выдача токена ПК-станции при настройке (см. authenticateDevice
  // в src/plugins/auth.ts) — показывается админу один раз, дальше только
  // перевыпуск (старый токен инвалидируется).
  async issueAgentToken(id: string) {
    await this.get(id);
    const token = randomBytes(24).toString("base64url");
    await this.prisma.device.update({ where: { id }, data: { agentToken: token } });
    return { agentToken: token };
  }

  async revokeAgentToken(id: string) {
    await this.get(id);
    await this.prisma.device.update({ where: { id }, data: { agentToken: null } });
  }
}
