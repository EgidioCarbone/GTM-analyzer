import express from "express";
import cors from "cors";
import gtmRouter from "./gtm";
import { config } from "./config";

const app = express();

app.use(express.json());

// CORS: apri a tutti in dev o limita con env CORS_ORIGINS
if (config.corsOrigins.length > 0) {
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
} else {
  app.use(cors()); // dev permissivo
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/gtm", gtmRouter);

// error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("API error:", err?.message || err);
  res.status(500).json({
    error: true,
    message: err?.message || "Internal Server Error",
  });
});

app.listen(config.port, () => {
  console.log(`GTM API server running on http://localhost:${config.port}`);
});
