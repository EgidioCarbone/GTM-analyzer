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

    // Genera uno slug temporaneo per la dashboard pubblica
    const slug = Math.random().toString(36).slice(2, 8);

    // Usa l'URL base da variabile d'ambiente o fallback a localhost
    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    const url = `${baseUrl}/share/${slug}`;

    // Qui puoi salvare in DB se necessario
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

// 👇 esportazione default per poter fare:
// import studioShareRouter from "./src/services/studio-share.server";
export default studioShareRouter;
