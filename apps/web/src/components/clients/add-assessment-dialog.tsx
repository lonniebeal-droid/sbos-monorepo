"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { addAssessmentAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InstrumentDef {
  id: string;
  questionCount: number;
  maxScore: number;
  bands: { min: number; max: number; label: string }[];
}

const INSTRUMENTS: Record<string, InstrumentDef> = {
  "PHQ-9": {
    id: "PHQ-9",
    questionCount: 9,
    maxScore: 27,
    bands: [
      { min: 0, max: 4, label: "Minimal" },
      { min: 5, max: 9, label: "Mild" },
      { min: 10, max: 14, label: "Moderate" },
      { min: 15, max: 19, label: "Moderately Severe" },
      { min: 20, max: 27, label: "Severe" },
    ],
  },
  "GAD-7": {
    id: "GAD-7",
    questionCount: 7,
    maxScore: 21,
    bands: [
      { min: 0, max: 4, label: "Minimal" },
      { min: 5, max: 9, label: "Mild" },
      { min: 10, max: 14, label: "Moderate" },
      { min: 15, max: 21, label: "Severe" },
    ],
  },
  "C-SSRS": {
    id: "C-SSRS",
    questionCount: 25,
    maxScore: 25,
    bands: [
      { min: 0, max: 0, label: "No Ideation" },
      { min: 1, max: 2, label: "Low Ideation" },
      { min: 3, max: 4, label: "Moderate Ideation" },
      { min: 5, max: 25, label: "High Ideation" },
    ],
  },
  AUDIT: {
    id: "AUDIT",
    questionCount: 10,
    maxScore: 40,
    bands: [
      { min: 0, max: 7, label: "Low Risk" },
      { min: 8, max: 15, label: "Hazardous" },
      { min: 16, max: 19, label: "Harmful" },
      { min: 20, max: 40, label: "Possible Dependency" },
    ],
  },
  "DAST-10": {
    id: "DAST-10",
    questionCount: 10,
    maxScore: 10,
    bands: [
      { min: 0, max: 0, label: "No Problems" },
      { min: 1, max: 2, label: "Low" },
      { min: 3, max: 5, label: "Moderate" },
      { min: 6, max: 8, label: "Substantial" },
      { min: 9, max: 10, label: "Severe" },
    ],
  },
};

const INSTRUMENT_IDS = Object.keys(INSTRUMENTS);

function scoreInstrument(
  id: string,
  responses: Record<string, number>,
): { score: number; severity: string } | null {
  const keys = Object.keys(responses);
  if (keys.length === 0) return null;
  let score = 0;
  for (const k of keys) {
    score += responses[k] ?? 0;
  }
  const def = INSTRUMENTS[id];
  if (!def) return { score, severity: "Unknown" };
  for (const band of def.bands) {
    if (score >= band.min && score <= band.max) {
      return { score, severity: band.label };
    }
  }
  return { score, severity: def.bands[def.bands.length - 1]?.label ?? "Unknown" };
}

const schema = z.object({
  instrument: z.string().min(1, "Instrument is required"),
  administeredAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddAssessmentDialog({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [instrument, setInstrument] = useState("PHQ-9");
  const [responses, setResponses] = useState<Record<string, number>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { instrument: "PHQ-9" },
  });

  const def = INSTRUMENTS[instrument];
  const responseFields = def
    ? Array.from({ length: def.questionCount }, (_, i) => `q${i + 1}`)
    : [];

  const preview = Object.keys(responses).length > 0
    ? scoreInstrument(instrument, responses)
    : null;

  function onSubmit(_values: FormValues) {
    startTransition(async () => {
      const result = await addAssessmentAction({
        clientId,
        instrument,
        responses,
        ...(preview ? { score: preview.score, severity: preview.severity } : {}),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        preview
          ? `${instrument} recorded \u2014 ${preview.severity} (${preview.score})`
          : "Assessment recorded",
      );
      setOpen(false);
      reset();
      setInstrument("PHQ-9");
      setResponses({});
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" /> Add assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Record assessment</DialogTitle>
            <DialogDescription>
              Administer a standardized screening instrument and record the
              result.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assess-instrument">Instrument</Label>
              <select
                id="assess-instrument"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={instrument}
                onChange={(e) => {
                  setInstrument(e.target.value);
                  setResponses({});
                }}
              >
                {INSTRUMENT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
              {errors.instrument && (
                <p className="text-sm text-destructive">
                  {errors.instrument.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assess-date">Date administered</Label>
              <Input
                id="assess-date"
                type="date"
                {...register("administeredAt")}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Responses (0 = Not at all, 1 = Several days, 2 = More than half
                the days, 3 = Nearly every day)
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {responseFields.map((fieldKey, idx) => (
                  <div key={fieldKey} className="space-y-1">
                    <Label className="text-xs" htmlFor={`resp-${fieldKey}`}>
                      Question {idx + 1}
                    </Label>
                    <select
                      id={`resp-${fieldKey}`}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={responses[fieldKey] ?? 0}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          [fieldKey]: Number(e.target.value),
                        }))
                      }
                    >
                      <option value={0}>0 &mdash; Not at all</option>
                      <option value={1}>1 &mdash; Several days</option>
                      <option value={2}>
                        2 &mdash; More than half the days
                      </option>
                      <option value={3}>3 &mdash; Nearly every day</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {preview && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <span className="font-medium">Score: {preview.score}</span>
                <span className="ml-2 text-muted-foreground">
                  &mdash; {preview.severity}
                </span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Record assessment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
