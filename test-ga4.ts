// test-ga4.ts
import "dotenv/config";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import fs from "fs";
console.log("Cred path:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
console.log("Esiste?:", fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? ""));
const propertyId = process.env.GA4_PROPERTY_ID;
if (!propertyId) {
  console.error("❌ GA4_PROPERTY_ID mancante");
  process.exit(1);
}

const client = new BetaAnalyticsDataClient();

async function testGA4() {
  try {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }],
    });

    const users = response?.rows?.[0]?.metricValues?.[0]?.value ?? "0";
    console.log(`✅ Connessione riuscita. Utenti attivi ultimi 7 giorni: ${users}`);
  } catch (err: any) {
    console.error("❌ Errore nella chiamata GA4:", err.message);
  }
}

testGA4();
