import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "ChangeMe123!";

async function signIn(
  page: Page,
  email = "owner@gym.fitos.test",
  expectedPath: RegExp = /\/app\/overview$/
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectedPath);
  if (expectedPath.source.includes("app/overview")) {
    await expect(page.getByRole("complementary", { name: "Primary navigation" })).toBeVisible();
  }
}

function localDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

test("owner completes the pilot operating river and reception is denied a refund", async ({
  page
}) => {
  const suffix = `${Date.now()}`.slice(-8);
  const firstName = `Amina${suffix}`;
  const lastName = "Pilot";
  const fullName = `${firstName} ${lastName}`;
  const serviceName = `Pilot Strength ${suffix}`;
  const roomName = `Pilot Studio ${suffix}`;
  const planName = `Pilot Pack ${suffix}`;
  const paymentReference = `E2E-${suffix}`;
  const sessionDate = localDateOffset(1);

  await signIn(page);

  await test.step("create a lead, add follow-up work, and convert it", async () => {
    await page.getByRole("link", { name: "Leads & CRM", exact: true }).click();
    await page.getByRole("link", { name: "Add lead" }).click();
    await page.getByLabel("First name").fill(firstName);
    await page.getByLabel("Last name").fill(lastName);
    await page.getByLabel("Phone").fill(`+25471${suffix}`);
    await page.getByLabel("Email").fill(`${firstName.toLowerCase()}@fitos.test`);
    await page.getByLabel("Branch").selectOption({ label: "Kilimani" });
    await page.getByLabel("Interest").fill(serviceName);
    await page.getByLabel("Source").fill("Playwright pilot acceptance");
    await page.getByRole("button", { name: "Create lead" }).click();

    const leadCard = page.getByRole("button", { name: new RegExp(fullName) });
    await expect(leadCard).toBeVisible();
    await leadCard.click();

    const dialog = page.getByRole("dialog", { name: "Lead Profile" });
    await dialog.getByLabel("Lead note").fill("Called and confirmed a trial session.");
    await dialog.getByRole("button", { name: "Add", exact: true }).first().click();
    await expect(dialog.getByText("Called and confirmed a trial session.")).toBeVisible();
    await dialog.getByLabel("Lead task").fill("Send the class preparation details.");
    await dialog.getByRole("button", { name: "Add", exact: true }).last().click();
    await expect(dialog.getByText("Send the class preparation details.")).toBeVisible();
    await dialog.getByRole("button", { name: "Convert to member" }).click();
    await expect(dialog.getByRole("link", { name: "Open member profile" })).toBeVisible();
  });

  const memberLink = page.getByRole("dialog", { name: "Lead Profile" }).getByRole("link", {
    name: "Open member profile"
  });
  const memberHref = await memberLink.getAttribute("href");
  expect(memberHref).toMatch(/^\/app\/members\/[0-9a-f-]+$/);
  const memberId = memberHref!.split("/").at(-1)!;
  await memberLink.click();
  await expect(page.getByRole("heading", { name: fullName })).toBeVisible();

  await test.step("configure a credit-backed service and room", async () => {
    await page.getByRole("link", { name: "Services & Classes", exact: true }).click();
    await page.getByRole("button", { name: "Add service" }).click();
    const serviceDialog = page.getByRole("dialog", { name: "Add service" });
    await serviceDialog.getByLabel("Service name").fill(serviceName);
    await serviceDialog.getByLabel("Service type").selectOption("class");
    await serviceDialog.getByLabel("Duration (minutes)").fill("60");
    await serviceDialog.getByLabel("Default capacity").fill("8");
    await serviceDialog.getByLabel("Credits per booking").fill("1");
    await serviceDialog.getByLabel("Cancellation cutoff (minutes)").fill("120");
    await serviceDialog.getByLabel("Branch limitation").selectOption({ label: "Kilimani" });
    await serviceDialog.getByLabel("Price (KES/amount)").fill("1500");
    await serviceDialog.getByRole("button", { name: "Create service" }).click();
    await expect(page.getByRole("cell", { name: serviceName })).toBeVisible();

    await page.getByRole("button", { name: "Rooms & Resources" }).click();
    const roomDialog = page.getByRole("dialog", { name: "Rooms & Resources" });
    await roomDialog.getByLabel("Branch").selectOption({ label: "Kilimani" });
    await roomDialog.getByLabel("Room name").fill(roomName);
    await roomDialog.getByLabel("Capacity limit").fill("8");
    await roomDialog.getByRole("button", { name: "Add room" }).click();
    await expect(roomDialog.getByText(roomName)).toBeVisible();
    await roomDialog.getByRole("button", { name: "Close dialog" }).click();
  });

  const occurrenceIds: string[] = [];
  await test.step("schedule two occurrences through the timetable", async () => {
    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    for (const startTime of ["10:00", "12:00"]) {
      await page.getByRole("button", { name: "Schedule session" }).click();
      const dialog = page.getByRole("dialog", { name: "Schedule session" });
      await dialog.getByLabel("Service / Class").selectOption({ label: `${serviceName} (60 min)` });
      await dialog.getByLabel("Branch").selectOption({ label: "Kilimani" });
      await dialog.getByLabel("Date").fill(sessionDate);
      await dialog.getByLabel("Start time").fill(startTime);
      await dialog.getByLabel("Room / Studio area").selectOption({ label: `${roomName} (max 8)` });
      const responsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          /\/api\/v1\/schedule\/occurrences$/.test(response.url())
      );
      await dialog.getByRole("button", { name: "Schedule session" }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const occurrence = (await response.json()) as { id: string };
      occurrenceIds.push(occurrence.id);
      await expect(dialog).toBeHidden();
    }
  });

  await test.step("create a bounded recurring schedule through the operator UI", async () => {
    const recurringStart = localDateOffset(30);
    const recurringThrough = localDateOffset(44);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(`${recurringStart}T00:00:00`).getDay()
    ]!;
    await page.getByRole("button", { name: "Schedule session" }).click();
    const dialog = page.getByRole("dialog", { name: "Schedule session" });
    await dialog.getByLabel("Schedule type").selectOption("weekly");
    await dialog.getByLabel("Service / Class").selectOption({ label: `${serviceName} (60 min)` });
    await dialog.getByLabel("Branch").selectOption({ label: "Kilimani" });
    await dialog.getByLabel("Effective start").fill(recurringStart);
    await dialog.getByLabel("Start time").fill("15:00");
    const weekdayBoxes = dialog
      .getByRole("group", { name: "Recurring weekdays" })
      .getByRole("checkbox");
    for (let index = 0; index < (await weekdayBoxes.count()); index += 1) {
      const checkbox = weekdayBoxes.nth(index);
      if (await checkbox.isChecked()) await checkbox.uncheck();
    }
    await dialog.getByRole("checkbox", { name: weekday }).check();
    await dialog.getByLabel("Generate sessions through").fill(recurringThrough);
    await dialog.getByLabel("Room / Studio area").selectOption({ label: `${roomName} (max 8)` });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/v1\/schedule\/templates$/.test(response.url())
    );
    await dialog.getByRole("button", { name: "Create recurring series" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const created = (await response.json()) as { occurrences: Array<{ templateId: string }> };
    expect(created.occurrences).toHaveLength(3);
    await expect(dialog).toBeHidden();
    const recurringRow = page.getByRole("row").filter({ hasText: serviceName }).last();
    await expect(recurringRow).toContainText(`Through ${recurringThrough}`);
  });

  await test.step("create and activate a membership entitlement", async () => {
    await page.getByRole("link", { name: "Memberships", exact: true }).click();
    await page.getByRole("button", { name: "New membership plan" }).click();
    const dialog = page.getByRole("dialog", { name: "Create membership plan" });
    await dialog.getByLabel("Plan name").fill(planName);
    await dialog.getByLabel("Price amount").fill("4500");
    await dialog.getByLabel("Plan duration (days)").fill("30");
    await dialog.getByLabel("Included class credits").fill("3");
    await dialog.getByLabel("Branch availability").selectOption({ label: "Kilimani" });
    await dialog.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByRole("cell", { name: planName })).toBeVisible();

    await page.goto(`/app/members/${memberId}`);
    await page.getByRole("button", { name: "Assign Plan", exact: true }).click();
    const activationDialog = page.getByRole("dialog", { name: "Activate membership" });
    const planOption = activationDialog
      .getByLabel("Membership plan")
      .locator("option")
      .filter({ hasText: planName });
    await activationDialog
      .getByLabel("Membership plan")
      .selectOption((await planOption.getAttribute("value"))!);
    await activationDialog.getByRole("button", { name: "Activate plan & grant credits" }).click();
    const credits = page.getByText("Available credits").locator("..").locator("strong");
    await expect(credits).toHaveText("3");
  });

  const createBooking = async (occurrenceId: string) => {
    await page.goto(`/app/bookings/new?memberId=${memberId}&occurrenceId=${occurrenceId}`);
    await expect(page.getByText(fullName, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Confirm and create booking" }).click();
    await expect(page).toHaveURL(/\/app\/bookings$/);
    await expect(page.getByRole("row").filter({ hasText: fullName }).first()).toBeVisible();
  };

  await test.step("debit, cancel, and restore the first booking credit", async () => {
    await createBooking(occurrenceIds[0]!);
    await page.goto(`/app/members/${memberId}`);
    await expect(page.getByText("Available credits").locator("..").locator("strong")).toHaveText(
      "2"
    );
    await page.getByRole("link", { name: "Bookings", exact: true }).click();
    const bookingRow = page.getByRole("row").filter({ hasText: fullName }).first();
    await bookingRow.getByRole("button", { name: "Cancel" }).click();
    const cancelDialog = page.getByRole("dialog", { name: "Cancel booking" });
    await cancelDialog
      .getByLabel("Cancellation reason")
      .fill("Pilot cancellation restoration proof");
    await cancelDialog.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(bookingRow.getByText("Cancelled", { exact: true })).toBeVisible();
    await page.goto(`/app/members/${memberId}`);
    await expect(page.getByText("Available credits").locator("..").locator("strong")).toHaveText(
      "3"
    );
  });

  await test.step("book the roster occurrence and record an allocated payment", async () => {
    await createBooking(occurrenceIds[1]!);
    await page.goto(`/app/members/${memberId}`);
    await expect(page.getByText("Available credits").locator("..").locator("strong")).toHaveText(
      "2"
    );

    await page.getByRole("link", { name: "Payments", exact: true }).click();
    await page.getByRole("button", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record payment" });
    await dialog.getByLabel("Branch").selectOption({ label: "Kilimani" });
    await dialog.getByLabel("Amount (in standard units)").fill("4500");
    await dialog.getByLabel("Payment Method").selectOption("cash");
    await dialog.getByLabel("Allocation Type").selectOption("other");
    await dialog.getByLabel("Payment Reference / Receipt #").fill(paymentReference);
    await dialog.getByLabel("Find member").fill(firstName);
    await dialog.getByRole("button", { name: new RegExp(fullName) }).click();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && /\/api\/v1\/payments$/.test(response.url())
    );
    await dialog.getByRole("button", { name: "Confirm & Save Payment" }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const payment = (await response.json()) as { id: string };
    await expect(page.getByRole("row").filter({ hasText: paymentReference })).toBeVisible();

    await page.getByRole("link", { name: "Schedule", exact: true }).click();
    // FullCalendar does not guarantee DOM ordering when events share a day.
    // Target the second session by its displayed local start time instead of
    // relying on `.last()`, which can reopen the cancelled 10:00 booking.
    await page
      .locator(".fc-event")
      .filter({ hasText: serviceName })
      .filter({ hasText: "12:00" })
      .click();
    await page.getByRole("link", { name: "Open class roster" }).click();
    await expect(page.getByRole("heading", { name: "Class Roster & Check-in" })).toBeVisible();
    const rosterMember = page.getByText(fullName, { exact: true });
    await expect(rosterMember).toBeVisible();
    await page.getByRole("button", { name: "Check In" }).click();
    await expect(page.getByRole("button", { name: "Mark attended" })).toBeVisible();
    await page.getByRole("button", { name: "Mark attended" }).click();
    await expect(page.getByText("Attended", { exact: true })).toBeVisible();

    await page.goto(`/app/members/${memberId}`);
    await page.getByRole("button", { name: "Bookings", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Booking History" })).toBeVisible();
    await expect(page.getByText(serviceName, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Credits & Payments", exact: true }).click();
    const paymentHistory = page.getByRole("heading", { name: "Payment History" }).locator("../..");
    await expect(paymentHistory).toContainText("4,500.00");
    await page.getByRole("button", { name: "Attendance", exact: true }).click();
    const attendanceHistory = page
      .getByRole("heading", { name: "Attendance History" })
      .locator("..");
    await expect(attendanceHistory.getByText("Attended", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Gym Owner/ }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page, "reception@gym.fitos.test", /\/reception$/);
    // Front Desk intentionally cannot enter the Command payments surface.
    await page.goto("/app/payments");
    await expect(page.getByRole("heading", { name: /access to FITOS Command/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refund" })).toHaveCount(0);

    const refundStatus = await page.evaluate(
      async ({ paymentId }) => {
        const csrf = document.cookie
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("fitos_csrf="))
          ?.slice("fitos_csrf=".length);
        const response = await fetch(`/api/v1/payments/${paymentId}/refund`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
            ...(csrf ? { "X-CSRF-Token": csrf } : {})
          },
          body: JSON.stringify({ reason: "Reception must not be able to refund" })
        });
        return response.status;
      },
      { paymentId: payment.id }
    );
    expect(refundStatus).toBe(403);
  });
});
