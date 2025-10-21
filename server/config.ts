import fs from "fs";

function requiredEnv(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT || 3001),
  gtmSaKeyPath: requiredEnv("GTM_SA_KEY_PATH", "./secret/gtm-sa.json"),
  corsOrigins: (process.env.CORS_ORIGINS || "").split(",").filter(Boolean), // es: http://localhost:5173,https://tuo-dominio
};

export function readSaKey() {
  const raw = fs.readFileSync(config.gtmSaKeyPath, "utf8");
  return JSON.parse(raw);
}
