import type { Page } from 'playwright';

export async function waitForConsentOrTimeout(page: Page, softMs: number) {
  const start = Date.now();

  const waiter = page.waitForFunction(() => {
    const w: any = window;
    const snap = w.__getConsentSnapshot?.();
    return !!(snap && snap.last);
  }, { timeout: softMs });

  try {
    await Promise.race([
      waiter,
      new Promise(res => setTimeout(res, softMs))
    ]);
  } catch {
    // ignoriamo eventuali errori del waiter
  }
  const snapshot = await page.evaluate(() => (window as any).__getConsentSnapshot?.() ?? null);
  return { ms: Date.now() - start, snapshot };
}
