import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("starting a timer on peer A shows the countdown on peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Peer A clicks the 1-minute preset
    await a.getByRole("button", { name: "1 min" }).click();
    // Peer B should see a countdown in the high-50-something seconds within mesh sync window
    await expect(b.locator(".timer-big")).toContainText(/00:5/);
  } finally {
    await cleanup();
  }
});

test("reset on peer A clears countdown on peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByRole("button", { name: "5 min", exact: true }).click();
    await expect(b.locator(".timer-big")).toContainText(/04:5/);
    await a.getByRole("button", { name: "reset" }).click();
    await expect(b.locator(".timer-big")).toHaveText("00:00");
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
    await a.getByRole("button", { name: "5 min", exact: true }).click();
    await expect(b.locator(".timer-big")).toContainText(/04:5/);

    // Peer A pauses. The pause writes a single shared `pausedRemainingMs`
    // captured against the MESH clock, so the frozen value is identical on
    // every peer — this is the advertised "in unison via mesh clock" claim.
    await a.getByRole("button", { name: "pause" }).click();

    // Bob (the opposite peer) must see the resume control appear — proving the
    // paused state crossed the mesh, not just peer A's local React state.
    await expect(b.getByRole("button", { name: "resume" })).toBeVisible();

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
    await a.getByRole("button", { name: "resume" }).click();
    await expect(b.getByRole("button", { name: "pause" })).toBeVisible();
  } finally {
    await cleanup();
  }
});
