import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../src/main.js";

const testSecret = "test-secret-that-is-long-enough-for-fitos-123";
let baseUrl = "";
let close: (() => Promise<void>) | undefined;

type CookieValues = { session: string; csrf: string };
const loginCache = new Map<string, CookieValues>();

const cookieValues = (response: Response): CookieValues => {
  const cookies = response.headers.getSetCookie();
  const session = cookies
    .find((cookie) => cookie.startsWith("fitos_session="))
    ?.split(";")[0]
    ?.split("=")[1];
  const csrf = cookies
    .find((cookie) => cookie.startsWith("fitos_csrf="))
    ?.split(";")[0]
    ?.split("=")[1];
  if (!session || !csrf) throw new Error("Expected session and CSRF cookies.");
  return { session, csrf };
};

const login = async (email: string): Promise<CookieValues> => {
  const cached = loginCache.get(email);
  if (cached) return cached;
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "ChangeMe123!" })
  });
  expect(response.status).toBe(201);
  const cookies = cookieValues(response);
  loginCache.set(email, cookies);
  return cookies;
};

const protectedHeaders = (
  cookies: CookieValues,
  idempotencyKey = crypto.randomUUID()
): HeadersInit => ({
  "content-type": "application/json",
  cookie: `fitos_session=${cookies.session}; fitos_csrf=${cookies.csrf}`,
  origin: "http://localhost:5173",
  "x-csrf-token": cookies.csrf,
  "idempotency-key": idempotencyKey
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.FITOS_REPOSITORY = "memory";
  process.env.SESSION_SECRET = testSecret;
  process.env.CSRF_SECRET = testSecret;
  process.env.WEB_PUBLIC_URL = "http://localhost:5173";
  const { app } = await createApplication();
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  close = () => app.close();
}, 30_000);

afterAll(async () => close?.());

