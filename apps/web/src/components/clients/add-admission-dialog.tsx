"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { addAdmissionAction } from "@/lib/actions";
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
  program: z.string().min(1, "Program is required"),
  levelOfCare: z.string().optional(),
  status: z.string().optional(),
  admittedAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddAdmissionDialog({ clientId }: { clientId: string }) {
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
    defaultValues: { status: "ADMITTED", levelOfCare: "" },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await addAdmissionAction({
        clientId,
        program: values.program,
        levelOfCare: values.levelOfCare || undefined,
        status: values.status || undefined,
        admittedAt: values.admittedAt || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Admission recorded");
      setOpen(false);
      reset({ program: "", levelOfCare: "", status: "ADMITTED", admittedAt: "" });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" /> Admit to program
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Admit client</DialogTitle>
            <DialogDescription>
              Record a program admission with optional level of care.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="program">Program</Label>
              <Input
                id="program"
                placeholder="Outpatient Behavioral Health"
                {...register("program")}
              />
              {errors.program && (
                <p className="text-xs text-destructive">{errors.program.message}</p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="levelOfCare">Level of care</Label>
                <Input
                  id="levelOfCare"
                  placeholder="IOP / PHP / OP"
                  {...register("levelOfCare")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("status")}
                >
                  <option value="ADMITTED">Admitted</option>
                  <option value="DISCHARGED">Discharged</option>
                  <option value="TRANSFERRED">Transferred</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="admittedAt">Admitted at (optional)</Label>
              <Input id="admittedAt" type="datetime-local" {...register("admittedAt")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Admit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
