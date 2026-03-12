import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ServiceDialog } from "@/components/integrations/ServiceForm";
import { QuickBooksConfigForm } from "@/components/integrations/QuickBooksConfigForm";
import type { QuickBooksConnectionStatus } from "@/components/integrations/ServiceCard";
import { ArrowLeft, Pencil, Trash2, Link2, Link2Off } from "lucide-react";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type QuickBooksSyncLogEntry = {
  id: string;
  quickbooks_connection_id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export default function ServiceDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [quickbooksConfigOpen, setQuickbooksConfigOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [syncLogStatusFilter, setSyncLogStatusFilter] = useState<string>("all");

  const { data: service, isLoading: serviceLoading, error: serviceError } = useQuery<Service>({
    queryKey: ["/api/services", id],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  const isQuickBooks = service?.type === "quickbooks";

  const { data: quickbooksStatus } = useQuery<QuickBooksConnectionStatus>({
    queryKey: ["/api/quickbooks/connection"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!isQuickBooks,
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
    enabled: !!isQuickBooks,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service deleted" });
      setDeleteConfirm(false);
      setLocation("/integrations");
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const openEdit = useCallback(() => {
    if (!service) return;
    if (service.type === "quickbooks") {
      setQuickbooksConfigOpen(true);
    } else {
      setServiceDialogOpen(true);
    }
  }, [service]);

  const handleQuickBooksConfigOpenChange = useCallback(
    (open: boolean) => {
      setQuickbooksConfigOpen(open);
      if (!open) {
        queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/connection"] });
      }
    },
    [queryClient]
  );

  if (!id) {
    setLocation("/integrations");
    return null;
  }

  if (serviceLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (serviceError || !service) {
    return (
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/integrations")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Integrations
          </Button>
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            <p>Service not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => setLocation("/integrations")}>
              Back to Integrations
            </Button>
          </div>
        </div>
      );
  }

  const qbStatus = isQuickBooks ? quickbooksStatus : undefined;
  const qbConnected = qbStatus?.connected ?? false;
  const qbConfigured = qbStatus?.configured ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/integrations")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Integrations
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">{service.name}</CardTitle>
            <CardDescription>
              {isQuickBooks
                ? "Sync invoices and payments to QuickBooks Online. Connect once to enable one-way sync."
                : service.description ?? "No description"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isQuickBooks && qbStatus !== undefined && (
              <Badge
                variant={qbConnected ? "default" : "secondary"}
                className={cn(
                  qbConnected &&
                    "bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-700 dark:hover:bg-emerald-700/90"
                )}
              >
                {qbConnected ? (
                  <>
                    <Link2 className="mr-1 h-3 w-3" />
                    Connected
                  </>
                ) : qbConfigured ? (
                  <>
                    <Link2Off className="mr-1 h-3 w-3" />
                    Not connected
                  </>
                ) : (
                  "Not configured"
                )}
              </Badge>
            )}
            <Badge variant={service.isActive ? "default" : "secondary"}>
              {service.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">{service.type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{format(new Date(service.createdAt), "PPp")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd>{format(new Date(service.updatedAt), "PPp")}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2 pt-2">
            {isQuickBooks ? (
              <Button
                size="sm"
                onClick={openEdit}
                variant={!qbConfigured || !qbConnected ? "default" : "outline"}
              >
                {!qbConfigured
                  ? "Configure QuickBooks"
                  : !qbConnected
                    ? "Connect to QuickBooks"
                    : "Settings"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Logs</h3>
        {isQuickBooks ? (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={syncLogStatusFilter} onValueChange={setSyncLogStatusFilter}>
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
                        <TableCell>{format(new Date(entry.created_at), "PPp")}</TableCell>
                        <TableCell className="capitalize">{entry.entity_type}</TableCell>
                        <TableCell
                          className="font-mono text-xs truncate max-w-[120px]"
                          title={entry.entity_id}
                        >
                          {entry.entity_id}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.status === "succeeded" ? "default" : "destructive"}
                          >
                            {entry.status === "succeeded" ? "Succeeded" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="text-muted-foreground text-xs max-w-[320px] truncate"
                          title={entry.error_message ?? undefined}
                        >
                          {entry.error_message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No logs available for this service type.
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{service.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        service={service}
      />
      <QuickBooksConfigForm
        open={quickbooksConfigOpen}
        onOpenChange={handleQuickBooksConfigOpenChange}
      />
    </div>
  );
}
