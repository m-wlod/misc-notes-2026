import { test as base, type Page } from "@playwright/test";

export { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Request-time pages stream: React first puts each Suspense boundary's content in a
 * hidden `<div id="S:n">` and a placeholder `<template id="B:n">` in place, then an
 * inline script swaps it in. Under CI load that swap can lag behind the `load` event,
 * and a locator then finds the content twice (hidden copy + swapped copy), or not yet
 * in place. Users never see the hidden copy. So every navigation here waits until the
 * stream has been revealed. (This was the "client re-render under CI load" known issue:
 * the trace of a failure showed the page still mid-stream.)
 */
export async function streamed(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      !document.querySelector('div[hidden][id^="S:"]') &&
      !document.querySelector('template[id^="B:"]'),
    undefined,
    { timeout: 15_000 },
  );
}

export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (...args: Parameters<Page["goto"]>) => {
      const res = await goto(...args);
      await streamed(page);
      return res;
    };
    page.reload = async (...args: Parameters<Page["reload"]>) => {
      const res = await reload(...args);
      await streamed(page);
      return res;
    };
    await provide(page);
  },
});
