import type { PrismaClient } from "@prisma/client";
import { NotFoundError } from "../../lib/errors.js";
import type { GuestBody } from "./schemas.js";

export class GuestService {
  constructor(private readonly prisma: PrismaClient) {}

  list(search?: string) {
    return this.prisma.guest.findMany({
      where: search ? { phone: { contains: search } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async get(id: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id } });
    if (!guest) throw new NotFoundError("Guest", id);
    return guest;
  }

  create(body: GuestBody) {
    return this.prisma.guest.create({
      data: {
        ...body,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      },
    });
  }

  async update(id: string, body: Partial<GuestBody>) {
    await this.get(id);
    return this.prisma.guest.update({
      where: { id },
      data: {
        ...body,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      },
    });
  }
}
