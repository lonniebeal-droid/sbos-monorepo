import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserNav, type UserNavProps } from "@/components/dashboard/user-nav";

export function Header({ user }: { user: UserNavProps }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      <MobileNav />
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search clients, appointments, notes…"
          className="pl-9"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserNav {...user} />
      </div>
    </header>
  );
}
