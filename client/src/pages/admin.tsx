import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  CreditCard, 
  Settings, 
  Search, 
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Briefcase,
  Clock,
  Edit,
  Trash2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  isOwner: boolean;
  createdAt: string;
}

interface Subscription {
  id: string;
  organizationId: string;
  tier: string;
  status: string;
  maxUsers: number;
  maxJobs: number;
  billingPeriod?: string;
  currentPeriodEnd?: string;
}

export default function Admin() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/organizations"],
  });

  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Organization> }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Organization updated" });
      setIsEditDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/organizations/${id}/subscription`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      toast({ title: "Subscription updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredOrgs = organizations?.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         org.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "active" && org.isActive) ||
                         (filterStatus === "inactive" && !org.isActive);
    return matchesSearch && matchesStatus;
  }) || [];

  const stats = {
    total: organizations?.length || 0,
    active: organizations?.filter(o => o.isActive).length || 0,
    owners: organizations?.filter(o => o.isOwner).length || 0,
    customers: organizations?.filter(o => !o.isOwner).length || 0,
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary">
        <XCircle className="mr-1 h-3 w-3" />
        Inactive
      </Badge>
    );
  };

  const getTypeBadge = (type: string, isOwner: boolean) => {
    if (isOwner) {
      return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Primary Owner</Badge>;
    }
    return <Badge variant="outline">{type}</Badge>;
  };

  if (orgsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-admin-title">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage all organizations and subscriptions</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-orgs">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Organizations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-orgs">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                <Building2 className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-owner-orgs">{stats.owners}</p>
                <p className="text-sm text-muted-foreground">Primary Owner(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-customer-orgs">{stats.customers}</p>
                <p className="text-sm text-muted-foreground">Customer Businesses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>View and manage all registered businesses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-orgs"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgs.map((org) => (
                    <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-sm text-muted-foreground">/{org.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(org.type, org.isOwner)}</TableCell>
                      <TableCell>{getStatusBadge(org.isActive)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {org.email && <p>{org.email}</p>}
                          {org.phone && <p className="text-muted-foreground">{org.phone}</p>}
                          {!org.email && !org.phone && <span className="text-muted-foreground">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedOrg(org);
                              setIsEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-org-${org.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization details and subscription
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="subscription">Subscription</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={selectedOrg.name}
                    onChange={(e) => setSelectedOrg({ ...selectedOrg, name: e.target.value })}
                    data-testid="input-edit-org-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={selectedOrg.email || ""}
                    onChange={(e) => setSelectedOrg({ ...selectedOrg, email: e.target.value })}
                    data-testid="input-edit-org-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={selectedOrg.phone || ""}
                    onChange={(e) => setSelectedOrg({ ...selectedOrg, phone: e.target.value })}
                    data-testid="input-edit-org-phone"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-active"
                    checked={selectedOrg.isActive}
                    onChange={(e) => setSelectedOrg({ ...selectedOrg, isActive: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-org-active"
                  />
                  <Label htmlFor="is-active">Active</Label>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => updateOrgMutation.mutate({
                      id: selectedOrg.id,
                      data: {
                        name: selectedOrg.name,
                        email: selectedOrg.email,
                        phone: selectedOrg.phone,
                        isActive: selectedOrg.isActive,
                      },
                    })}
                    disabled={updateOrgMutation.isPending}
                    data-testid="button-save-org"
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </TabsContent>
              
              <TabsContent value="subscription" className="space-y-4">
                <div className="space-y-2">
                  <Label>Subscription Tier</Label>
                  <Select
                    defaultValue="starter"
                    onValueChange={(tier) => {
                      const limits: Record<string, { maxUsers: number; maxJobs: number }> = {
                        starter: { maxUsers: 3, maxJobs: 50 },
                        professional: { maxUsers: 15, maxJobs: 500 },
                        scale: { maxUsers: -1, maxJobs: -1 },
                      };
                      updateSubscriptionMutation.mutate({
                        id: selectedOrg.id,
                        data: { tier, ...limits[tier] },
                      });
                    }}
                    data-testid="select-subscription-tier"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (Free)</SelectItem>
                      <SelectItem value="professional">Professional ($99/mo)</SelectItem>
                      <SelectItem value="scale">Scale ($249/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-md bg-muted p-4">
                  <h4 className="font-medium mb-2">Tier Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Starter: 3 users, 50 jobs/month, basic features</li>
                    <li>Professional: 15 users, 500 jobs/month, quotes & invoices</li>
                    <li>Scale: Unlimited users & jobs, full analytics</li>
                  </ul>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
