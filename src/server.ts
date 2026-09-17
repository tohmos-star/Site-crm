import closeWithGrace from "close-with-grace";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

closeWithGrace({ delay: 5000 }, async ({ err }) => {
  if (err) app.log.error(err);
  await app.close();
});

try {
  await app.listen({ port: env.port, host: env.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
