import { Type, type Static } from "@sinclair/typebox";

// Минимальная модель гостя для биллинга. Визард регистрации, вход по
// телефону+паролю и полный CRUD анкеты — отдельный модуль (вне этой задачи).
export const GuestBody = Type.Object({
  phone: Type.String({ minLength: 5 }),
  fullName: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: "email" })),
  birthDate: Type.Optional(Type.String({ format: "date" })),
});
export type GuestBody = Static<typeof GuestBody>;

export const IdParams = Type.Object({ id: Type.String() });
export type IdParams = Static<typeof IdParams>;
