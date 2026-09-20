import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";

// Локальное хранилище загруженных файлов (фото документа/селфи при
// регистрации, фото места при завершении сессии) — STUB, как остальные
// провайдеры в этом бэкенде (payments/fiscal). Реальный объектный сторедж
// (S3-совместимый) — отдельный follow-up, здесь важен сам факт, что файл
// нигде не теряется и путь к нему хранится в БД.
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {}

export async function saveUploadedImage(file: MultipartFile, subdir: string): Promise<string> {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new UploadError(`Unsupported file type: ${file.mimetype}`);
  }
  const buffer = await file.toBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new UploadError(`File too large: ${buffer.byteLength} bytes`);
  }

  const ext = file.mimetype === "image/png" ? "png" : file.mimetype === "image/webp" ? "webp" : "jpg";
  const dir = path.join(UPLOADS_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), buffer);

  // Относительный путь — то, что хранится в БД и отдаётся через
  // @fastify/static (см. src/app.ts, /uploads/* смонтирован на этот же UPLOADS_ROOT).
  return path.posix.join(subdir, filename);
}

export { UPLOADS_ROOT };
