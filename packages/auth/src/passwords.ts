import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const FORMAT = "scrypt";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<boolean>;
}

/**
 * Versioned scrypt hashes keep the persistence format explicit and avoid
 * exposing password implementation choices to the API layer.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    return `${FORMAT}$${salt.toString("base64url")}$${key.toString("base64url")}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const [format, encodedSalt, encodedKey] = encodedHash.split("$");
    if (format !== FORMAT || !encodedSalt || !encodedKey) {
      return false;
    }

    try {
      const salt = Buffer.from(encodedSalt, "base64url");
      const expected = Buffer.from(encodedKey, "base64url");
      if (expected.length !== KEY_LENGTH || salt.length < 16) {
        return false;
      }
      const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
