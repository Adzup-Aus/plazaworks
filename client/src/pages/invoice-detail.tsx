import { useState, useMemo, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Send, DollarSign, Plus, Trash2, ExternalLink, Briefcase, Copy, Mail, CloudUpload, CheckCircle, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import type { InvoiceWithDetails, Payment, InvoicePayment, Job } from "@shared/schema";

type InvoiceWithDetailsWithQB = InvoiceWithDetails & { quickbooksSynced?: boolean; quickbooksInvoiceId?: string | null };

/** Unified row for display: manual payments (payments) + Stripe/token (invoicePayments), sorted by date */
interface InvoiceTransactionRow {
  id: string;
  date: string | null;
  method: string;
  amount: string;
  reference: string;
  status: string;
  source: "manual" | "stripe";
}

function buildTransactionRows(invoice: InvoiceWithDetails): InvoiceTransactionRow[] {
  const rows: InvoiceTransactionRow[] = [];
  (invoice.payments ?? []).forEach((p: Payment) => {
    const d = p.paidAt ?? p.createdAt;
    rows.push({
      id: `manual-${p.id}`,
      date: d ? new Date(d).toISOString() : null,
      method: (p.paymentMethod ?? "").replace("_", " "),
      amount: String(p.amount ?? "0"),
      reference: p.transactionReference ?? p.notes ?? "",
      status: p.status ?? "completed",
      source: "manual",
    });
  });
  (invoice.invoicePayments ?? []).forEach((p: InvoicePayment) => {
    const d = p.paidAt ?? p.createdAt;
    rows.push({
      id: `stripe-${p.id}`,
      date: d ? new Date(d).toISOString() : null,
      method: (p.paymentMethod ?? "stripe").replace("_", " "),
      amount: String(p.amount ?? "0"),
      reference: p.description ?? "",
      status: p.status ?? "completed",
      source: "stripe",
    });
  });
  rows.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  return rows;
}

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

const paymentFormSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  reference: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const paymentMethods = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

const DEFAULT_TAX_RATE = 10;

const createInvoiceFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().min(1, "Address is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

interface CreateLineItemRow {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

function createEmptyLineItem(): CreateLineItemRow {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "0",
    amount: "0",
  };
}

function getJobIdFromUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("jobId") || undefined;
}

export default function InvoiceDetail() {
  const [location, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [createLineItems, setCreateLineItems] = useState<CreateLineItemRow[]>([createEmptyLineItem()]);
  const jobIdFromUrl = getJobIdFromUrl();

  // Route is /invoices/new (no :id), so params.id is undefined; detect create by path
  const isCreateMode = location === "/invoices/new" || location.startsWith("/invoices/new?");

  const { data: invoice, isLoading } = useQuery<InvoiceWithDetailsWithQB>({
    queryKey: ["/api/invoices", params.id],
    enabled: !isCreateMode,
  });

  const { data: qbStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/quickbooks/status"],
    enabled: !isCreateMode,
  });
  const qbEnabled = qbStatus?.enabled ?? false;
  const canSyncQB = hasPermission("admin_settings");

  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", jobIdFromUrl],
    enabled: !!jobIdFromUrl && isCreateMode,
  });

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: parseFloat(invoice?.amountDue || "0"),
      paymentMethod: "",
      reference: "",
    },
  });

  const createForm = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      dueDate: "",
      notes: "",
    },
  });

  const createSubtotal = useMemo(
    () => createLineItems.reduce((sum, row) => sum + parseFloat(row.amount || "0"), 0),
    [createLineItems]
  );
  const updateLineItem = (id: string, updates: Partial<CreateLineItemRow>) => {
    setCreateLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...updates };
        const qty = parseFloat(next.quantity || "0");
        const unit = parseFloat(next.unitPrice || "0");
        if ("quantity" in updates || "unitPrice" in updates) {
          next.amount = (qty * unit).toFixed(2);
        }
        return next;
      })
    );
  };
  const addLineItem = () => setCreateLineItems((prev) => [...prev, createEmptyLineItem()]);
  const removeLineItem = (id: string) =>
    setCreateLineItems((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  useEffect(() => {
    if (!isCreateMode || !job) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    createForm.reset({
      clientName: job.clientName ?? "",
      clientEmail: job.clientEmail ?? "",
      clientPhone: job.clientPhone ?? "",
      clientAddress: job.address ?? "",
      dueDate: dueDate.toISOString().split("T")[0],
      notes: "",
    });
  }, [isCreateMode, job]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: CreateInvoiceFormValues) => {
      const subtotal = createLineItems.reduce((sum, row) => sum + parseFloat(row.amount || "0"), 0);
      const taxRate = DEFAULT_TAX_RATE;
      const taxAmount = (subtotal * taxRate) / 100;
      const total = subtotal + taxAmount;
      const res = await apiRequest("POST", "/api/invoices", {
        ...(jobIdFromUrl && { jobId: jobIdFromUrl }),
        ...(jobIdFromUrl && job?.clientId && { clientId: job.clientId }),
        clientName: data.clientName,
        clientEmail: data.clientEmail || undefined,
        clientPhone: data.clientPhone || undefined,
        clientAddress: data.clientAddress,
        dueDate: data.dueDate || undefined,
        notes: data.notes || undefined,
        status: "draft",
        subtotal: subtotal.toFixed(2),
        taxRate: String(taxRate),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
        amountPaid: "0",
        amountDue: total.toFixed(2),
      });
      const created = (await res.json()) as { id: string };
      for (let i = 0; i < createLineItems.length; i++) {
        const row = createLineItems[i];
        if (!row.description.trim()) continue;
        const qty = parseFloat(row.quantity) || 0;
        const unit = parseFloat(row.unitPrice) || 0;
        const amt = parseFloat(row.amount) || qty * unit;
        await apiRequest("POST", `/api/invoices/${created.id}/line-items`, {
          description: row.description,
          quantity: String(qty),
          unitPrice: String(unit),
          amount: String(amt),
        });
      }
      return created;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (jobIdFromUrl) {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobIdFromUrl] });
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      }
      toast({ title: "Invoice created" });
      navigate(`/invoices/${data.id}`);
    },
    onError: () => {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/invoices/${params.id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", params.id] });
      toast({ title: "Invoice sent to client" });
    },
  });

  const ensurePaymentLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invoices/${params.id}/payment-link`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", params.id] });
    },
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/invoices/${params.id}/send-payment-link`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", params.id] });
      toast({ title: "Payment link sent to client" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to send payment link", variant: "destructive" });
    },
  });

  const syncQuickBooksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${params.id}/trigger-quickbooks-sync`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { triggered?: boolean; synced?: boolean; message?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? "Sync failed");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", params.id] });
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

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      const response = await apiRequest("POST", `/api/invoices/${params.id}/payments`, {
        amount: data.amount.toFixed(2),
        paymentMethod: data.paymentMethod,
        transactionReference: data.reference,
        status: "completed",
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      
      if (result?.convertedJob) {
        toast({ 
          title: "Payment recorded", 
          description: "Quote has been automatically converted to a job."
        });
      } else {
        toast({ title: "Payment recorded" });
      }
      setPaymentDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to record payment", variant: "destructive" });
    },
  });

  const onPaymentSubmit = (data: PaymentFormValues) => {
    paymentMutation.mutate(data);
  };

  if (!isCreateMode && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCreateMode) {
    const taxAmount = (createSubtotal * DEFAULT_TAX_RATE) / 100;
    const total = createSubtotal + taxAmount;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Create Invoice</h1>
        </div>

        <Form {...createForm}>
          <form
            onSubmit={createForm.handleSubmit((data) => createInvoiceMutation.mutate(data))}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Client</CardTitle>
                <CardDescription>
                  {jobIdFromUrl && job
                    ? "Client is set from the job and cannot be changed"
                    : "Bill-to details"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {jobIdFromUrl && jobLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : jobIdFromUrl && job ? (
                  <>
                    <div className="flex items-center gap-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-sm">
                      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-foreground">{job.clientName || "No client name"}</span>
                    </div>
                    {(job.clientEmail || job.clientPhone || job.address) && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {job.clientEmail && <p>{job.clientEmail}</p>}
                        {job.clientPhone && <p>{job.clientPhone}</p>}
                        {job.address && <p className="whitespace-pre-wrap">{job.address}</p>}
                      </div>
                    )}
                    <input type="hidden" {...createForm.register("clientName")} />
                    <input type="hidden" {...createForm.register("clientEmail")} />
                    <input type="hidden" {...createForm.register("clientPhone")} />
                    <input type="hidden" {...createForm.register("clientAddress")} />
                  </>
                ) : (
                  <>
                    <FormField
                      control={createForm.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client name *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Acme Pty Ltd" data-testid="input-create-client-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="clientEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="billing@acme.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="clientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="+61 2 0000 0000" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="clientAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="123 Main St, Sydney NSW 2000" data-testid="input-create-client-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due date</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Optional notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Line items</CardTitle>
                    <CardDescription>Add description, quantity, unit price and amount</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                    <Plus className="mr-2 h-4 w-4" />
                    Add line
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24 text-right">Qty</TableHead>
                      <TableHead className="w-32 text-right">Unit price</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {createLineItems.map((row) => (
                      <TableRow key={row.id} data-testid={`row-create-line-${row.id}`}>
                        <TableCell>
                          <Input
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) => updateLineItem(row.id, { description: e.target.value })}
                            className="h-9"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-9 text-right"
                            value={row.quantity}
                            onChange={(e) => updateLineItem(row.id, { quantity: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-9 text-right"
                            value={row.unitPrice}
                            onChange={(e) => updateLineItem(row.id, { unitPrice: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-9 text-right"
                            value={row.amount}
                            onChange={(e) => updateLineItem(row.id, { amount: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => removeLineItem(row.id)}
                            data-testid={`button-remove-line-${row.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 border-t pt-4 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>${createSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({DEFAULT_TAX_RATE}%)</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-base">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/invoices")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createInvoiceMutation.isPending} data-testid="button-submit-create-invoice">
                {createInvoiceMutation.isPending ? "Creating…" : "Create invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Invoice Not Found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <Badge className={statusColors[invoice.status] || ""}>
                {statusLabels[invoice.status] || invoice.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{invoice.clientName}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {qbEnabled && canSyncQB && (
            <Button
              variant="outline"
              onClick={() => syncQuickBooksMutation.mutate()}
              disabled={syncQuickBooksMutation.isPending}
              data-testid="button-sync-quickbooks"
            >
              {syncQuickBooksMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="mr-2 h-4 w-4" />
              )}
              {invoice.quickbooksSynced ? "Re-sync to QuickBooks" : "Sync to QuickBooks"}
            </Button>
          )}
          {qbEnabled && !canSyncQB && invoice.quickbooksSynced && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-transparent bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              Synced to QuickBooks
            </span>
          )}
          {invoice.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              data-testid="button-send-invoice"
            >
              <Send className="mr-2 h-4 w-4" />
              Send to Client
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "partially_paid") && (
            <>
              {parseFloat(invoice.amountDue ?? "0") > 0 && (
                <Button
                  disabled={ensurePaymentLinkMutation.isPending}
                  onClick={async () => {
                    try {
                      const updated = await ensurePaymentLinkMutation.mutateAsync();
                      const url = updated?.stripePaymentLinkUrl ?? (updated?.paymentLinkToken && typeof window !== "undefined" ? `${window.location.origin}/pay/${updated.paymentLinkToken}` : null);
                      if (url) {
                        window.open(url, "_blank", "noopener,noreferrer");
                      } else {
                        toast({ title: "No payment link available", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Failed to create payment link", variant: "destructive" });
                    }
                  }}
                  data-testid="button-pay-stripe"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {ensurePaymentLinkMutation.isPending ? "Creating link…" : "Pay with Stripe"}
                </Button>
              )}
              {(invoice.stripePaymentLinkUrl || invoice.paymentLinkToken || parseFloat(invoice.amountDue ?? "0") > 0) && (
                <>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const amountDue = parseFloat(invoice.amountDue ?? "0");
                      if (amountDue > 0) {
                        try {
                          const updated = await ensurePaymentLinkMutation.mutateAsync();
                          const url = (updated?.stripePaymentLinkUrl || (updated?.paymentLinkToken && typeof window !== "undefined" ? `${window.location.origin}/pay/${updated.paymentLinkToken}` : null)) ?? null;
                          if (url) {
                            navigator.clipboard.writeText(url);
                            toast({ title: "Payment link copied" });
                          }
                        } catch {
                          toast({ title: "Failed to create payment link", variant: "destructive" });
                        }
                      } else {
                        const url = invoice.stripePaymentLinkUrl || (invoice.paymentLinkToken && typeof window !== "undefined" ? `${window.location.origin}/pay/${invoice.paymentLinkToken}` : null);
                        if (url) {
                          navigator.clipboard.writeText(url);
                          toast({ title: "Payment link copied" });
                        }
                      }
                    }}
                    disabled={ensurePaymentLinkMutation.isPending}
                    data-testid="button-copy-payment-link"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy payment link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => sendPaymentLinkMutation.mutate()}
                    disabled={sendPaymentLinkMutation.isPending || !invoice.clientEmail}
                    data-testid="button-send-payment-link"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send payment link to client
                  </Button>
                </>
              )}
              <Button
                onClick={() => {
                  form.setValue("amount", parseFloat(invoice.amountDue || "0"));
                  setPaymentDialogOpen(true);
                }}
                data-testid="button-record-payment"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            </>
          )}
          {invoice.jobId && (
            <Button variant="outline" onClick={() => navigate(`/jobs/${invoice.jobId}`)}>
              <Briefcase className="mr-2 h-4 w-4" />
              View Job
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {invoice.clientName}</p>
            {invoice.clientEmail && (
              <p><span className="text-muted-foreground">Email:</span> {invoice.clientEmail}</p>
            )}
            {invoice.clientPhone && (
              <p><span className="text-muted-foreground">Phone:</span> {invoice.clientPhone}</p>
            )}
            {invoice.clientAddress && (
              <p><span className="text-muted-foreground">Address:</span> {invoice.clientAddress}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoice.dueDate && (
              <p><span className="text-muted-foreground">Due Date:</span> {format(new Date(invoice.dueDate), "dd MMM yyyy")}</p>
            )}
            {invoice.sentAt && (
              <p><span className="text-muted-foreground">Sent:</span> {format(new Date(invoice.sentAt), "dd MMM yyyy")}</p>
            )}
            {invoice.paidAt && (
              <p><span className="text-muted-foreground">Paid:</span> {format(new Date(invoice.paidAt), "dd MMM yyyy")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {invoice.lineItems && invoice.lineItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lineItems.map((item) => (
                  <TableRow key={item.id} data-testid={`row-line-item-${item.id}`}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(item.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(item.amount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No line items</p>
          )}

          <div className="mt-4 border-t pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${parseFloat(invoice.subtotal || "0").toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax ({invoice.taxRate || "0"}%)</span>
              <span>${parseFloat(invoice.taxAmount || "0").toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span>Total</span>
              <span className="text-lg">${parseFloat(invoice.total || "0").toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-green-600 dark:text-green-400">
              <span>Paid</span>
              <span>${parseFloat(invoice.amountPaid || "0").toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-medium">
              <span>Amount Due</span>
              <span className="text-lg">${parseFloat(invoice.amountDue || "0").toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>
            All payments for this invoice (manual and Stripe)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const transactions = buildTransactionRows(invoice);
            if (transactions.length === 0) {
              return (
                <p className="text-sm text-muted-foreground py-4">No transactions yet.</p>
              );
            }
            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                      <TableCell>
                        {tx.date ? format(new Date(tx.date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="capitalize">{tx.method || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={tx.reference}>
                        {tx.reference || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.status === "completed" ? "default" : "secondary"}
                          className={
                            tx.status === "completed"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : ""
                          }
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {tx.source === "stripe" ? "Stripe" : "Manual"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${parseFloat(tx.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice {invoice.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onPaymentSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" data-testid="input-payment-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-payment-method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Transaction ID, cheque number, etc." data-testid="input-payment-reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={paymentMutation.isPending} data-testid="button-submit-payment">
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
