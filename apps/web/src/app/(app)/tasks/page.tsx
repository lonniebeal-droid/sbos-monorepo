import { ListChecks } from "lucide-react";

import { tryApiFetch, type Paginated } from "@/lib/api";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner, EmptyState } from "@/components/dashboard/api-state";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskItem, type TaskItemData } from "@/components/tasks/task-item";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const res = await tryApiFetch<Paginated<TaskItemData>>("/tasks?limit=100");
  const tasks = res.ok ? res.data.data : [];
  const open = tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const done = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Team action items and follow-ups."
        actions={<NewTaskDialog />}
      />

      {!res.ok && <ApiErrorBanner message={res.error} />}

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6 text-muted-foreground" />}
          title="No tasks yet"
          description="Create a task to track follow-ups, co-signs, and billing work."
        />
      ) : (
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Open ({open.length})
            </h2>
            {open.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Nothing open — nice work.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {open.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            )}
          </section>

          {done.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Completed ({done.length})
              </h2>
              <div className="space-y-2">
                {done.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

