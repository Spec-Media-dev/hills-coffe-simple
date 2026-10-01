"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  CONSENT_KEY,
  CONSENT_MAX_AGE,
  parseConsent,
  type Consent,
} from "@/lib/privacy/consent";

// Also read by the SDK's retained beforeSend callback after it is unmounted.
// Revoking consent blocks further events without a page reload.
let currentConsent: Consent | null = null;
const Context = createContext<{
  consent: Consent | null;
  ready: boolean;
  requested: number;
  save: (analytics: boolean) => void;
  reopen: () => void;
} | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  const [requested, setRequested] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        currentConsent = parseConsent(localStorage.getItem(CONSENT_KEY));
      } catch {
        currentConsent = null;
      }
      setConsent(currentConsent);
      setReady(true);
    };
    read();
    const sync = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY || event.key === null) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!consent) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = consent.updatedAt + CONSENT_MAX_AGE - Date.now();
      if (remaining <= 0) {
        currentConsent = null;
        setConsent(null);
      } else {
        // Browser timers have a signed 32-bit delay limit (~24.8 days).
        timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
      }
    };
    checkExpiry();
    return () => window.clearTimeout(timer);
  }, [consent]);

  function save(analytics: boolean) {
    const choice: Consent = { version: 1, analytics, updatedAt: Date.now() };
    currentConsent = choice;
    setConsent(choice);
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
    } catch {
      /* The choice still applies in memory when storage is unavailable. */
    }
  }

  return (
    <Context.Provider
      value={{
        consent,
        ready,
        requested,
        save,
        reopen: () => setRequested((n) => n + 1),
      }}
    >
      {children}
      {ready && consent?.analytics && (
        <Analytics
          beforeSend={(event) =>
            currentConsent?.analytics &&
            Date.now() - currentConsent.updatedAt < CONSENT_MAX_AGE
              ? event
              : null
          }
        />
      )}
    </Context.Provider>
  );
}

/** Future optional integrations must consult this before loading or sending. */
export function useConsent() {
  const context = useContext(Context);
  if (!context) throw new Error("useConsent requires ConsentProvider");
  return context;
}
