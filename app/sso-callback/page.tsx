"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <main className="grid-bg flex min-h-screen items-center justify-center bg-void font-mono text-xs tracking-[0.3em] text-gray-400">
      COMPLETING SECURE SIGN-IN…
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
