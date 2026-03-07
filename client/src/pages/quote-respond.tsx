import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, FileText, CheckCircle, XCircle, MessageSquare, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface LineItem {
  id?: string;
  description?: string;
  quantity?: string | number;
  unitPrice?: string;
  amount?: string;
}

interface PaymentScheduleItem {
  name: string;
  type: string;
  amount: string;
  dueWhen?: string;
}

interface QuoteData {
  id: string;
  quoteNumber: string;
  clientName: string;
  jobType?: string;
  description?: string | null;
  total: string;
  subtotal: string;
  taxRate?: string;
  taxAmount?: string;
  validUntil?: string | null;
  status: string;
  clientStatus?: string;
  lineItems: LineItem[];
  paymentSchedules?: PaymentScheduleItem[];
}

export default function QuoteRespond() {
  const params = useParams<{ token: string }>();
  const [result, setResult] = useState<{ action: string; message: string } | null>(null);

  const { data: quote, isLoading, error, refetch } = useQuery<QuoteData>({
    queryKey: ["/api/quote/respond", params.token],
    queryFn: async () => {
      const res = await fetch(`/api/quote/respond/${params.token}`);
      if (!res.ok) throw new Error("Quote not found");
      return res.json();
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (action: "accept" | "reject" | "request_review") => {
      const res = await fetch(`/api/quote/respond/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Request failed");
      return data;
    },
    onSuccess: (data) => {
      setResult({
        action: data.action,
        message:
          data.action === "accept"
            ? "Thank you! The quote has been accepted. We will be in touch with next steps."
            : data.action === "reject"
              ? "The quote has been declined. Thank you for letting us know."
              : "We have received your request for changes. We will review and get back to you.",
      });
      refetch();
    },
    onError: (err: Error) => {
      setResult({ action: "error", message: err.message ?? "Something went wrong. Please try again." });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Quote Not Found</CardTitle>
            <CardDescription>
              This link is invalid or has expired. Please contact us if you need assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const alreadyResponded = quote.clientStatus !== "pending" && quote.clientStatus != null;
  const formatCurrency = (val: string | number | null | undefined): string => {
    const n = typeof val === "number" ? val : parseFloat(String(val ?? "0"));
    return Number.isNaN(n) ? "0.00" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const paymentSchedules = quote.paymentSchedules ?? [];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              <CardTitle>Quote #{quote.quoteNumber}</CardTitle>
            </div>
            <CardDescription>
              Prepared for {quote.clientName}
              {quote.validUntil && (
                <> · Valid until {format(new Date(quote.validUntil), "dd MMM yyyy")}</>
              )}
            </CardDescription>
            <div className="flex justify-between items-baseline pt-2 border-t mt-2">
              <span className="text-sm text-muted-foreground">Quote total</span>
              <span className="text-2xl font-bold">${formatCurrency(quote.total)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {quote.lineItems && quote.lineItems.length > 0 && (
              <>
                <h4 className="text-sm font-medium text-muted-foreground">Line items</h4>
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
                    {quote.lineItems.map((item, i) => (
                      <TableRow key={item.id ?? i}>
                        <TableCell>{item.description ?? "—"}</TableCell>
                        <TableCell className="text-right">{item.quantity ?? "—"}</TableCell>
                        <TableCell className="text-right">${formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right">${formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
            <div className="border-t pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.taxRate != null && quote.taxRate !== "" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({quote.taxRate}%)</span>
                  <span>${formatCurrency(quote.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-1">
                <span>Total</span>
                <span>${formatCurrency(quote.total)}</span>
              </div>
            </div>

            {paymentSchedules.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Payment structure (due details)</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>When due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentSchedules.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-right font-medium">${formatCurrency(s.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{s.dueWhen ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        ${formatCurrency(paymentSchedules.reduce((sum, s) => sum + parseFloat(s.amount) || 0, 0))}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">Equals quote total</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {result ? (
              <div
                className={
                  result.action === "error"
                    ? "rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
                    : "rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-green-700 dark:text-green-400"
                }
              >
                {result.message}
              </div>
            ) : alreadyResponded ? (
              <p className="text-muted-foreground">
                This quote has already been responded to (status: {quote.clientStatus ?? quote.status}).
              </p>
            ) : (
              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  onClick={() => respondMutation.mutate("accept")}
                  disabled={respondMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => respondMutation.mutate("reject")}
                  disabled={respondMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => respondMutation.mutate("request_review")}
                  disabled={respondMutation.isPending}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Request Review
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
