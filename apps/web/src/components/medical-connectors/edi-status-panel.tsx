"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { previewSyntheticX12Action } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  { code: "270", label: "Eligibility inquiry" },
  { code: "271", label: "Eligibility response" },
  { code: "837", label: "Professional claim" },
  { code: "276", label: "Claim status inquiry" },
  { code: "277", label: "Claim status response" },
  { code: "835", label: "Remittance advice" },
];

export function EdiStatusPanel() {
  const [results, setResults] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function run(code: string) {
    startTransition(async () => {
      const result = await previewSyntheticX12Action(code);
      setResults((current) => ({
        ...current,
        [code]: result.ok
          ? String(result.data?.mode ?? "verified")
          : result.error,
      }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ClaimFlow EDI status</CardTitle>
        <CardDescription>
          ANSI X12 workflow contracts. Preview generation is synthetic-only and
          never transmits a claim.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.code} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">X12 {item.code}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
                <Badge variant="success">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Contract ready
                </Badge>
              </div>
              <Button
                className="mt-3 w-full"
                size="sm"
                variant="outline"
                onClick={() => run(item.code)}
                disabled={pending}
              >
                {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                Synthetic preview
              </Button>
              {results[item.code] && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {results[item.code]}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
