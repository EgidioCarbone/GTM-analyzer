import type { GTMContainer, GTMTag } from "../types/gtm";

/** Ritorna true se il tag è di tipo UA  */
export const isUATag = (tag: GTMTag): boolean => tag.type === "ua";

/** Estrae tutti i tag UA dal container */
export const extractUATags = (c: GTMContainer): GTMTag[] =>
  c.tag?.filter(isUATag) ?? [];

/** Suggerimento di migrazione */
export interface MigrationSuggestion {
  uaTagId: string;
  uaTagName: string;
  trackType: string;
  suggestedGa4Name: string;
  ga4Type: "gaawe" | "googtag";
}

/** Costruisce la lista dei suggerimenti UA → GA4  */
export const buildMigrationSuggestions = (
  c: GTMContainer,
): MigrationSuggestion[] =>
  extractUATags(c).map((tag) => {
    const trackType = (
      tag.parameter?.find((p) => p.key === "trackType")?.value ?? ""
    ).toUpperCase();

    const isPv = trackType === "TRACK_PAGEVIEW";

    return {
      uaTagId: String(tag.tagId),
      uaTagName: tag.name,
      trackType,
      suggestedGa4Name: isPv
        ? `GA4 - Configuration (from ${tag.name})`
        : `GA4 Event – ${tag.name}`,
      ga4Type: isPv ? "googtag" : "gaawe",
    };
  });