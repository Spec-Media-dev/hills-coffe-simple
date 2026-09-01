"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Completes a Supabase Auth callback that arrived in the URL **fragment**.
 *
 * Supabase's `/auth/v1/verify` endpoint returns the resulting session one of
 * two ways. When the originating request registered a PKCE challenge it
 * redirects with `?code=`, which the server route handler exchanges. Otherwise
 * it falls back to the implicit flow and returns
 * `#access_token=…&refresh_token=…`.
 *
 * A fragment is never transmitted to the server, so the route handler sees a
 * callback with no `code` and no `token_hash` and cannot tell a genuine
 * confirmation from a malformed link. Before this component existed it
 * declared such links expired — which is exactly what a real, *successful*
 * email confirmation looked like to the user: "That link is no longer valid",
 * with no session established, even though `email_confirmed_at` had in fact
 * been set.
 *
 * This runs in the browser, where the fragment is readable, hands the tokens
 * to the browser Supabase client so the session is written to cookies the
 * server can read, and then returns to the callback route with `settled=1`
 * so the *server* still performs the authoritative role/blocked/verified
 * classification. The client never decides entitlement — it only transports
 * a session the server then re-reads and judges.
 */
export function ConfirmFragment({
  next,
  failurePath,
  settlePath,
}: {
  next: string;
  failurePath: string;
  settlePath: string;
}) {
  const t = useTranslations("auth.responses");
  const [failed, setFailed] = useState(false);
  // The fragment is consumed destructively and can only be read once. React
  // invokes effects twice in development StrictMode, and without this guard
  // the second pass finds an already-cleared hash and races a redirect to the
  // failure page over the successful one.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function complete() {
      const raw = window.location.hash.replace(/^#/, "");
      // Clear the fragment immediately so tokens are not left in the address
      // bar, in history, or in any subsequently-sent Referer.
      if (raw)
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );

      const params = new URLSearchParams(raw);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        window.location.replace(failurePath);
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setFailed(true);
          window.location.replace(failurePath);
          return;
        }
        // Hand back to the server for authoritative classification.
        window.location.replace(
          `${settlePath}?settled=1&next=${encodeURIComponent(next)}`,
        );
      } catch {
        setFailed(true);
        window.location.replace(failurePath);
      }
    }

    // No cleanup-based cancellation: StrictMode's unmount/remount would
    // otherwise abort the in-flight navigation of the first, real run.
    void complete();
  }, [next, failurePath, settlePath]);

  return (
    <main className="grid min-h-dvh place-items-center bg-page px-5 text-center">
      <div>
        <p role="status" aria-live="polite" className="text-sm font-bold">
          {failed ? t("linkExpired") : t("completing")}
        </p>
        <a
          className="mt-4 inline-block text-sm font-bold text-highlight underline-offset-4 hover:underline"
          href={failed ? failurePath : next}
        >
          {t("continueManually")}
        </a>
      </div>
    </main>
  );
}
