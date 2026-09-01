import { createHmac, timingSafeEqual } from "node:crypto";

export type AuthFlowToken = {
  kind: "recovery-intent" | "recovery-session";
  subject: string;
  sessionHash?: string;
  expiresAt: number;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString();

const signature = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const flowSubjectHash = (value: string, secret: string) =>
  createHmac("sha256", secret)
    .update(value.trim().toLowerCase())
    .digest("base64url");

export function signAuthFlowToken(payload: AuthFlowToken, secret: string) {
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyAuthFlowToken(
  token: string | null | undefined,
  expectedKind: AuthFlowToken["kind"],
  secret: string,
  now = Date.now(),
): AuthFlowToken | null {
  if (!token) return null;
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return null;

  const expected = Buffer.from(signature(payloadPart, secret));
  const received = Buffer.from(signaturePart);
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return null;

  try {
    const parsed = JSON.parse(decode(payloadPart)) as Partial<AuthFlowToken>;
    if (
      parsed.kind !== expectedKind ||
      typeof parsed.subject !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now ||
      (parsed.sessionHash !== undefined &&
        typeof parsed.sessionHash !== "string")
    )
      return null;
    return parsed as AuthFlowToken;
  } catch {
    return null;
  }
}
