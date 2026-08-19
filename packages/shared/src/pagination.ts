export interface CursorPosition {
  createdAt: string;
  id: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): CursorPosition | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    // The caller treats malformed cursors as validation failures.
  }

  return null;
}
