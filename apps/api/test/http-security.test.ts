import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../src/main.js";

const testSecret = "test-secret-that-is-long-enough-for-fitos-123";
let baseUrl = "";
let close: (() => Promise<void>) | undefined;

type CookieValues = { session: string; csrf: string };

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
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "ChangeMe123!" })
  });
  expect(response.status).toBe(201);
  return cookieValues(response);
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
});

afterAll(async () => close?.());

describe("HTTP security boundary", () => {
  it("requires a session and exposes a request id", async () => {
    const response = await fetch(`${baseUrl}/api/v1/members`);
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
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
});
