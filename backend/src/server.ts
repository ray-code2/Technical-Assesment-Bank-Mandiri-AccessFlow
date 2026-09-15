import { createApp } from "./app.js";
import { config } from "./config.js";
import { rawPool } from "./database/db.js";

const server = createApp().listen(config.PORT, () => {
  console.log(`AccessFlow API listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await rawPool.end();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

