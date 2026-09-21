// tsx watch (unlike the Prisma CLI) doesn't load .env on its own — load it
// here, as the very first import in server.ts, before any module reads
// process.env at its own top level (see src/config/env.ts). Missing file is
// fine — a real deployment injects env vars directly instead.
try {
  process.loadEnvFile();
} catch {
  // no .env file — ignore
}
