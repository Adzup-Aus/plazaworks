import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Building2, FileText, CreditCard, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import type { InvoiceWithDetails, QuotePaymentSchedule } from "@shared/schema";

type InvoiceWithPaymentSchedules = InvoiceWithDetails & {
  paymentSchedules: QuotePaymentSchedule[];
};

export default function InvoicePayment() {
  const params = useParams<{ token: string }>();
  const { toast } = useToast();

  const { data: invoice, isLoading, error, refetch } = useQuery<InvoiceWithPaymentSchedules>({
    queryKey: ["/api/pay", params.token],
    queryFn: async () => {
      const res = await fetch(`/api/pay/${params.token}`);
      if (!res.ok) {
        throw new Error("Invoice not found");
      }
      return res.json();
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (amount: string) => {
      return apiRequest("POST", `/api/pay/${params.token}/payment`, {
        amount,
        paymentMethod: "online",
      });
    },
    onSuccess: () => {
      toast({ title: "Payment successful", description: "Thank you for your payment." });
      refetch();
    },
    onError: () => {
      toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Invoice Not Found</CardTitle>
            <CardDescription>
              This payment link is invalid or has expired. Please contact us if you need assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const depositSchedule = invoice.paymentSchedules?.find(s => s.type === "deposit");
  const amountDue = parseFloat(invoice.amountDue || "0");
  const isPaid = invoice.status === "paid" || amountDue === 0;
  const depositPaid = depositSchedule?.isPaid || (depositSchedule && amountDue === 0);
  
  // Use deposit schedule amount if available, otherwise use amountDue from invoice
  const depositAmount = depositSchedule?.calculatedAmount || invoice.amountDue || "0";

  const formatCurrency = (amount: string | null | undefined) => {
    const num = parseFloat(amount || "0");
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(num);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Building2 className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Invoice Payment</h1>
          <p className="text-muted-foreground">Invoice #{invoice.invoiceNumber}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Invoice Details
                </CardTitle>
                <CardDescription>
                  Due: {invoice.dueDate ? format(new Date(invoice.dueDate), "PPP") : "On receipt"}
                </CardDescription>
              </div>
              <Badge variant={isPaid ? "default" : "secondary"} data-testid="badge-invoice-status">
                {isPaid ? "Paid" : invoice.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Bill To</p>
                <p className="font-medium">{invoice.clientName}</p>
                {invoice.clientEmail && <p className="text-muted-foreground">{invoice.clientEmail}</p>}
                {invoice.clientAddress && <p className="text-muted-foreground">{invoice.clientAddress}</p>}
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Invoice Date</p>
                <p className="font-medium">
                  {invoice.createdAt ? format(new Date(invoice.createdAt), "PPP") : "-"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <p className="font-medium text-muted-foreground text-sm">Line Items</p>
              {invoice.lineItems.map((item, index) => (
                <div key={item.id || index} className="flex justify-between items-start text-sm">
                  <div className="flex-1">
                    <p>{item.description}</p>
                    <p className="text-muted-foreground">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.amount)}</p>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <p className="text-muted-foreground">Subtotal</p>
                <p>{formatCurrency(invoice.subtotal)}</p>
              </div>
              {invoice.taxAmount && parseFloat(invoice.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <p className="text-muted-foreground">GST ({invoice.taxRate}%)</p>
                  <p>{formatCurrency(invoice.taxAmount)}</p>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2">
                <p>Total</p>
                <p>{formatCurrency(invoice.total)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {depositSchedule && !isPaid && (
          <Card className={depositPaid ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Deposit Payment Required
                  </CardTitle>
                  <CardDescription>
                    {depositPaid 
                      ? "Thank you! Your deposit has been received."
                      : "Please pay the deposit to proceed with your project."}
                  </CardDescription>
                </div>
                {depositPaid && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Paid
                  </Badge>
                )}
              </div>
            </CardHeader>
            {!depositPaid && (
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Deposit Amount</span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(depositAmount)}
                    </span>
                  </div>
                  {depositSchedule?.isPercentage && depositSchedule.percentage && (
                    <p className="text-sm text-muted-foreground">
                      ({depositSchedule.percentage}% of total)
                    </p>
                  )}
                </div>
              </CardContent>
            )}
            {!depositPaid && (
              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => paymentMutation.mutate(depositAmount)}
                  disabled={paymentMutation.isPending}
                  data-testid="button-pay-deposit"
                >
                  {paymentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay Deposit {formatCurrency(depositAmount)}
                    </>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        )}

        {!depositSchedule && !isPaid && amountDue > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Amount Due
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(invoice.amountDue)}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                onClick={() => paymentMutation.mutate(invoice.amountDue || "0")}
                disabled={paymentMutation.isPending}
                data-testid="button-pay-balance"
              >
                {paymentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay {formatCurrency(invoice.amountDue)}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {isPaid && !depositSchedule && (
          <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
                <p className="font-bold text-lg">Payment Complete</p>
                <p className="text-muted-foreground">
                  Thank you! This invoice has been paid in full.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {invoice.invoicePayments && invoice.invoicePayments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invoice.invoicePayments.map((payment, index) => (
                  <div key={payment.id || index} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                    <div>
                      <p className="font-medium">{formatCurrency(payment.amount)}</p>
                      <p className="text-muted-foreground text-xs">
                        {payment.paidAt ? format(new Date(payment.paidAt), "PPP") : "Pending"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {payment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Questions about this invoice? Contact us directly.
        </p>
      </div>
    </div>
  );
}
