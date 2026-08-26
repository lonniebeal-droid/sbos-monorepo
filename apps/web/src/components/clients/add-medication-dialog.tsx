"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { addMedicationAction } from "@/lib/actions";
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

const schema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  route: z.string().optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddMedicationDialog({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await addMedicationAction({
        clientId,
        name: values.name,
        dosage: values.dosage || undefined,
        frequency: values.frequency || undefined,
        route: values.route || undefined,
        startDate: values.startDate || undefined,
        notes: values.notes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Medication added");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" /> Add medication
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add medication</DialogTitle>
            <DialogDescription>
              Record a current or past medication for this client.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="med-name">Medication name</Label>
              <Input id="med-name" placeholder="Sertraline" {...register("name")} />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-dosage">Dosage</Label>
              <Input id="med-dosage" placeholder="50 mg" {...register("dosage")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-frequency">Frequency</Label>
              <Input
                id="med-frequency"
                placeholder="Once daily"
                {...register("frequency")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-route">Route</Label>
              <Input id="med-route" placeholder="Oral" {...register("route")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-start">Start date</Label>
              <Input id="med-start" type="date" {...register("startDate")} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="med-notes">Notes</Label>
              <Input
                id="med-notes"
                placeholder="Additional notes (optional)"
                {...register("notes")}
              />
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
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add medication
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
