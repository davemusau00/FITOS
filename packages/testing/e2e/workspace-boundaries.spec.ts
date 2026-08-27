import { expect, test } from "@playwright/test";

const PASSWORD = "ChangeMe123!";

test("staff authentication exposes purpose-built workspace entry points", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);

  for (const route of ["/ops", "/reception", "/coach", "/practice"]) {
    await page.goto(route);
    await expect(page.locator(".surface-shell")).toBeVisible();
    await expect(page.locator(".surface-shell-content")).toBeVisible();
  }
});

test("unauthenticated API access is rejected instead of falling through to a dashboard", async ({
  request
}) => {
  const response = await request.get("http://127.0.0.1:3000/api/v1/auth/me");
  expect(response.status()).toBe(401);
});
