import { getSession } from "@/lib/session";
import { tryApiFetch, type Paginated } from "@/lib/api";
import { fullName, titleCaseEnum } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiErrorBanner } from "@/components/dashboard/api-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata = { title: "Settings" };

interface Organization {
  name: string;
  npi: string | null;
  phone: string | null;
  timezone: string;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default async function SettingsPage() {
  const session = await getSession();
  const [orgRes, teamRes] = await Promise.all([
    tryApiFetch<Organization>("/organization"),
    tryApiFetch<Paginated<TeamMember>>("/users?limit=50"),
  ]);

  const org = orgRes.ok ? orgRes.data : null;
  const team = teamRes.ok ? teamRes.data.data : [];

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your organization, team, and preferences."
      />

      {!orgRes.ok && <ApiErrorBanner message={orgRes.error} />}

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization details</CardTitle>
              <CardDescription>
                These details appear on client-facing documents and claims.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input id="org-name" defaultValue={org?.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-npi">Group NPI</Label>
                <Input id="org-npi" defaultValue={org?.npi ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Phone</Label>
                <Input id="org-phone" defaultValue={org?.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-tz">Time zone</Label>
                <Input id="org-tz" defaultValue={org?.timezone ?? ""} />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader>
              <CardTitle>Team members</CardTitle>
              <CardDescription>People with access to this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {team.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No team members to display.
                </p>
              ) : (
                team.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{fullName(member)}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <Badge variant="secondary">{titleCaseEnum(member.role)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline">Invite member</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Your profile</CardTitle>
              <CardDescription>Update your personal information.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input id="profile-name" defaultValue={session?.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  defaultValue={session?.email ?? ""}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save profile</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
