"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "./api";

export type ActionResult = { ok: true } | { ok: false; error: string };

function toError(error: unknown): ActionResult {
  if (error instanceof ApiError) {
    return {
      ok: false,
      error:
        error.status === 503
          ? "The SBOS API is not reachable."
          : error.message,
    };
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

export interface NewClientInput {
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email?: string;
  phone?: string;
  status?: string;
}

export async function createClientAction(
  input: NewClientInput,
): Promise<ActionResult> {
  try {
    await apiFetch("/clients", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export interface NewAppointmentInput {
  clientId: string;
  clinicianId: string;
  type?: string;
  startTime: string;
  durationMinutes: number;
  isTelehealth?: boolean;
}

export async function createAppointmentAction(
  input: NewAppointmentInput,
): Promise<ActionResult> {
  try {
    const start = new Date(input.startTime);
    const end = new Date(start.getTime() + input.durationMinutes * 60_000);
    await apiFetch("/appointments", {
      method: "POST",
      body: JSON.stringify({
        clientId: input.clientId,
        clinicianId: input.clinicianId,
        type: input.type,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes: input.durationMinutes,
        isTelehealth: input.isTelehealth ?? false,
      }),
    });
    revalidatePath("/schedule");
    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export interface GenerateNoteInput {
  type: "BIRP" | "DAP" | "SOAP";
  prompt: string;
  clientId?: string;
}

export type GenerateNoteResult =
  | { ok: true; sections: Record<string, string>; narrative: string }
  | { ok: false; error: string };

export async function generateNoteDraftAction(
  input: GenerateNoteInput,
): Promise<GenerateNoteResult> {
  try {
    const data = await apiFetch<{
      sections: Record<string, string>;
      narrative: string;
    }>("/notes/generate", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return { ok: true, sections: data.sections, narrative: data.narrative };
  } catch (error) {
    const result = toError(error);
    return { ok: false, error: result.ok ? "Failed" : result.error };
  }
}

export interface NewNoteInput {
  clientId: string;
  clinicianId: string;
  type: string;
  title?: string;
  sections?: Record<string, string>;
  requiresCosign?: boolean;
}

export async function createNoteAction(
  input: NewNoteInput,
): Promise<ActionResult> {
  try {
    await apiFetch("/notes", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/notes");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function signNoteAction(noteId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/notes/${noteId}/sign`, { method: "POST" });
    revalidatePath(`/notes/${noteId}`);
    revalidatePath("/notes");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function cosignNoteAction(noteId: string): Promise<ActionResult> {
  try {
    await apiFetch(`/notes/${noteId}/cosign`, { method: "POST" });
    revalidatePath(`/notes/${noteId}`);
    revalidatePath("/notes");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export interface NewTaskInput {
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
}

export async function createTaskAction(
  input: NewTaskInput,
): Promise<ActionResult> {
  try {
    await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export async function updateTaskStatusAction(
  taskId: string,
  status: string,
): Promise<ActionResult> {
  try {
    await apiFetch(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}

export interface UpdateOrganizationInput {
  name?: string;
  npi?: string;
  phone?: string;
  timezone?: string;
}

export async function updateOrganizationAction(
  input: UpdateOrganizationInput,
): Promise<ActionResult> {
  try {
    await apiFetch("/organization", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return toError(error);
  }
}
