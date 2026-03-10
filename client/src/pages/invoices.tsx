import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, FileText, Send, MoreHorizontal, Trash2, DollarSign, Copy, Mail, CheckCircle, CloudUpload, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Invoice, Job } from "@shared/schema";
import { PermissionGate } from "@/components/permission-gate";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type InvoiceWithQB = Invoice & { quickbooksSynced?: boolean; quickbooksInvoiceId?: string | null };

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  partially_paid: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export default function Invoices() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [, setLocation] = useLocation();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncingQBInvoiceId, setSyncingQBInvoiceId] = useState<string | null>(null);
  const [newInvoiceDialogOpen, setNewInvoiceDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>("");

  const { data: invoices, isLoading } = useQuery<InvoiceWithQB[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: qbStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/quickbooks/status"],
  });
  const qbEnabled = qbStatus?.enabled ?? false;
  const canSyncQB = hasPermission("admin_settings");

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: newInvoiceDialogOpen,
  });

  const openCreateInvoiceForm = (jobId?: string) => {
    setNewInvoiceDialogOpen(false);
    setSelectedJobId("");
    setLocation(jobId ? `/invoices/new?jobId=${jobId}` : "/invoices/new");
  };

  const sendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/invoices/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice sent to client" });
    },
    onError: () => {
      toast({ title: "Failed to send invoice", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice deleted" });
      setDeleteId(null);
    },
  });

  const ensurePaymentLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/invoices/${id}/payment-link`);
      return res.json() as Promise<Invoice>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/invoices/${id}/send-payment-link`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Payment link sent to client" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to send payment link", variant: "destructive" });
    },
  });

  const syncQuickBooksMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}/trigger-quickbooks-sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { triggered?: boolean; synced?: boolean; message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Sync failed");
      }
      return data;
    },
    onMutate: (invoiceId) => {
      setSyncingQBInvoiceId(invoiceId);
    },
    onSettled: () => {
      setSyncingQBInvoiceId(null);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/status"] });
      if (data.triggered) {
        toast({ title: "QuickBooks sync triggered" });
      } else if (data.synced === false && data.message) {
        toast({
          title: "Could not sync to QuickBooks",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Sync failed";
      toast({ title: msg, variant: "destructive" });
    },
  });

  function getPaymentLinkUrl(invoice: Invoice): string | null {
    if (invoice.stripePaymentLinkUrl) return invoice.stripePaymentLinkUrl;
    if (invoice.paymentLinkToken && typeof window !== "undefined") {
      return `${window.location.origin}/pay/${invoice.paymentLinkToken}`;
    }
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage invoices and track payments
          </p>
        </div>
        <PermissionGate permission="create_invoices">
          <Button
            data-testid="button-new-invoice"
            onClick={() => setNewInvoiceDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </PermissionGate>
      </div>

      {invoices?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No invoices yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first invoice to get started
            </p>
            <PermissionGate permission="create_invoices">
              <Button
                className="mt-4"
                data-testid="button-create-first-invoice"
                onClick={() => setNewInvoiceDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </PermissionGate>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {invoices?.map((invoice) => (
            <Card key={invoice.id} className="flex flex-col" data-testid={`card-invoice-${invoice.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base font-medium">
                    {invoice.invoiceNumber}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {qbEnabled && (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1">
                            {invoice.quickbooksSynced && (
                              <span className="text-green-600 dark:text-green-400" aria-hidden>
                                <CheckCircle className="h-4 w-4" />
                              </span>
                            )}
                            {canSyncQB ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => syncQuickBooksMutation.mutate(invoice.id)}
                                disabled={syncingQBInvoiceId !== null}
                                aria-label={invoice.quickbooksSynced ? "Re-sync to QuickBooks" : "Sync to QuickBooks"}
                              >
                                {syncingQBInvoiceId === invoice.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CloudUpload className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              !invoice.quickbooksSynced && (
                                <span className="text-muted-foreground" aria-hidden>
                                  <CloudUpload className="h-4 w-4" />
                                </span>
                              )
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {invoice.quickbooksSynced
                            ? (canSyncQB ? "Synced. Click to re-sync latest updates." : "Synced to QuickBooks")
                            : (canSyncQB ? "Sync to QuickBooks" : "Not synced to QuickBooks")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <Badge className={statusColors[invoice.status] || ""}>
                    {statusLabels[invoice.status] || invoice.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium">
                      ${parseFloat(invoice.total || "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      ${parseFloat(invoice.amountPaid || "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Due</span>
                    <span className="font-medium">
                      ${parseFloat(invoice.amountDue || "0").toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {invoice.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      Due {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 pt-2">
                  <Link href={`/invoices/${invoice.id}`}>
                    <Button variant="outline" size="sm" data-testid={`button-view-invoice-${invoice.id}`}>
                      View
                    </Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-invoice-actions-${invoice.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {invoice.status === "draft" && (
                        <DropdownMenuItem
                          onClick={() => sendMutation.mutate(invoice.id)}
                          data-testid={`action-send-invoice-${invoice.id}`}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send to Client
                        </DropdownMenuItem>
                      )}
                      {(invoice.status === "sent" || invoice.status === "partially_paid") && (
                        <DropdownMenuItem asChild>
                          <Link href={`/invoices/${invoice.id}?addPayment=true`}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Record Payment
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {(getPaymentLinkUrl(invoice) || (parseFloat(invoice.amountDue ?? "0") > 0 && (invoice.status === "sent" || invoice.status === "partially_paid"))) && (
                        <>
                          <DropdownMenuItem
                            onClick={async () => {
                              const amountDue = parseFloat(invoice.amountDue ?? "0");
                              if (amountDue > 0) {
                                try {
                                  const updated = await ensurePaymentLinkMutation.mutateAsync(invoice.id);
                                  const url = getPaymentLinkUrl(updated) ?? (updated.stripePaymentLinkUrl || (updated.paymentLinkToken && typeof window !== "undefined" ? `${window.location.origin}/pay/${updated.paymentLinkToken}` : null));
                                  if (url) {
                                    navigator.clipboard.writeText(url);
                                    toast({ title: "Payment link copied" });
                                  }
                                } catch {
                                  toast({ title: "Failed to create payment link", variant: "destructive" });
                                }
                              } else {
                                const url = getPaymentLinkUrl(invoice);
                                if (url) {
                                  navigator.clipboard.writeText(url);
                                  toast({ title: "Payment link copied" });
                                }
                              }
                            }}
                            disabled={ensurePaymentLinkMutation.isPending}
                            data-testid={`action-copy-payment-link-${invoice.id}`}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy payment link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => sendPaymentLinkMutation.mutate(invoice.id)}
                            disabled={sendPaymentLinkMutation.isPending || !invoice.clientEmail}
                            data-testid={`action-send-payment-link-${invoice.id}`}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Send payment link to client
                          </DropdownMenuItem>
                        </>
                      )}
                      <PermissionGate permission="delete_invoices">
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(invoice.id)}
                            data-testid={`action-delete-invoice-${invoice.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={newInvoiceDialogOpen} onOpenChange={setNewInvoiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
            <DialogDescription>
              Create a blank invoice or generate one from an existing job. When you select a job, client and details are pre-filled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Job (optional)</label>
              <Select value={selectedJobId || "_none"} onValueChange={(v) => setSelectedJobId(v === "_none" ? "" : v)}>
                <SelectTrigger data-testid="select-new-invoice-job">
                  <SelectValue placeholder="No job — create blank invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No job — create blank invoice</SelectItem>
                  {(jobs ?? []).map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.jobNumber ?? job.id} — {job.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => openCreateInvoiceForm()}
              data-testid="button-new-invoice-blank"
            >
              Create blank invoice
            </Button>
            <Button
              onClick={() => openCreateInvoiceForm(selectedJobId || undefined)}
              data-testid="button-new-invoice-confirm"
            >
              {selectedJobId ? "Create from job" : "Create blank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
