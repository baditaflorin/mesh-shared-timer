import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

async function chooseAndStart(
  page: import("@playwright/test").Page,
  preset: string,
): Promise<void> {
  await page.getByRole("button", { name: preset, exact: true }).click();
  await page.getByRole("button", { name: `Start ${preset}`, exact: true }).click();
}

test("two peers share the same labelled countdown from setup through start", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByRole("textbox", { name: "Label (optional)" }).fill("Standup");
    await chooseAndStart(a, "1 min");

    // This is a real Yjs/WebRTC room: the other browser must receive both the
    // shared state and its semantic label, not just a locally ticking display.
    await expect(b.getByRole("heading", { name: "Standup" })).toBeVisible();
    await expect(b.locator(".timer-big")).toContainText(/00:5/);
  } finally {
    await cleanup();
  }
});

test("reset on peer A clears countdown on peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await chooseAndStart(a, "5 min");
    await expect(b.locator(".timer-big")).toContainText(/04:5/);
    await a.getByRole("button", { name: "Reset timer", exact: true }).click();
    await expect(b.getByRole("button", { name: "Start 5 min", exact: true })).toBeVisible();
  } finally {
    await cleanup();
  }
});

test("pause on peer A freezes the countdown in unison on both peers", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Peer A starts a 5-min timer; peer B sees it counting down (cross-peer).
    await chooseAndStart(a, "5 min");
    await expect(b.locator(".timer-big")).toContainText(/04:5/);

    // Peer A pauses. The pause writes a single shared `pausedRemainingMs`
    // captured against the MESH clock, so the frozen value is identical on
    // every peer — this is the advertised "in unison via mesh clock" claim.
    await a.getByRole("button", { name: "Pause timer", exact: true }).click();

    // Bob (the opposite peer) must see the resume control appear — proving the
    // paused state crossed the mesh, not just peer A's local React state.
    await expect(b.getByRole("button", { name: "Resume timer", exact: true })).toBeVisible();

    // The frozen display must be byte-for-byte equal on both peers. If either
    // peer derived "remaining" from its own local Date.now() instead of the
    // shared mesh-clock deadline, the two values could differ here.
    const frozenA = (await a.locator(".timer-big").textContent())?.trim();
    expect(frozenA).toMatch(/^0[0-4]:[0-5]\d$/);
    await expect(b.locator(".timer-big")).toHaveText(frozenA ?? "");

    // And it stays frozen on both peers a moment later (no drift while paused).
    await b.waitForTimeout(1200);
    await expect(a.locator(".timer-big")).toHaveText(frozenA ?? "");
    await expect(b.locator(".timer-big")).toHaveText(frozenA ?? "");

    // Resuming on A flips both peers back to a live countdown.
    await a.getByRole("button", { name: "Resume timer", exact: true }).click();
    await expect(b.getByRole("button", { name: "Pause timer", exact: true })).toBeVisible();
  } finally {
    await cleanup();
  }
});
