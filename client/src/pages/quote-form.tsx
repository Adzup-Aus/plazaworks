import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2, Send, Check, X, ArrowRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuoteWithLineItems, Job } from "@shared/schema";

const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be positive"),
  unitPrice: z.coerce.number().min(0, "Unit price must be non-negative"),
});

const jobTypes = [
  "plumbing",
  "renovation",
  "waterproofing",
  "tiling",
  "electrical",
  "carpentry",
  "general",
] as const;

const jobTypeLabels: Record<string, string> = {
  plumbing: "Plumbing",
  renovation: "Renovation",
  waterproofing: "Waterproofing",
  tiling: "Tiling",
  electrical: "Electrical",
  carpentry: "Carpentry",
  general: "General",
};

const quoteFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  clientAddress: z.string().min(1, "Address is required"),
  jobType: z.enum(jobTypes, { required_error: "Job type is required" }),
  description: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  lineItems: z.array(lineItemSchema),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function QuoteForm() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEdit = !!params.id;

  const { data: quote, isLoading } = useQuery<QuoteWithLineItems>({
    queryKey: ["/api/quotes", params.id],
    enabled: isEdit,
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      jobType: undefined,
      description: "",
      validUntil: "",
      notes: "",
      taxRate: 10,
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  useEffect(() => {
    if (quote) {
      const validJobType = jobTypes.includes(quote.jobType as typeof jobTypes[number]) 
        ? quote.jobType as typeof jobTypes[number]
        : undefined;
      form.reset({
        clientName: quote.clientName || "",
        clientEmail: quote.clientEmail || "",
        clientPhone: quote.clientPhone || "",
        clientAddress: quote.clientAddress || "",
        jobType: validJobType,
        description: quote.description || "",
        validUntil: quote.validUntil || "",
        notes: quote.notes || "",
        taxRate: parseFloat(quote.taxRate || "10"),
        lineItems: quote.lineItems?.length
          ? quote.lineItems.map((item) => ({
              id: item.id,
              description: item.description,
              quantity: parseFloat(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
            }))
          : [{ description: "", quantity: 1, unitPrice: 0 }],
      });
    }
  }, [quote, form]);

  const createMutation = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      const { lineItems, ...quoteData } = data;
      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taxAmount = subtotal * ((data.taxRate || 0) / 100);
      const total = subtotal + taxAmount;

      const response = await apiRequest("POST", "/api/quotes", {
        ...quoteData,
        taxRate: (data.taxRate || 10).toString(),
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      });
      const newQuote = await response.json();

      for (const item of lineItems) {
        if (item.description.trim()) {
          await apiRequest("POST", `/api/quotes/${newQuote.id}/line-items`, {
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            amount: (item.quantity * item.unitPrice).toFixed(2),
          });
        }
      }

      return newQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote created successfully" });
      navigate("/quotes");
    },
    onError: () => {
      toast({ title: "Failed to create quote", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      const { lineItems, ...quoteData } = data;
      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      const taxAmount = subtotal * ((data.taxRate || 0) / 100);
      const total = subtotal + taxAmount;

      await apiRequest("PATCH", `/api/quotes/${params.id}`, {
        ...quoteData,
        taxRate: (data.taxRate || 10).toString(),
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: total.toFixed(2),
      });

      // Delete existing line items and recreate
      if (quote?.lineItems) {
        for (const item of quote.lineItems) {
          await apiRequest("DELETE", `/api/line-items/${item.id}`);
        }
      }

      for (const item of lineItems) {
        if (item.description.trim()) {
          await apiRequest("POST", `/api/quotes/${params.id}/line-items`, {
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            amount: (item.quantity * item.unitPrice).toFixed(2),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote updated successfully" });
      navigate("/quotes");
    },
    onError: () => {
      toast({ title: "Failed to update quote", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote sent to client" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote accepted" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote rejected" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/convert-to-job`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Quote converted to job" });
      navigate("/jobs");
    },
    onError: () => {
      toast({ title: "Quote must be accepted first", variant: "destructive" });
    },
  });

  const onSubmit = (data: QuoteFormValues) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const watchedLineItems = form.watch("lineItems");
  const watchedTaxRate = form.watch("taxRate") || 0;
  const subtotal = watchedLineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );
  const taxAmount = subtotal * (watchedTaxRate / 100);
  const total = subtotal + taxAmount;

  if (isEdit && isLoading) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {isEdit ? (quote?.quoteNumber || "Edit Quote") : "New Quote"}
              </h1>
              {quote?.status && (
                <Badge className={statusColors[quote.status] || ""}>
                  {quote.status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Edit quote details" : "Create a new quote for a client"}
            </p>
          </div>
        </div>

        {isEdit && quote && (
          <div className="flex flex-wrap gap-2">
            {quote.status === "draft" && (
              <Button
                variant="outline"
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                data-testid="button-send-quote"
              >
                <Send className="mr-2 h-4 w-4" />
                Send to Client
              </Button>
            )}
            {quote.status === "sent" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  data-testid="button-accept-quote"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending}
                  data-testid="button-reject-quote"
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {quote.status === "accepted" && !quote.convertedToJobId && (
              <Button
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                data-testid="button-convert-to-job"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Convert to Job
              </Button>
            )}
          </div>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter client name" data-testid="input-client-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="client@example.com" data-testid="input-client-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter phone number" data-testid="input-client-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter address" data-testid="input-client-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quote Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="jobType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-job-type">
                            <SelectValue placeholder="Select job type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {jobTypeLabels[type]}
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
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-valid-until" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Describe the work..." data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Line Items</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
                data-testid="button-add-line-item"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="flex-1 min-w-[200px]">
                        {index === 0 && <FormLabel>Description</FormLabel>}
                        <FormControl>
                          <Input {...field} placeholder="Item description" data-testid={`input-line-item-description-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        {index === 0 && <FormLabel>Qty</FormLabel>}
                        <FormControl>
                          <Input {...field} type="number" step="0.01" data-testid={`input-line-item-qty-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lineItems.${index}.unitPrice`}
                    render={({ field }) => (
                      <FormItem className="w-28">
                        {index === 0 && <FormLabel>Unit Price</FormLabel>}
                        <FormControl>
                          <Input {...field} type="number" step="0.01" data-testid={`input-line-item-price-${index}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="w-28 text-right">
                    {index === 0 && <div className="text-sm font-medium mb-2">Amount</div>}
                    <div className="h-9 flex items-center justify-end text-sm">
                      ${((watchedLineItems[index]?.quantity || 0) * (watchedLineItems[index]?.unitPrice || 0)).toFixed(2)}
                    </div>
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      data-testid={`button-remove-line-item-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Tax</span>
                    <FormField
                      control={form.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem className="w-16">
                          <FormControl>
                            <Input {...field} type="number" step="0.1" className="h-7 text-xs" data-testid="input-tax-rate" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Total</span>
                  <span className="text-lg">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes for the client..." data-testid="input-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/quotes")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-quote"
            >
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? "Update Quote" : "Create Quote"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
