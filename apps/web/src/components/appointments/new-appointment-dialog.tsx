"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createAppointmentAction } from "@/lib/actions";
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

export interface PickerOption {
  id: string;
  name: string;
}

const schema = z.object({
  clientId: z.string().min(1, "Select a client"),
  clinicianId: z.string().min(1, "Select a clinician"),
  type: z.string().min(1),
  startTime: z.string().min(1, "Choose a date and time"),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  isTelehealth: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const APPOINTMENT_TYPES = [
  "INTAKE",
  "INDIVIDUAL",
  "GROUP",
  "FAMILY",
  "COUPLES",
  "MEDICATION_MANAGEMENT",
  "ASSESSMENT",
  "TELEHEALTH",
  "CONSULTATION",
];

export function NewAppointmentDialog({
  clients,
  clinicians,
}: {
  clients: PickerOption[];
  clinicians: PickerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const disabled = clients.length === 0 || clinicians.length === 0;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "INDIVIDUAL", durationMinutes: 50 },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createAppointmentAction({
        clientId: values.clientId,
        clinicianId: values.clinicianId,
        type: values.type,
        startTime: values.startTime,
        durationMinutes: values.durationMinutes,
        isTelehealth: values.isTelehealth,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Appointment scheduled");
      setOpen(false);
      reset({ type: "INDIVIDUAL", durationMinutes: 50 });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New appointment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New appointment</DialogTitle>
            <DialogDescription>
              Schedule a session. Conflicts with the clinician&apos;s calendar
              are rejected automatically.
            </DialogDescription>
          </DialogHeader>

          {disabled ? (
            <p className="my-4 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
              Add at least one client and clinician (with a live database) before
              scheduling.
            </p>
          ) : (
            <div className="my-4 grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Client</Label>
                <select
                  id="clientId"
                  className={cn(selectClass)}
                  {...register("clientId")}
                >
                  <option value="">Select a client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clientId && (
                  <p className="text-sm text-destructive">
                    {errors.clientId.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="clinicianId">Clinician</Label>
                <select
                  id="clinicianId"
                  className={cn(selectClass)}
                  {...register("clinicianId")}
                >
                  <option value="">Select a clinician…</option>
                  {clinicians.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.clinicianId && (
                  <p className="text-sm text-destructive">
                    {errors.clinicianId.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select id="type" className={cn(selectClass)} {...register("type")}>
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    {...register("durationMinutes")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Date &amp; time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  {...register("startTime")}
                />
                {errors.startTime && (
                  <p className="text-sm text-destructive">
                    {errors.startTime.message}
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("isTelehealth")} />
                Telehealth session
              </label>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || disabled}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
