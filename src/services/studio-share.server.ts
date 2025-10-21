// src/services/studio-share.server.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = Router();
const ROOT = path.resolve(process.cwd(), "data", "shared-dashboards");
if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });

// Crea link pubblico
router.post("/api/studio/share", (req, res) => {
  try {
    const payload = req.body; // { title, description, filters, charts }
    if (!payload || !Array.isArray(payload.charts) || payload.charts.length === 0) {
      return res.status(400).send("Nessun grafico da condividere.");
    }
    const id = crypto.randomBytes(10).toString("hex");
    const file = path.join(ROOT, `${id}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");

    // URL pubblico (renderizzalo con una pagina viewer)
    const url = `${process.env.PUBLIC_BASE_URL || "http://localhost:5173"}/view/${id}`;
    return res.json({ id, url });
  } catch (e: any) {
    console.error(e);
    return res.status(500).send(e?.message || "Errore share");
  }
});

// Recupera definizione pubblica
router.get("/api/studio/share/:id", (req, res) => {
  try {
    const id = req.params.id;
    const file = path.join(ROOT, `${id}.json`);
    if (!fs.existsSync(file)) return res.status(404).send("Not found");
    const json = fs.readFileSync(file, "utf8");
    res.setHeader("Content-Type", "application/json");
    return res.send(json);
  } catch (e: any) {
    return res.status(500).send(e?.message || "Errore");
  }
});

export default router;
