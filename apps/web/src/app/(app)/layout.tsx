import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Organization Admin",
  CLINICIAN: "Clinician",
  SUPERVISOR: "Supervisor",
  BILLING: "Billing Specialist",
  FRONT_DESK: "Front Desk",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Sidebar className="hidden md:flex" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={{
            name: session.name,
            email: session.email,
            role: roleLabels[session.role] ?? session.role,
          }}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-muted/30"
          tabIndex={-1}
        >
          <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
