import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Integration, Scope, Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateIntegrationDialog } from "@/components/integrations/CreateIntegrationDialog";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import {
  ServiceCard,
  type QuickBooksConnectionStatus,
} from "@/components/integrations/ServiceCard";
import { ServiceDialog } from "@/components/integrations/ServiceForm";
import { QuickBooksConfigForm } from "@/components/integrations/QuickBooksConfigForm";
import { Plus, ExternalLink } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type QuickBooksSyncLogEntry = {
  id: string;
  quickbooks_connection_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export default function Integrations() {
  const [createOpen, setCreateOpen] = useState(false);
  const [rotatedToken, setRotatedToken] = useState<{ id: string; token: string } | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [quickbooksConfigOpen, setQuickbooksConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("integrations");
  const [syncLogStatusFilter, setSyncLogStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: integrations, isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: scopes } = useQuery<Scope[]>({
    queryKey: ["/api/scopes"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const hasQuickBooksService = (services ?? []).some((s) => s.type === "quickbooks");

  const { data: quickbooksStatus } = useQuery<QuickBooksConnectionStatus>({
    queryKey: ["/api/quickbooks/connection"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: hasQuickBooksService,
  });

  const statusParam =
    syncLogStatusFilter === "succeeded" || syncLogStatusFilter === "failed"
      ? syncLogStatusFilter
      : undefined;
  const syncLogUrl =
    statusParam != null
      ? `/api/quickbooks/sync-log?limit=50&status=${encodeURIComponent(statusParam)}`
      : "/api/quickbooks/sync-log?limit=50";
  const { data: syncLogEntries, isLoading: syncLogLoading } = useQuery<QuickBooksSyncLogEntry[]>({
    queryKey: ["/api/quickbooks/sync-log", syncLogStatusFilter],
    queryFn: () =>
      fetch(syncLogUrl, { credentials: "include" }).then((r) => {
        if (r.status === 401) throw new Error("Unauthorized");
        return r.json();
      }),
    enabled: hasQuickBooksService && activeTab === "sync-status",
  });

  const openCreateService = () => {
    setEditingService(null);
    setServiceDialogOpen(true);
  };

  const openEditService = useCallback(
    (service: Service) => {
      if (service.type === "quickbooks") {
        setQuickbooksConfigOpen(true);
        return;
      }
      setEditingService(service);
      setServiceDialogOpen(true);
    },
    []
  );

  const handleQuickBooksConfigOpenChange = useCallback(
    (open: boolean) => {
      setQuickbooksConfigOpen(open);
      if (!open) {
        queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/connection"] });
      }
    },
    [queryClient]
  );

  const openSyncHistory = useCallback(() => {
    setActiveTab("sync-status");
    queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/sync-log"] });
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations Center</h1>
          <p className="text-muted-foreground">
            Manage API integrations, tokens, and outbound services.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View API docs
            </a>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          {hasQuickBooksService && (
            <TabsTrigger value="sync-status">Sync status</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create integration
            </Button>
          </div>
          {integrationsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !integrations || integrations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="mb-4">No integrations yet.</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first integration
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  newToken={rotatedToken?.id === integration.id ? rotatedToken.token : undefined}
                  onRotateSuccess={(id, token) => setRotatedToken({ id, token })}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="services" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreateService}>
              <Plus className="mr-2 h-4 w-4" />
              Add service
            </Button>
          </div>
          {servicesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !services || services.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="mb-4">No outbound services configured yet.</p>
              <Button onClick={openCreateService}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first service
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onEdit={openEditService}
                  quickbooksConnectionStatus={
                    service.type === "quickbooks" ? quickbooksStatus ?? undefined : undefined
                  }
                  onViewSyncHistory={openSyncHistory}
                />
              ))}
            </div>
          )}
        </TabsContent>
        {hasQuickBooksService && (
          <TabsContent value="sync-status" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center gap-4">
              <h3 className="text-lg font-medium">QuickBooks sync history</h3>
              <Select
                value={syncLogStatusFilter}
                onValueChange={setSyncLogStatusFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {syncLogLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : !syncLogEntries || syncLogEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                No sync runs yet. Syncs are recorded when invoices or payments are sent to QuickBooks.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="max-w-[320px]">Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.created_at), "PPp")}
                        </TableCell>
                        <TableCell className="capitalize">{entry.entity_type}</TableCell>
                        <TableCell className="font-mono text-xs truncate max-w-[120px]" title={entry.entity_id}>
                          {entry.entity_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant={entry.status === "succeeded" ? "default" : "destructive"}>
                            {entry.status === "succeeded" ? "Succeeded" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs max-w-[320px] truncate" title={entry.error_message ?? undefined}>
                          {entry.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      <CreateIntegrationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        scopes={scopes ?? []}
      />
      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        service={editingService}
      />
      <QuickBooksConfigForm
        open={quickbooksConfigOpen}
        onOpenChange={handleQuickBooksConfigOpenChange}
      />
    </div>
  );
}
