import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../lib/errors.js";
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
    await this.prisma.zone.delete({ where: { id } });
  }
}
