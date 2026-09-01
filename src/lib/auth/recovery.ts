import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  flowSubjectHash,
  signAuthFlowToken,
  verifyAuthFlowToken,
} from "@/lib/auth/flow-token";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RECOVERY_COOKIE = "hills-recovery-context";
const RECOVERY_INTENT_TTL_MS = 15 * 60 * 1000;
const RECOVERY_SESSION_TTL_MS = 10 * 60 * 1000;

function flowSecret() {
  return process.env.AUTH_FLOW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function createRecoveryIntent(email: string) {
  const secret = flowSecret();
  if (!secret) return null;
  return signAuthFlowToken(
    {
      kind: "recovery-intent",
      subject: flowSubjectHash(email, secret),
      expiresAt: Date.now() + RECOVERY_INTENT_TTL_MS,
    },
    secret,
  );
}

export function isValidRecoveryIntent(
  token: string | null,
  email: string | null | undefined,
) {
  const secret = flowSecret();
  if (!secret || !email) return false;
  const payload = verifyAuthFlowToken(token, "recovery-intent", secret);
  return payload?.subject === flowSubjectHash(email, secret);
}

function recoverySessionMarker(userId: string) {
  const secret = flowSecret();
  if (!secret) return null;
  return signAuthFlowToken(
    {
      kind: "recovery-session",
      subject: userId,
      expiresAt: Date.now() + RECOVERY_SESSION_TTL_MS,
    },
    secret,
  );
}

export function attachRecoveryContext(
  response: NextResponse,
  userId: string,
  secure: boolean,
) {
  const marker = recoverySessionMarker(userId);
  if (!marker) return false;
  response.cookies.set(RECOVERY_COOKIE, marker, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: RECOVERY_SESSION_TTL_MS / 1000,
  });
  return true;
}

export async function hasValidRecoveryContext() {
  if (!isSupabaseConfigured()) return false;
  const payload = await recoveryPayload();
  if (!payload) return false;

  const supabase = await createSupabaseServerClient();
  const userResult = await supabase.auth.getUser();
  const user = userResult.data.user;
  return Boolean(user && payload.subject === user.id);
}

async function recoveryPayload() {
  const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
  if (!marker) return null;

  const secret = flowSecret();
  if (!secret) return null;
  return verifyAuthFlowToken(marker, "recovery-session", secret);
}

/** Page-level check: marker is server-signed and only callback can issue it. */
export async function hasRecoveryMarker() {
  return Boolean(await recoveryPayload());
}

export async function clearRecoveryContext() {
  (await cookies()).delete(RECOVERY_COOKIE);
}
