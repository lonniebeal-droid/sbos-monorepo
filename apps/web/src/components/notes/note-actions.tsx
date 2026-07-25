"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cosignNoteAction, signNoteAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function NoteActions({
  noteId,
  status,
}: {
  noteId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    action: (id: string) => Promise<{ ok: boolean; error?: string }>,
    successMessage: string,
  ) {
    startTransition(async () => {
      const result = await action(noteId);
      if (!result.ok) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  }

  if (status === "DRAFT") {
    return (
      <Button
        disabled={pending}
        onClick={() => run(signNoteAction, "Note signed")}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign note
      </Button>
    );
  }

  if (status === "PENDING_COSIGN") {
    return (
      <Button
        disabled={pending}
        onClick={() => run(cosignNoteAction, "Note co-signed")}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Co-sign note
      </Button>
    );
  }

  return null;
}
