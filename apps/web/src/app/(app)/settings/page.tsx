import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/dashboard/page-header";
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

const team = [
  { name: "Alex Administrator", email: "admin@sbos.health", role: "Organization Admin" },
  { name: "Dr. Riley Chen", email: "clinician@sbos.health", role: "Clinician" },
  { name: "Dr. Sofia Alvarez", email: "s.alvarez@sbos.health", role: "Clinician" },
  { name: "Morgan Lee", email: "billing@sbos.health", role: "Billing Specialist" },
];

export default async function SettingsPage() {
  const session = await getSession();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your organization, team, and preferences."
      />

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
                <Input id="org-name" defaultValue="Success Brand Behavioral Health" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-npi">Group NPI</Label>
                <Input id="org-npi" defaultValue="1093847561" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-phone">Phone</Label>
                <Input id="org-phone" defaultValue="(555) 018-2200" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-tz">Time zone</Label>
                <Input id="org-tz" defaultValue="America/New_York" />
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
              {team.map((member) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="secondary">{member.role}</Badge>
                </div>
              ))}
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
