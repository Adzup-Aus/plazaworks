import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Role } from "@shared/schema";

interface InviteRow {
  id: string;
  email: string;
  roleId?: string | null;
  roleName?: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  invitedBy: string;
}

export default function Invite() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | undefined>();

  const { data: adminStatus, isLoading: adminLoading } = useQuery<{ isSuperAdmin: boolean }>({
    queryKey: ["/api/auth/is-super-admin"],
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    enabled: !!adminStatus?.isSuperAdmin,
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery<{ invites: InviteRow[] }>({
    queryKey: ["/api/invites"],
    enabled: !!adminStatus?.isSuperAdmin,
  });

  const createInvite = useMutation({
    mutationFn: async (payload: { email: string; roleId: string }) => {
      const res = await apiRequest("POST", "/api/invites", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to send invite");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invites"] });
      setEmail("");
      setRoleId(undefined);
      toast({ title: "Invitation sent", description: "The user will receive an email with a link to set their password." });
    },
    onError: (err: Error) => {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast({ title: "Enter an email address", variant: "destructive" });
      return;
    }
    if (!roleId) {
      toast({ title: "Select a role", variant: "destructive" });
      return;
    }
    createInvite.mutate({ email: trimmed, roleId });
  };

  if (adminLoading || !adminStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminStatus.isSuperAdmin) {
    navigate("/");
    return null;
  }

  const invites = invitesData?.invites ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invite users</h1>
        <p className="text-muted-foreground">Send an email invite so new users can set a password and join.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Send invite
          </CardTitle>
          <CardDescription>Enter an email address. They will receive a link to set their password (valid 7 days).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={createInvite.isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={roleId}
                  onValueChange={setRoleId}
                  disabled={createInvite.isPending || rolesLoading}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue placeholder={rolesLoading ? "Loading roles..." : "Select a role"} />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={createInvite.isPending || rolesLoading || !roles?.length}>
              {createInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send invite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invites</CardTitle>
          <CardDescription>Pending and past invites.</CardDescription>
        </CardHeader>
        <CardContent>
          {invitesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No invites yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(inv.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell>{inv.roleName ?? "—"}</TableCell>
                    <TableCell>{inv.usedAt ? "Accepted" : new Date(inv.expiresAt) < new Date() ? "Expired" : "Pending"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
