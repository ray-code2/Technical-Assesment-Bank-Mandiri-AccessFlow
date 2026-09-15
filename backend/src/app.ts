import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { database, type Database } from "./database/db.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";
import { accessTypesRouter } from "./routes/access-types.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { requestsRouter } from "./routes/requests.js";

export function createApp(db: Database = database) {
  const app = express();
  const allowedOrigins = config.CORS_ORIGIN.split(",").map((origin) => origin.trim());

  app.disable("x-powered-by");
  // The production container has exactly one trusted reverse proxy: nginx.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: false }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.use("/api/auth", authRouter(db));
  app.use("/api/access-types", accessTypesRouter(db));
  app.use("/api/requests", requestsRouter(db));
  app.use("/api/dashboard", dashboardRouter(db));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
