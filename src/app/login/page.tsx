import type { Metadata } from "next";
import { Suspense } from "react";
import { GraduationCap } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand text-white">
            <GraduationCap className="size-5" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">OBE Gradebook</div>
            <div className="text-xs text-muted">Sampoerna University · Academic Registry</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-1 text-base font-semibold">Sign in</h1>
          <p className="mb-5 text-sm text-muted">Use your university email address.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
