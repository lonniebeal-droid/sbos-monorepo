"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateTaskStatusAction } from "@/lib/actions";
import { titleCaseEnum } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface TaskItemData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

function priorityVariant(priority: string) {
  switch (priority) {
    case "URGENT":
      return "destructive" as const;
    case "HIGH":
      return "warning" as const;
    default:
      return "outline" as const;
  }
}

export function TaskItem({ task }: { task: TaskItemData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const done = task.status === "COMPLETED";

  function complete() {
    startTransition(async () => {
      const result = await updateTaskStatusAction(task.id, "COMPLETED");
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Task completed");
      router.refresh();
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground">{task.description}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Badge variant={priorityVariant(task.priority)}>
            {titleCaseEnum(task.priority)}
          </Badge>
          <Badge variant="secondary">{titleCaseEnum(task.status)}</Badge>
        </div>
      </div>
      {!done && (
        <Button size="sm" variant="outline" disabled={pending} onClick={complete}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Complete
        </Button>
      )}
    </div>
  );
}
