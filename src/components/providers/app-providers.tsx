"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToaster } from "@/components/providers/app-toaster";
import { ConsentProvider } from "@/components/privacy/consent-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <ConsentProvider>
          {children}
          <AppToaster />
        </ConsentProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
