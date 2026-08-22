"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({
  showDemoCredentials,
}: {
  showDemoCredentials: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function goToDashboard() {
    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
    router.push(callbackUrl);
    router.refresh();
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "Unable to sign in");
        return;
      }

      const data = (await res.json()) as {
        mfaRequired?: boolean;
        mfaToken?: string;
      };
      if (data.mfaRequired && data.mfaToken) {
        setMfaToken(data.mfaToken);
        return;
      }

      goToDashboard();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!mfaToken || code.length !== 6) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code }),
      });
      if (!res.ok) {
        toast.error("Invalid or expired code");
        return;
      }
      goToDashboard();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mfaToken) {
    return (
      <form onSubmit={onSubmitMfa} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-code">Authentication code</Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || code.length !== 6}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Verify
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setMfaToken(null);
            setCode("");
          }}
        >
          Back to sign in
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@practice.health"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>

      {showDemoCredentials && (
        <div className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Demo access</p>
          <p>admin@sbos.health · clinician@sbos.health</p>
          <p>Password: Sbos!2026</p>
        </div>
      )}
    </form>
  );
}
