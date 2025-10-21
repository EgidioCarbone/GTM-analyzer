// src/services/studio-meta.server.ts
import express, { Request, Response } from "express";

/**
 * Router per la metainformazione del modulo "Dashboard Studio"
 * - /api/studio/health   -> health check semplice
 * - /api/studio/sources  -> elenco sorgenti e stato di abilitazione
 */
const router = express.Router();

/**
 * Util helper per leggere bool da env in modo sicuro.
 */
function isTruthy(v: string | undefined): boolean {
  return !!v && ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

/**
 * Health check
 */
router.get("/api/studio/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "dashboard-studio-meta",
    ts: new Date().toISOString(),
  });
});

/**
 * Sorgenti disponibili per lo Studio (oggi: GA4)
 * enabled: true se sono presenti le credenziali per GA4
 * suggested: lista di property suggerite (se GA4_PROPERTY_ID è impostato)
 */
router.get("/api/studio/sources", (_req: Request, res: Response) => {
  const hasGaCreds =
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    isTruthy(process.env.GA4_ENABLED); // opzionale: flag manuale

  const suggested: string[] = [];
  if (process.env.GA4_PROPERTY_ID) {
    suggested.push(process.env.GA4_PROPERTY_ID);
  }

  res.json({
    ga4: {
      enabled: hasGaCreds,
      suggested, // es: ["452166144"]
    },
    // placeholder per altre integrazioni future
    // sheets: { enabled: false },
    // postgres: { enabled: false },
  });
});

// Export sia default che named
export { router as studioMetaRouter };
export default router;
