import type { PrismaClient } from "@prisma/client";

// Каждому гостю при создании назначается один код из общего пула клуба
// (Club.doorCodeMain, до 10 кодов — задаются в админке, вкладка "Домофон и
// коды") — случайно и один раз, дальше не меняется. Если пул пуст (админ ещё
// не завёл ни одного кода), гость остаётся без кода; entry-access сам
// доназначит его при первом запросе, когда код(ы) появятся (см.
// src/modules/auth/routes.ts GET /entry-access).
export async function assignRandomDoorCode(prisma: PrismaClient): Promise<string | null> {
  const club = await prisma.club.findFirst();
  const codes = club?.doorCodeMain ?? [];
  if (!codes.length) return null;
  return codes[Math.floor(Math.random() * codes.length)] ?? null;
}
