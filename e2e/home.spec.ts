import { expect, test } from "@playwright/test";

test("the learning hub renders and exposes its primary navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AlgoQuest/i);
  await expect(page.locator("body")).toContainText(/AlgoQuest/i);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Internal Server Error");
});
