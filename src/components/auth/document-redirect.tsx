"use client";

import { useEffect } from "react";

export function DocumentRedirect({ to, label }: { to: string; label: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <main className="grid min-h-dvh place-items-center bg-page px-5 text-center">
      <a className="text-sm font-bold text-highlight" href={to}>
        {label}
      </a>
    </main>
  );
}
