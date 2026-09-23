import type { PrismaClient } from "@prisma/client";
import { DomainError, NotFoundError } from "../../lib/errors.js";
import type { ZoneBody } from "./schemas.js";

export class ZoneService {
  constructor(private readonly prisma: PrismaClient) {}

  list(clubId?: string) {
    return this.prisma.zone.findMany({
      where: clubId ? { clubId } : undefined,
      orderBy: { sortOrder: "asc" },
    });
  }

  async get(id: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundError("Zone", id);
    return zone;
  }

  create(body: ZoneBody) {
    return this.prisma.zone.create({ data: body });
  }

  async update(id: string, body: Partial<ZoneBody>) {
    await this.get(id);
    return this.prisma.zone.update({ where: { id }, data: body });
  }

  async delete(id: string) {
    await this.get(id);

    const [deviceCount, ruleCount] = await Promise.all([
      this.prisma.device.count({ where: { zoneId: id } }),
      this.prisma.tariffRule.count({ where: { zoneId: id } }),
    ]);
    // Без этой проверки prisma.zone.delete() падает необработанной
    // FK-ошибкой (P2003) — фронт получал 500 и молча ничего не делал,
    // так что зона "не удалялась" без всякого объяснения админу.
    if (deviceCount > 0 || ruleCount > 0) {
      throw new DomainError(
        "ZONE_HAS_DEPENDENCIES",
        `Нельзя удалить зону: в ней ${deviceCount} устройств(а) и ${ruleCount} правил(а) цен — сначала перенесите/удалите их`,
        409,
      );
    }

    await this.prisma.zone.delete({ where: { id } });
  }
}