describe("HTTP security boundary", () => {
  it("requires a session and exposes a request id", async () => {
    const response = await fetch(`${baseUrl}/api/v1/members`);
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");

    expect((await fetch(`${baseUrl}/api/v1/health/live`)).status).toBe(200);
    const metrics = await fetch(`${baseUrl}/api/v1/metrics`);
    expect(metrics.status).toBe(200);
    const body = await metrics.text();
    expect(body).toContain("fitos_http_requests_total");
    expect(body).toContain('status_code="401"');
    expect(body).toContain('path="/api/v1/health/live",status_code="200"');
  });

  it("requires signed CSRF, scopes writes, and prevents cross-tenant reads", async () => {
    const gymOwner = await login("owner@gym.fitos.test");
    const pilatesOwner = await login("owner@pilates.fitos.test");
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${gymOwner.session}; fitos_csrf=${gymOwner.csrf}` }
    });
    const homeBranchId = (await me.json()).branches[0].id as string;

    const rejected = await fetch(`${baseUrl}/api/v1/members`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `fitos_session=${gymOwner.session}`
      },
      body: JSON.stringify({ contact: { firstName: "Amina" }, homeBranchId })
    });
    expect(rejected.status).toBe(403);

    const idempotencyKey = crypto.randomUUID();
    const createBody = JSON.stringify({
      contact: { firstName: "Amina", phone: "0712 345 678" },
      homeBranchId
    });
    const created = await fetch(`${baseUrl}/api/v1/members`, {
      method: "POST",
      headers: protectedHeaders(gymOwner, idempotencyKey),
      body: createBody
    });
    expect(created.status).toBe(201);
    const member = await created.json();

    const replay = await fetch(`${baseUrl}/api/v1/members`, {
      method: "POST",
      headers: protectedHeaders(gymOwner, idempotencyKey),
      body: createBody
    });
    expect(replay.status).toBe(201);
    expect((await replay.json()).id).toBe(member.id);

    const leaked = await fetch(`${baseUrl}/api/v1/members/${member.id}`, {
      headers: {
        cookie: `fitos_session=${pilatesOwner.session}; fitos_csrf=${pilatesOwner.csrf}`
      }
    });
    expect(leaked.status).toBe(404);
    expect((await leaked.json()).error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("creates, stages, and tenant-scopes leads", async () => {
    const gymOwner = await login("owner@gym.fitos.test");
    const pilatesOwner = await login("owner@pilates.fitos.test");
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${gymOwner.session}; fitos_csrf=${gymOwner.csrf}` }
    });
    const branchId = (await me.json()).branches[0].id as string;
    const created = await fetch(`${baseUrl}/api/v1/leads`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({
        contact: { firstName: "Lead Amina", phone: "0712345678" },
        branchId,
        source: "walk-in"
      })
    });
    expect(created.status).toBe(201);
    const lead = await created.json();
    expect(lead.stage).toBe("new");

    const note = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/notes`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({ body: "Requested an evening trial." })
    });
    expect(note.status).toBe(201);
    const task = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/tasks`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({ body: "Call tomorrow" })
    });
    expect(task.status).toBe(201);
    const notes = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/notes`, {
      headers: { cookie: `fitos_session=${gymOwner.session}; fitos_csrf=${gymOwner.csrf}` }
    });
    expect(await notes.json()).toHaveLength(1);

    const invalidLost = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/stage`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({ stage: "lost" })
    });
    expect(invalidLost.status).toBe(400);

    const lost = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/stage`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({ stage: "lost", lostReason: "Outside service area" })
    });
    expect(lost.status).toBe(201);
    expect((await lost.json()).lostReason).toBe("Outside service area");

    const conversion = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/convert`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({})
    });
    expect(conversion.status).toBe(201);
    const converted = await conversion.json();
    expect(converted.lead.stage).toBe("joined");
    expect(converted.member.contact.id).toBe(lead.contact.id);

    const repeatedConversion = await fetch(`${baseUrl}/api/v1/leads/${lead.id}/convert`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({})
    });
    expect(repeatedConversion.status).toBe(201);
    expect((await repeatedConversion.json()).alreadyConverted).toBe(true);

    const leaked = await fetch(`${baseUrl}/api/v1/leads/${lead.id}`, {
      headers: { cookie: `fitos_session=${pilatesOwner.session}; fitos_csrf=${pilatesOwner.csrf}` }
    });
    expect(leaked.status).toBe(404);
  });

  it("enforces tenant-safe services and room/trainer schedule conflicts", async () => {
    const gymOwner = await login("owner@gym.fitos.test");
    const pilatesOwner = await login("owner@pilates.fitos.test");
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${gymOwner.session}; fitos_csrf=${gymOwner.csrf}` }
    });
    const branchId = (await me.json()).branches[0].id as string;
    const serviceResponse = await fetch(`${baseUrl}/api/v1/services`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({
        branchId,
        name: "Morning Strength",
        serviceType: "class",
        durationMinutes: 60,
        defaultCapacity: 12
      })
    });
    expect(serviceResponse.status).toBe(201);
    const service = await serviceResponse.json();
    const roomResponse = await fetch(`${baseUrl}/api/v1/rooms`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({ branchId, name: "Studio A", capacity: 12 })
    });
    expect(roomResponse.status).toBe(201);
    const room = await roomResponse.json();
    const startsAt = "2030-01-08T08:00:00.000Z";
    const endsAt = "2030-01-08T09:00:00.000Z";
    const occurrenceResponse = await fetch(`${baseUrl}/api/v1/schedule/occurrences`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({
        branchId,
        serviceId: service.id,
        roomId: room.id,
        startsAt,
        endsAt,
        capacity: 12
      })
    });
    expect(occurrenceResponse.status).toBe(201);
    const occurrence = await occurrenceResponse.json();

    const collision = await fetch(`${baseUrl}/api/v1/schedule/occurrences`, {
      method: "POST",
      headers: protectedHeaders(gymOwner),
      body: JSON.stringify({
        branchId,
        serviceId: service.id,
        roomId: room.id,
        startsAt: "2030-01-08T08:30:00.000Z",
        endsAt: "2030-01-08T09:30:00.000Z",
        capacity: 12
      })
    });
    expect(collision.status).toBe(409);

    const cancelled = await fetch(
      `${baseUrl}/api/v1/schedule/occurrences/${occurrence.id}/cancel`,
      {
        method: "POST",
        headers: protectedHeaders(gymOwner),
        body: JSON.stringify({ reason: "Public holiday" })
      }
    );
    expect(cancelled.status).toBe(201);
    expect((await cancelled.json()).status).toBe("cancelled");

    const leaked = await fetch(`${baseUrl}/api/v1/services/${service.id}`, {
      headers: { cookie: `fitos_session=${pilatesOwner.session}; fitos_csrf=${pilatesOwner.csrf}` }
    });
    expect(leaked.status).toBe(404);
  });

  it("reserves exactly one final booking slot and retains cancellation history", async () => {
    const owner = await login("owner@gym.fitos.test");
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${owner.session}; fitos_csrf=${owner.csrf}` }
    });
    const branchId = (await me.json()).branches[0].id as string;
    const tag = crypto.randomUUID().slice(0, 8);
    const serviceResponse = await fetch(`${baseUrl}/api/v1/services`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({
        branchId,
        name: `Final Slot ${tag}`,
        serviceType: "class",
        durationMinutes: 45,
        defaultCapacity: 1
      })
    });
    expect(serviceResponse.status).toBe(201);
    const service = await serviceResponse.json();
    const occurrenceResponse = await fetch(`${baseUrl}/api/v1/schedule/occurrences`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({
        branchId,
        serviceId: service.id,
        startsAt: "2030-01-09T08:00:00.000Z",
        endsAt: "2030-01-09T08:45:00.000Z",
        capacity: 1
      })
    });
    expect(occurrenceResponse.status).toBe(201);
    const occurrence = await occurrenceResponse.json();
    const memberIds: string[] = [];
    for (const name of ["Final One", "Final Two"]) {
      const memberResponse = await fetch(`${baseUrl}/api/v1/members`, {
        method: "POST",
        headers: protectedHeaders(owner),
        body: JSON.stringify({ contact: { firstName: `${name} ${tag}` }, homeBranchId: branchId })
      });
      expect(memberResponse.status).toBe(201);
      memberIds.push((await memberResponse.json()).id);
    }

    const attempts = await Promise.all(
      memberIds.map((memberId) =>
        fetch(`${baseUrl}/api/v1/bookings`, {
          method: "POST",
          headers: protectedHeaders(owner),
          body: JSON.stringify({ occurrenceId: occurrence.id, memberId })
        })
      )
    );
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
    const successful = attempts.find((response) => response.status === 201);
    if (!successful) throw new Error("Expected one booking to succeed.");
    const booking = await successful.json();

    const duplicate = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({ occurrenceId: occurrence.id, memberId: booking.memberId })
    });
    expect(duplicate.status).toBe(409);

    const cancelled = await fetch(`${baseUrl}/api/v1/bookings/${booking.id}/cancel`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({ reason: "Member changed plans" })
    });
    expect(cancelled.status).toBe(201);
    expect((await cancelled.json()).cancelledAt).toBeTruthy();

    const replacement = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({ occurrenceId: occurrence.id, memberId: memberIds[1] })
    });
    expect(replacement.status).toBe(201);
  });

  it("enforces reception, finance, trainer, refund, and credit-override boundaries", async () => {
    const owner = await login("owner@gym.fitos.test");
    const reception = await login("reception@gym.fitos.test");
    const finance = await login("finance@gym.fitos.test");
    const trainer = await login("trainer@gym.fitos.test");
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${owner.session}; fitos_csrf=${owner.csrf}` }
    });
    const branchId = (await me.json()).branches[0].id as string;

    const memberResponse = await fetch(`${baseUrl}/api/v1/members`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({
        contact: { firstName: "Permission Boundary" },
        homeBranchId: branchId
      })
    });
    expect(memberResponse.status).toBe(201);
    const member = await memberResponse.json();
    const planResponse = await fetch(`${baseUrl}/api/v1/membership-plans`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({
        branchId,
        name: `Permission Pack ${crypto.randomUUID().slice(0, 8)}`,
        includedCredits: 2,
        durationDays: 30
      })
    });
    expect(planResponse.status).toBe(201);
    const plan = await planResponse.json();
    const activationResponse = await fetch(`${baseUrl}/api/v1/members/${member.id}/memberships`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({ planId: plan.id })
    });
    expect(activationResponse.status).toBe(201);
    const activation = await activationResponse.json();

    const forbiddenAdjustment = await fetch(
      `${baseUrl}/api/v1/members/${member.id}/credits/adjustments`,
      {
        method: "POST",
        headers: protectedHeaders(reception),
        body: JSON.stringify({
          membershipId: activation.membership.id,
          delta: 1,
          reason: "Reception must not adjust ledger truth"
        })
      }
    );
    expect(forbiddenAdjustment.status).toBe(403);

    const adjustmentKey = crypto.randomUUID();
    const adjustmentBody = JSON.stringify({
      membershipId: activation.membership.id,
      delta: 1,
      reason: "Owner-approved service recovery"
    });
    const adjustment = await fetch(`${baseUrl}/api/v1/members/${member.id}/credits/adjustments`, {
      method: "POST",
      headers: protectedHeaders(owner, adjustmentKey),
      body: adjustmentBody
    });
    expect(adjustment.status).toBe(201);
    const adjustmentReplay = await fetch(
      `${baseUrl}/api/v1/members/${member.id}/credits/adjustments`,
      {
        method: "POST",
        headers: protectedHeaders(owner, adjustmentKey),
        body: adjustmentBody
      }
    );
    expect(adjustmentReplay.status).toBe(201);
    expect((await adjustmentReplay.json()).id).toBe((await adjustment.json()).id);

    const paymentResponse = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: protectedHeaders(owner),
      body: JSON.stringify({
        branchId,
        memberId: member.id,
        amount: { amountMinor: "100000", currency: "KES" },
        method: "cash",
        allocationType: "other"
      })
    });
    expect(paymentResponse.status).toBe(201);
    const payment = await paymentResponse.json();

    const forbiddenRefund = await fetch(`${baseUrl}/api/v1/payments/${payment.id}/refund`, {
      method: "POST",
      headers: protectedHeaders(reception),
      body: JSON.stringify({ reason: "Reception refund attempt" })
    });
    expect(forbiddenRefund.status).toBe(403);
    const refund = await fetch(`${baseUrl}/api/v1/payments/${payment.id}/refund`, {
      method: "POST",
      headers: protectedHeaders(finance),
      body: JSON.stringify({ reason: "Customer-requested full refund" })
    });
    expect(refund.status).toBe(200);
    expect((await refund.json()).status).toBe("refunded");

    const trainerCreate = await fetch(`${baseUrl}/api/v1/members`, {
      method: "POST",
      headers: protectedHeaders(trainer),
      body: JSON.stringify({
        contact: { firstName: "Forbidden Trainer Create" },
        homeBranchId: branchId
      })
    });
    expect(trainerCreate.status).toBe(403);
    const receptionOverride = await fetch(`${baseUrl}/api/v1/attendance/checkin`, {
      method: "POST",
      headers: protectedHeaders(reception),
      body: JSON.stringify({
        branchId,
        memberId: member.id,
        overrideReason: "Reception override attempt"
      })
    });
    expect(receptionOverride.status).toBe(403);
  });

  it("denies exact-UUID reads and mutations across the full tenant resource matrix", async () => {
    const gym = await login("owner@gym.fitos.test");
    const pilates = await login("owner@pilates.fitos.test");
    const gymMe = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${gym.session}; fitos_csrf=${gym.csrf}` }
    });
    const gymBranchId = (await gymMe.json()).branches[0].id as string;
    const tag = crypto.randomUUID().slice(0, 8);

    const member = await (
      await fetch(`${baseUrl}/api/v1/members`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          contact: { firstName: `Matrix Member ${tag}` },
          homeBranchId: gymBranchId
        })
      })
    ).json();
    const lead = await (
      await fetch(`${baseUrl}/api/v1/leads`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          contact: { firstName: `Matrix Lead ${tag}` },
          branchId: gymBranchId,
          source: "matrix-test"
        })
      })
    ).json();
    const service = await (
      await fetch(`${baseUrl}/api/v1/services`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          branchId: gymBranchId,
          name: `Matrix Service ${tag}`,
          serviceType: "class",
          durationMinutes: 45,
          defaultCapacity: 8,
          creditsRequired: 0
        })
      })
    ).json();
    const room = await (
      await fetch(`${baseUrl}/api/v1/rooms`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({ branchId: gymBranchId, name: `Matrix Room ${tag}`, capacity: 8 })
      })
    ).json();
    const occurrence = await (
      await fetch(`${baseUrl}/api/v1/schedule/occurrences`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          branchId: gymBranchId,
          serviceId: service.id,
          roomId: room.id,
          startsAt: "2032-01-10T08:00:00.000Z",
          endsAt: "2032-01-10T08:45:00.000Z",
          capacity: 8
        })
      })
    ).json();
    const plan = await (
      await fetch(`${baseUrl}/api/v1/membership-plans`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          branchId: gymBranchId,
          name: `Matrix Plan ${tag}`,
          includedCredits: 2,
          durationDays: 30
        })
      })
    ).json();
    const activation = await (
      await fetch(`${baseUrl}/api/v1/members/${member.id}/memberships`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({ planId: plan.id })
      })
    ).json();
    const booking = await (
      await fetch(`${baseUrl}/api/v1/bookings`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({ occurrenceId: occurrence.id, memberId: member.id })
      })
    ).json();
    const payment = await (
      await fetch(`${baseUrl}/api/v1/payments`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          branchId: gymBranchId,
          memberId: member.id,
          amount: { amountMinor: "75000", currency: "KES" },
          method: "cash",
          allocationType: "other"
        })
      })
    ).json();
    const attendance = await (
      await fetch(`${baseUrl}/api/v1/attendance/checkin`, {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({
          branchId: gymBranchId,
          memberId: member.id,
          occurrenceId: occurrence.id
        })
      })
    ).json();

    const readRequests: Array<[string, string]> = [
      ["member", `/members/${member.id}`],
      ["lead", `/leads/${lead.id}`],
      ["service", `/services/${service.id}`],
      ["room", `/rooms/${room.id}`],
      ["occurrence", `/schedule/occurrences/${occurrence.id}`],
      ["booking", `/bookings/${booking.id}`],
      ["membership plan", `/membership-plans/${plan.id}`],
      ["member memberships", `/members/${member.id}/memberships`],
      ["credit ledger", `/members/${member.id}/credits`],
      ["payment", `/payments/${payment.id}`],
      ["attendance", `/attendance/${attendance.id}`]
    ];
    for (const [resource, path] of readRequests) {
      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        headers: { cookie: `fitos_session=${pilates.session}; fitos_csrf=${pilates.csrf}` }
      });
      expect(response.status, `${resource} read leaked`).toBe(404);
    }

    const mutationRequests: Array<[string, string, string, unknown]> = [
      ["member", "PATCH", `/members/${member.id}`, { contact: { firstName: "Cross tenant" } }],
      ["lead", "POST", `/leads/${lead.id}/stage`, { stage: "lost", lostReason: "Cross tenant" }],
      ["service", "PATCH", `/services/${service.id}`, { name: "Cross tenant" }],
      ["room", "PATCH", `/rooms/${room.id}`, { name: "Cross tenant" }],
      [
        "occurrence",
        "POST",
        `/schedule/occurrences/${occurrence.id}/cancel`,
        { reason: "Cross tenant" }
      ],
      ["booking", "POST", `/bookings/${booking.id}/cancel`, { reason: "Cross tenant" }],
      ["membership plan", "PATCH", `/membership-plans/${plan.id}`, { name: "Cross tenant" }],
      [
        "membership",
        "POST",
        `/members/${member.id}/memberships/${activation.membership.id}/cancel`,
        { reason: "Cross tenant" }
      ],
      [
        "credit ledger",
        "POST",
        `/members/${member.id}/credits/adjustments`,
        {
          membershipId: activation.membership.id,
          delta: 1,
          reason: "Cross tenant"
        }
      ],
      ["payment", "POST", `/payments/${payment.id}/refund`, { reason: "Cross tenant" }],
      ["attendance", "PATCH", `/attendance/${attendance.id}`, { status: "attended" }]
    ];
    for (const [resource, method, path, body] of mutationRequests) {
      const response = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: protectedHeaders(pilates),
        body: JSON.stringify(body)
      });
      expect(response.status, `${resource} mutation leaked`).toBe(404);
    }
  });

  it("creates and operates a bounded recurring schedule without leaking its template", async () => {
    const gym = await login("owner@gym.fitos.test");
    const pilates = await login("owner@pilates.fitos.test");
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: `fitos_session=${gym.session}; fitos_csrf=${gym.csrf}` }
    });
    const branchId = (await me.json()).branches[0].id as string;
    const tag = crypto.randomUUID().slice(0, 8);
    const serviceResponse = await fetch(`${baseUrl}/api/v1/services`, {
      method: "POST",
      headers: protectedHeaders(gym),
      body: JSON.stringify({
        branchId,
        name: `Recurring HTTP ${tag}`,
        serviceType: "class",
        durationMinutes: 45,
        defaultCapacity: 9
      })
    });
    expect(serviceResponse.status).toBe(201);
    const service = await serviceResponse.json();
    const roomResponse = await fetch(`${baseUrl}/api/v1/rooms`, {
      method: "POST",
      headers: protectedHeaders(gym),
      body: JSON.stringify({ branchId, name: `Recurring room ${tag}`, capacity: 9 })
    });
    expect(roomResponse.status).toBe(201);
    const room = await roomResponse.json();

    const effectiveStart = new Date();
    effectiveStart.setUTCDate(effectiveStart.getUTCDate() + 90);
    const effectiveStartDate = effectiveStart.toISOString().slice(0, 10);
    const through = new Date(effectiveStart);
    through.setUTCDate(through.getUTCDate() + 14);
    const throughDate = through.toISOString().slice(0, 10);
    const createResponse = await fetch(`${baseUrl}/api/v1/schedule/templates`, {
      method: "POST",
      headers: protectedHeaders(gym),
      body: JSON.stringify({
        branchId,
        serviceId: service.id,
        roomId: room.id,
        timezone: "Africa/Nairobi",
        daysOfWeek: [effectiveStart.getUTCDay()],
        localStartTime: "10:00",
        durationMinutes: 45,
        capacity: 9,
        effectiveStartDate,
        materializeThroughDate: throughDate
      })
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    expect(created.occurrences).toHaveLength(3);
    expect(
      created.occurrences.every(
        (occurrence: { templateId: string }) => occurrence.templateId === created.template.id
      )
    ).toBe(true);

    const leaked = await fetch(`${baseUrl}/api/v1/schedule/templates/${created.template.id}`, {
      headers: { cookie: `fitos_session=${pilates.session}; fitos_csrf=${pilates.csrf}` }
    });
    expect(leaked.status).toBe(404);
    const deniedMaterialization = await fetch(
      `${baseUrl}/api/v1/schedule/templates/${created.template.id}/materialize`,
      {
        method: "POST",
        headers: protectedHeaders(pilates),
        body: JSON.stringify({ throughDate })
      }
    );
    expect(deniedMaterialization.status).toBe(404);

    const extension = new Date(effectiveStart);
    extension.setUTCDate(extension.getUTCDate() + 28);
    const extensionThroughDate = extension.toISOString().slice(0, 10);
    const materialized = await fetch(
      `${baseUrl}/api/v1/schedule/templates/${created.template.id}/materialize`,
      {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({ throughDate: extensionThroughDate })
      }
    );
    expect(materialized.status).toBe(200);
    const materialization = await materialized.json();
    expect(materialization.occurrences).toHaveLength(2);
    expect(materialization.template.materializedThrough).toBe(extensionThroughDate);
    const repeatedMaterialization = await fetch(
      `${baseUrl}/api/v1/schedule/templates/${created.template.id}/materialize`,
      {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({ throughDate: extensionThroughDate })
      }
    );
    expect(repeatedMaterialization.status).toBe(200);
    expect((await repeatedMaterialization.json()).occurrences).toHaveLength(0);

    const second = created.occurrences[1];
    const movedStart = new Date(new Date(second.startsAt).getTime() + 60 * 60 * 1000);
    const override = await fetch(`${baseUrl}/api/v1/schedule/occurrences/${second.id}/override`, {
      method: "POST",
      headers: protectedHeaders(gym),
      body: JSON.stringify({
        startsAt: movedStart.toISOString(),
        endsAt: new Date(movedStart.getTime() + 45 * 60 * 1000).toISOString(),
        reason: "One-off instructor request"
      })
    });
    expect(override.status).toBe(200);
    expect((await override.json()).startsAt).toBe(movedStart.toISOString());

    const cancellation = await fetch(
      `${baseUrl}/api/v1/schedule/occurrences/${created.occurrences[0].id}/cancel`,
      {
        method: "POST",
        headers: protectedHeaders(gym),
        body: JSON.stringify({ reason: "Studio maintenance" })
      }
    );
    expect(cancellation.status).toBe(201);
    expect((await cancellation.json()).status).toBe("cancelled");
    const storedTemplate = await fetch(
      `${baseUrl}/api/v1/schedule/templates/${created.template.id}`,
      { headers: { cookie: `fitos_session=${gym.session}; fitos_csrf=${gym.csrf}` } }
    );
    expect((await storedTemplate.json()).localStartTime).toBe("10:00");
  });
});
