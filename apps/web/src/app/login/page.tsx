import { Suspense } from "react";
import { Activity } from "lucide-react";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in",
};

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const showDemoCredentials =
    process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "true";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">SBOS</span>
        </div>
        <div className="space-y-4">
          <div className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/85">
            Live SBOS demo
          </div>
          <h1 className="text-3xl font-semibold leading-tight">
            Current SBOS workflows for scheduling, notes, billing, tasks, and reporting.
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            This live site is a product demo of the current SBOS build. It
            uses sample workspace data, preserves the existing sign-in flow,
            and is not for real patient records or compliance claims.
          </p>
          <p className="max-w-md text-sm text-primary-foreground/70">
            Behavioral health workflows shown in the demo are examples only and
            do not represent a HealthOS deployment.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} Success Brand OS
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">SBOS</span>
          </div>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to the SBOS demo workspace.
            </p>
          </div>
          <Suspense>
            <LoginForm showDemoCredentials={showDemoCredentials} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
