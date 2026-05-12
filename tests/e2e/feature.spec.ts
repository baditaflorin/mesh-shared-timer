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
