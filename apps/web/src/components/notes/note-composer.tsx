"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const noteSchema = z.object({
  client: z.string().min(1, "Select a client"),
  type: z.enum(["BIRP", "DAP", "SOAP"]),
  fields: z.record(z.string(), z.string()),
});

type NoteFormValues = z.infer<typeof noteSchema>;

const TEMPLATES: Record<
  NoteFormValues["type"],
  { key: string; label: string; placeholder: string }[]
> = {
  BIRP: [
    { key: "behavior", label: "Behavior", placeholder: "Observed behavior and client-reported concerns…" },
    { key: "intervention", label: "Intervention", placeholder: "Clinical interventions used this session…" },
    { key: "response", label: "Response", placeholder: "Client's response to the interventions…" },
    { key: "plan", label: "Plan", placeholder: "Plan for next session and homework…" },
  ],
  DAP: [
    { key: "data", label: "Data", placeholder: "Objective and subjective data…" },
    { key: "assessment", label: "Assessment", placeholder: "Clinical assessment and progress…" },
    { key: "plan", label: "Plan", placeholder: "Treatment plan and next steps…" },
  ],
  SOAP: [
    { key: "subjective", label: "Subjective", placeholder: "Client's reported experience…" },
    { key: "objective", label: "Objective", placeholder: "Observable, measurable findings…" },
    { key: "assessment", label: "Assessment", placeholder: "Clinical impression…" },
    { key: "plan", label: "Plan", placeholder: "Plan of care…" },
  ],
};

export function NoteComposer() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<NoteFormValues["type"]>("BIRP");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { client: "", type: "BIRP", fields: {} },
  });

  async function onSubmit(values: NoteFormValues) {
    setSubmitting(true);
    // Persisted through the SBOS API once the clinical-notes endpoints are wired.
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmitting(false);
    setOpen(false);
    reset();
    toast.success(`${values.type} note drafted for ${values.client}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New note
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New clinical note</DialogTitle>
            <DialogDescription>
              Document a session using a structured note format.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-client">Client</Label>
              <Input
                id="note-client"
                placeholder="Search client…"
                {...register("client")}
              />
              {errors.client && (
                <p className="text-sm text-destructive">
                  {errors.client.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Note format</Label>
              <Tabs
                value={type}
                onValueChange={(value) =>
                  setType(value as NoteFormValues["type"])
                }
              >
                <TabsList>
                  <TabsTrigger value="BIRP">BIRP</TabsTrigger>
                  <TabsTrigger value="DAP">DAP</TabsTrigger>
                  <TabsTrigger value="SOAP">SOAP</TabsTrigger>
                </TabsList>
              </Tabs>
              <input type="hidden" value={type} {...register("type")} />
            </div>

            <div className="space-y-3">
              {TEMPLATES[type].map((field) => (
                <div key={`${type}-${field.key}`} className="space-y-2">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Textarea
                    id={`field-${field.key}`}
                    placeholder={field.placeholder}
                    {...register(`fields.${field.key}`)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
