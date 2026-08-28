import { expect, test } from "@playwright/test";

const PASSWORD = "ChangeMe123!";

test("platform authentication has a separate entry point from tenant staff login", async ({
  page
}) => {
  await page.goto("/platform/login");
  await expect(page.getByText("FITOS PLATFORM")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Authorized personnel only." })).toBeVisible();
  await expect(page).toHaveURL(/\/platform\/login$/);
});

test("staff authentication exposes purpose-built workspace entry points", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);
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

test("automation result callbacks reject missing worker credentials", async ({ request }) => {
  const response = await request.post("http://127.0.0.1:3000/api/v1/automations/action-results", {
    data: {
      actionId: "00000000-0000-4000-8000-000000000001",
      actionType: "send_email",
      status: "delivered",
      provider: "test",
      message: "should not be accepted",
      completedAt: new Date().toISOString()
    }
  });
  expect(response.status()).toBe(401);
});

test("public tenant reservation submits through the real reservation flow", async ({ page }) => {
  await page.goto("/fitos-demo-gym");
  await page.getByRole("link", { name: "Timetable", exact: true }).click();
  const dayPills = page.locator(".public-day-pill");
  const reserve = page.getByRole("button", { name: /Reserve Spot|Join Waitlist/ }).first();
  for (let index = 0; index < 7 && !(await reserve.isVisible().catch(() => false)); index += 1) {
    await dayPills.nth(index).click();
  }
  await expect(reserve).toBeVisible();
  await reserve.click();
  const dialog = page.getByRole("dialog", { name: "Book Your Free Trial Pass" });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[placeholder="Jane"]').fill("Public");
  await dialog.locator('input[placeholder="Doe"]').fill("Reservation");
  await dialog.locator('input[placeholder^="+254"]').fill("+254711123456");
  await dialog.getByRole("button", { name: "Confirm Reservation" }).click();
  await expect(dialog).toContainText(
    /spot is confirmed|on the waitlist|reservation has been recorded/i
  );
});

test("role surfaces remain usable at pilot viewports", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/ops");
    await expect(page.locator(".surface-shell-content")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  }
});

test("branch context switches and persists across refresh", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);

  const switcher = page.locator(".branch-switcher");
  await switcher.click();
  await page.getByRole("button", { name: "Westlands", exact: true }).click();
  await expect(switcher).toContainText("Westlands");
  await page.reload();
  await expect(page.locator(".branch-switcher")).toContainText("Westlands");

  await page.locator(".branch-switcher").click();
  await page.getByRole("button", { name: "Kilimani", exact: true }).click();
  await expect(page.locator(".branch-switcher")).toContainText("Kilimani");
});

test("priority role routes remain readable without horizontal overflow on mobile", async ({
  page
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);

  const routes = [
    "/app/overview",
    "/ops",
    "/reception",
    "/coach",
    "/practice",
    "/app/members",
    "/app/bookings",
    "/app/attendance",
    "/app/leads",
    "/app/memberships",
    "/app/settings/account"
  ];
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
    }
  }
});

test("staff login selects the server-resolved cockpit by role", async ({ browser }) => {
  for (const [email, expectedPath] of [
    ["reception@gym.fitos.test", "/reception"],
    ["trainer@gym.fitos.test", "/coach"]
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`${expectedPath}$`));
    await context.close();
  }
});

test("staff access surface exposes role assignments without entering the Platform control plane", async ({
  page
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);
  await page.goto("/app/settings/team");
  await expect(page.getByRole("heading", { name: "Staff" })).toBeVisible();
  await expect(page.getByText("Roles", { exact: true })).toBeVisible();
  await page.goto("/app/platform/inquiries");
  await expect(page).not.toHaveURL(/\/platform\/inquiries$/);
});

test("owner can open tenant-scoped activity and audit history", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@gym.fitos.test");
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);
  await page.goto("/app/settings/audit");
  await expect(page.getByRole("heading", { name: "Activity & audit" })).toBeVisible();
  await expect(page.locator("main")).toContainText(/booking\.created|No audited activity yet/i);
});
