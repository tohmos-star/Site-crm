import { Type, type Static } from "@sinclair/typebox";

export const LoginBody = Type.Object({
  phone: Type.String({ minLength: 5 }),
  password: Type.String({ minLength: 1 }),
});
export type LoginBody = Static<typeof LoginBody>;

export const AdminLoginBody = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 1 }),
});
export type AdminLoginBody = Static<typeof AdminLoginBody>;

// Как в frontend/admin/app.js: статус — уже переведённая на бэкенд строка
// ('approved'/'rejected'), rejectReason — один из REJECT_REASONS ключей.
export const ReviewRegistrationBody = Type.Object({
  status: Type.Union([Type.Literal("approved"), Type.Literal("rejected")]),
  rejectReason: Type.Optional(Type.String()),
});
export type ReviewRegistrationBody = Static<typeof ReviewRegistrationBody>;

export const RegistrationsQuery = Type.Object({
  status: Type.Optional(Type.String()),
});
export type RegistrationsQuery = Static<typeof RegistrationsQuery>;

export const AccessCredentialBody = Type.Object({
  intercomUrl: Type.String(),
  doorCodeMain: Type.String(),
  doorCodeSecond: Type.Optional(Type.String()),
});
export type AccessCredentialBody = Static<typeof AccessCredentialBody>;
