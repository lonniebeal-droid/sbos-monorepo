import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const primaryNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Practice overview and today at a glance",
  },
  {
    title: "Schedule",
    href: "/schedule",
    icon: ClipboardList,
    description: "Appointments and clinician availability",
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: CalendarDays,
    description: "Month, week, and day calendar views",
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
    description: "Client roster, charts, and admissions",
  },
  {
    title: "Clinical Notes",
    href: "/notes",
    icon: ClipboardList,
    description: "BIRP, DAP, SOAP, and treatment plans",
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    description: "Claims, invoices, and payments",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListChecks,
    description: "Team action items and follow-ups",
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "Analytics and operational reporting",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Organization, users, and preferences",
  },
];
