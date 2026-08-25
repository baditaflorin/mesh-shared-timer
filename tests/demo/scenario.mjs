// A compact, deterministic two-peer walkthrough for the checked-in release demo.
export default async function sharedTimerScenario(a, b) {
  await a.getByRole("textbox", { name: "Label (optional)" }).fill("Standup");
  await a.getByRole("button", { name: "1 min", exact: true }).click();
  await a.getByRole("button", { name: "Start 1 min", exact: true }).click();
  await b.locator(".timer-big").waitFor({ state: "visible" });
  await a.waitForTimeout(1400);

  await b.getByRole("button", { name: "Pause timer", exact: true }).click();
  await a.waitForTimeout(1500);

  await a.getByRole("button", { name: "Resume timer", exact: true }).click();
  await a.waitForTimeout(2200);

  await a.getByRole("button", { name: "Reset timer", exact: true }).click();
  await a.waitForTimeout(1000);
}
