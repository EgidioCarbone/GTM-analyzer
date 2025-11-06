// Shared helpers for extracting expected payload definitions from user-provided snippets

/**
 * Remove <script> tags and common boilerplate around dataLayer snippets.
 */
function stripBoilerplate(source: string): string {
  return source
    .replace(/<\/?script[^>]*>/gi, '')
    .replace(/\bwindow\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\s*\];?/gi, '')
    .replace(/\bdataLayer\s*=\s*dataLayer\s*\|\|\s*\[\s*\];?/gi, '')
    .replace(/\bwindow\.dataLayer\s*=\s*\[\s*\];?/gi, '')
    .replace(/\bdataLayer\s*=\s*\[\s*\];?/gi, '');
}

/**
 * Remove single-line and multi-line JavaScript comments.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
}

/**
 * Extract a balanced segment between parentheses starting from `startIndex`.
 */
function extractBalancedSegment(source: string, startIndex: number): string | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escapeNext = false;

  for (let i = startIndex; i < source.length; i++) {
    const char = source[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (inSingle) {
      if (char === '\\') {
        escapeNext = true;
      } else if (char === '\'') {
        inSingle = false;
      }
      continue;
    }

    if (inDouble) {
      if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        inDouble = false;
      }
      continue;
    }

    if (inTemplate) {
      if (char === '\\') {
        escapeNext = true;
      } else if (char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '\'') {
      inSingle = true;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      continue;
    }
    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (char === '(') {
      depth++;
      continue;
    }

    if (char === ')') {
      if (depth === 0) {
        return source.slice(startIndex, i);
      }
      depth--;
      continue;
    }
  }

  return null;
}

/**
 * Normalize a user-provided payload snippet (JSON or JS object literal).
 * Returns the extracted expression body to parse, or null if nothing useful found.
 */
export function extractExpectedPayloadExpression(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  let text = stripBoilerplate(raw).trim();
  if (!text) return null;

  text = stripComments(text).trim();
  if (!text) return null;

  const pushRegex = /(?:window\.)?dataLayer\.push\s*\(/gi;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;

  while ((match = pushRegex.exec(text)) !== null) {
    lastMatch = match;
  }

  if (lastMatch) {
    const prefix = lastMatch[0];
    const startIndex = (lastMatch.index ?? 0) + prefix.length;
    const expression = extractBalancedSegment(text, startIndex);
    if (expression) {
      text = expression;
    }
  }

  text = text.replace(/;+\s*$/, '').trim();
  if (text.toLowerCase().startsWith('return ')) {
    text = text.slice(6).trim();
  }

  return text.length > 0 ? text : null;
}
