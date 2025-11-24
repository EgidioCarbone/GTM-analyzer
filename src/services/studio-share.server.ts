// src/services/studio-share.server.ts
import { Router } from "express";

export const studioShareRouter = Router();

/**
 * Endpoint: POST /api/studio/share
 * Riceve: { title, description, propertyId, startDate, endDate, charts }
 * Ritorna: { url } con il link pubblico alla dashboard condivisa
 */
studioShareRouter.post("/api/studio/share", async (req, res) => {
  try {
    const { title, description, propertyId, startDate, endDate, charts } = req.body || {};

    const slug = Math.random().toString(36).slice(2, 8);
    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `${baseUrl}/share/${slug}`;

    console.log("[SHARE CREATED]", {
      title,
      description,
      propertyId,
      startDate,
      endDate,
      chartsCount: charts?.length ?? 0,
    });

    res.json({ url });
  } catch (err: any) {
    console.error("[SHARE ERROR]", err);
    res.status(500).json({ error: "Errore nella creazione del link di condivisione." });
  }
});

export default studioShareRouter;
