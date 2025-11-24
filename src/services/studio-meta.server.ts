// src/services/studio-meta.server.ts
import { Router } from "express";

const router = Router();

router.get("/api/studio/sources", (_req, res) => {
  try {
    const envProperty = process.env.GA4_PROPERTY_ID;

    res.json({
      ga4: {
        enabled: true,
        suggested: envProperty ? [envProperty] : [],
      },
    });
  } catch (e) {
    console.error("[/api/studio/sources] error", e);
    res.status(500).json({ error: "sources failed" });
  }
});

export default router;
