"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { addDiagnosisAction } from "@/lib/actions";
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
  icd10Code: z.string().min(1, "ICD-10 code is required"),
  description: z.string().min(1, "Description is required"),
  type: z.string().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddDiagnosisDialog({ clientId }: { clientId: string }) {
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
    defaultValues: { type: "PRIMARY", status: "ACTIVE" },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await addDiagnosisAction({
        clientId,
        icd10Code: values.icd10Code,
        description: values.description,
        type: values.type || undefined,
        status: values.status || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Diagnosis added");
      setOpen(false);
      reset({ icd10Code: "", description: "", type: "PRIMARY", status: "ACTIVE" });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" /> Add diagnosis
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add diagnosis</DialogTitle>
            <DialogDescription>
              Record a diagnosis with ICD-10 code and classification.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dx-code">ICD-10 code</Label>
              <Input id="dx-code" placeholder="F41.1" {...register("icd10Code")} />
              {errors.icd10Code && (
                <p className="text-sm text-destructive">
                  {errors.icd10Code.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dx-desc">Description</Label>
              <Input
                id="dx-desc"
                placeholder="Generalized anxiety disorder"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dx-type">Type</Label>
              <select
                id="dx-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("type")}
              >
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
                <option value="PROVISIONAL">Provisional</option>
                <option value="RULE_OUT">Rule Out</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dx-status">Status</Label>
              <select
                id="dx-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                {...register("status")}
              >
                <option value="ACTIVE">Active</option>
                <option value="RESOLVED">Resolved</option>
                <option value="RULED_OUT">Ruled Out</option>
                <option value="PROVISIONAL">Provisional</option>
              </select>
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
              Add diagnosis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
