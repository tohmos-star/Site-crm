// Сид реальных данных клуба — те же зоны/цены, что использовались во всех
// моках этой сессии (Android MockGuestRepository, ранние демо-страницы):
// DUO 1/DUO 2 (по 2 места), SOLO, SOLO+ — 250 ₽/ч, SOLO+ — 275 ₽/ч.
// Идемпотентно: если Club с этим именем уже есть — ничего не делает.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.club.findFirst({ where: { name: "404 Киберхаус" } });
  if (existing) {
    console.log("Seed skipped — club already exists:", existing.id);
    return;
  }

  const club = await prisma.club.create({
    data: {
      name: "404 Киберхаус",
      address: "Самара, Чапаевская, 178",
    },
  });

  // Один тип дня на все 7 дней недели — цены в этой сессии никогда не
  // различались по будним/выходным, разносить на Будни/Выходные можно
  // позже через админку (Тарифы), сетка это уже поддерживает.
  const dayType = await prisma.dayType.create({
    data: { clubId: club.id, name: "Все дни", weekdays: [0, 1, 2, 3, 4, 5, 6] },
  });

  const zoneSpecs = [
    { key: "duo-1", nameRu: "DUO 1", isRoom: true, pricePerHour: 250, seats: 2 },
    { key: "duo-2", nameRu: "DUO 2", isRoom: true, pricePerHour: 250, seats: 2 },
    { key: "solo-1", nameRu: "SOLO", isRoom: false, pricePerHour: 250, seats: 1 },
    { key: "solo-plus", nameRu: "SOLO+", isRoom: false, pricePerHour: 275, seats: 1 },
  ];

  const tariffGroup = await prisma.tariffGroup.create({
    data: { clubId: club.id, name: "Стандартные тарифы" },
  });

  // Одна BASE-тариф-запись, цена варьируется по зоне через TariffRule ниже —
  // не нужно заводить 4 отдельных Tariff ради разных ₽/ч.
  const tariff = await prisma.tariff.create({
    data: {
      groupId: tariffGroup.id,
      type: "BASE",
      name: "Почасовой",
      allowOnlineBooking: true,
    },
  });

  let cardNumber = 1;
  for (const spec of zoneSpecs) {
    const zone = await prisma.zone.create({
      data: {
        clubId: club.id,
        nameRu: spec.nameRu,
        isRoom: spec.isRoom,
        defaultTariffId: tariff.id,
      },
    });

    await prisma.tariffRule.create({
      data: {
        tariffId: tariff.id,
        dayTypeId: dayType.id,
        zoneId: zone.id,
        startMinute: 0,
        endMinute: 1440,
        pricePerMinute: (spec.pricePerHour / 60).toFixed(4),
      },
    });

    for (let seat = 1; seat <= spec.seats; seat++) {
      await prisma.device.create({
        data: {
          clubId: club.id,
          zoneId: zone.id,
          name: spec.seats > 1 ? `${spec.nameRu} · место ${seat}` : spec.nameRu,
          cardNumber: cardNumber++,
        },
      });
    }
  }

  const adminEmail = "admin@404kh.local";
  const adminPassword = "change-me-404";
  await prisma.adminUser.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      fullName: "Администратор",
    },
  });

  console.log("Seed complete.");
  console.log("Club:", club.id);
  console.log(`Admin login: ${adminEmail} / ${adminPassword} (смените после первого входа)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
