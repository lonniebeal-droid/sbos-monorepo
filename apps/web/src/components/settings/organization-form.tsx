"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateOrganizationAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardContent, CardFooter } from "@/components/ui/card";

interface OrganizationFormProps {
  initial: {
    name: string;
    npi: string;
    phone: string;
    timezone: string;
  };
  disabled?: boolean;
}

export function OrganizationForm({ initial, disabled }: OrganizationFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm({ defaultValues: initial });

  function onSubmit(values: OrganizationFormProps["initial"]) {
    startTransition(async () => {
      const result = await updateOrganizationAction({
        name: values.name,
        npi: values.npi || undefined,
        phone: values.phone || undefined,
        timezone: values.timezone || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input id="org-name" disabled={disabled} {...register("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-npi">Group NPI</Label>
          <Input id="org-npi" disabled={disabled} {...register("npi")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-phone">Phone</Label>
          <Input id="org-phone" disabled={disabled} {...register("phone")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-tz">Time zone</Label>
          <Input id="org-tz" disabled={disabled} {...register("timezone")} />
        </div>
      </CardContent>
      <CardFooter>
        <Button type="submit" disabled={pending || disabled}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </form>
  );
}
