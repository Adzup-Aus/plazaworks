import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Send, Check, X, ArrowRight, Edit, FileText, User, Calendar, DollarSign, AlertTriangle, RotateCcw, History, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { QuoteWithLineItems, Quote } from "@shared/schema";
import type { Invoice } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function QuoteView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);

  const { data: quote, isLoading } = useQuery<QuoteWithLineItems>({
    queryKey: ["/api/quotes", params.id],
  });

  const { data: revisionHistory } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", params.id, "revisions"],
    enabled: showRevisionHistory,
  });

  const { data: convertedInvoice } = useQuery<Invoice>({
    queryKey: ["/api/invoices", quote?.convertedToInvoiceId],
    enabled: Boolean(quote?.convertedToInvoiceId),
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", params.id] });
      toast({ title: "Quote sent to client" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", params.id] });
      toast({ title: "Quote accepted" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", params.id] });
      toast({ title: "Quote rejected" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${params.id}/convert-to-job`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Quote converted to job" });
      navigate("/jobs");
    },
    onError: () => {
      toast({ title: "Quote must be accepted first", variant: "destructive" });
    },
  });

  const revisionMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await apiRequest("POST", `/api/quotes/${params.id}/revise`, { revisionReason: reason });
      return response.json();
    },
    onSuccess: (newQuote: Quote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ 
        title: "Revision created", 
        description: `New quote ${newQuote.quoteNumber} created. Redirecting to edit...` 
      });
      setShowRevisionDialog(false);
      setRevisionReason("");
      navigate(`/quotes/${newQuote.id}/edit`);
    },
    onError: () => {
      toast({ title: "Failed to create revision", variant: "destructive" });
    },
  });

  const handleEditClick = () => {
    if (quote?.status && quote.status !== "draft") {
      setShowRevisionDialog(true);
    } else {
      navigate(`/quotes/${params.id}/edit`);
    }
  };

  const handleConfirmEdit = () => {
    setShowEditWarning(false);
    navigate(`/quotes/${params.id}/edit`);
  };

  const handleCreateRevision = () => {
    if (!revisionReason.trim()) {
      toast({ title: "Please enter a reason for the revision", variant: "destructive" });
      return;
    }
    revisionMutation.mutate(revisionReason);
  };

  if (isLoading) {
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

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Quote not found</p>
        <Button variant="ghost" onClick={() => navigate("/quotes")}>
          Return to quotes
        </Button>
      </div>
    );
  }

  const subtotal = parseFloat(quote.subtotal || "0");
  const taxAmount = parseFloat(quote.taxAmount || "0");
  const total = parseFloat(quote.total || "0");

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
                {quote.quoteNumber || "Quote"}
              </h1>
              <Badge className={statusColors[quote.status] || ""}>
                {quote.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Quote document view
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quote.revisionNumber && quote.revisionNumber > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRevisionHistory(true)}
              data-testid="button-revision-history"
            >
              <History className="mr-2 h-4 w-4" />
              Rev {quote.revisionNumber}
            </Button>
          )}
          
          <Button
            variant="outline"
            onClick={handleEditClick}
            data-testid="button-edit-quote"
          >
            {quote.status === "draft" ? (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Edit Quote
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Revise Quote
              </>
            )}
          </Button>
          
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
      </div>

      {quote.status === "accepted" && quote.convertedToInvoiceId && (
        <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoice created
            </CardTitle>
            <CardDescription>
              {convertedInvoice ? (
                <>
                  Invoice {convertedInvoice.invoiceNumber} was created with the same reference number.
                  {convertedInvoice.stripePaymentLinkUrl ? (
                    <span className="block mt-2">Send the payment link to the client. After payment, a job will be created automatically.</span>
                  ) : convertedInvoice.paymentLinkToken ? (
                    <span className="block mt-2">Share the payment page with the client. After payment, a job will be created automatically.</span>
                  ) : null}
                </>
              ) : (
                "An invoice was created for this quote."
              )}
            </CardDescription>
          </CardHeader>
          {convertedInvoice && (
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/invoices/${quote.convertedToInvoiceId}`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View invoice
              </Button>
              {convertedInvoice.stripePaymentLinkUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(convertedInvoice.stripePaymentLinkUrl!);
                      toast({ title: "Payment link copied" });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy payment link
                  </Button>
                  <Button
                    size="sm"
                    asChild
                  >
                    <a href={convertedInvoice.stripePaymentLinkUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Pay with Stripe
                    </a>
                  </Button>
                </>
              )}
              {!convertedInvoice.stripePaymentLinkUrl && convertedInvoice.paymentLinkToken && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`${typeof window !== "undefined" ? window.location.origin : ""}/pay/${convertedInvoice.paymentLinkToken}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open payment page
                  </a>
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Client Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p className="text-sm" data-testid="text-client-name">{quote.clientName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm" data-testid="text-client-email">{quote.clientEmail || "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="text-sm" data-testid="text-client-phone">{quote.clientPhone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <p className="text-sm" data-testid="text-client-address">{quote.clientAddress || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quote Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valid Until</p>
              <p className="text-sm" data-testid="text-valid-until">
                {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tax Rate</p>
              <p className="text-sm" data-testid="text-tax-rate">{quote.taxRate}%</p>
            </div>
          </div>
          {quote.description && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm" data-testid="text-description">{quote.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Line Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.lineItems && quote.lineItems.length > 0 ? (
            <>
              <div className="space-y-4">
                {quote.lineItems.map((item, index) => (
                  <div key={item.id} className="border rounded-md p-4" data-testid={`line-item-${index}`}>
                    {item.heading && (
                      <h4 className="font-medium mb-2">{item.heading}</h4>
                    )}
                    <p className="text-sm mb-2">{item.description}</p>
                    {item.richDescription && (
                      <div 
                        className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none mb-2"
                        dangerouslySetInnerHTML={{ __html: item.richDescription }}
                      />
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.quantity} x ${parseFloat(item.unitPrice).toFixed(2)}
                      </span>
                      <span className="font-medium">${parseFloat(item.amount).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({quote.taxRate}%)</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span data-testid="text-total">${total.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No line items</p>
          )}
        </CardContent>
      </Card>

      {quote.termsOfTradeContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Terms of Trade
            </CardTitle>
            <CardDescription>
              Terms and conditions for this quote
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: quote.termsOfTradeContent }}
              data-testid="text-terms-content"
            />
          </CardContent>
        </Card>
      )}

      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm" data-testid="text-notes">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Create Quote Revision
            </DialogTitle>
            <DialogDescription>
              This will create a new revision of the quote, preserving the original for reference. 
              The new revision will be opened for editing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="revision-reason">Reason for revision</Label>
              <Textarea
                id="revision-reason"
                placeholder="Enter the reason for this revision (e.g., 'Client requested price adjustment', 'Updated scope of work')"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                rows={3}
                data-testid="input-revision-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRevisionDialog(false)}
              data-testid="button-cancel-revision"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateRevision}
              disabled={revisionMutation.isPending || !revisionReason.trim()}
              data-testid="button-create-revision"
            >
              {revisionMutation.isPending ? "Creating..." : "Create Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevisionHistory} onOpenChange={setShowRevisionHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Revision History
            </DialogTitle>
            <DialogDescription>
              All versions of this quote, from earliest to latest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {revisionHistory?.map((rev, index) => (
              <div 
                key={rev.id}
                className={`p-3 rounded-lg border ${rev.id === quote.id ? 'border-primary bg-muted/50' : 'hover-elevate cursor-pointer'}`}
                onClick={() => {
                  if (rev.id !== quote.id) {
                    navigate(`/quotes/${rev.id}`);
                    setShowRevisionHistory(false);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant={rev.id === quote.id ? "default" : "outline"}>
                      Rev {rev.revisionNumber || 1}
                    </Badge>
                    <span className="font-medium">{rev.quoteNumber}</span>
                    <Badge className={statusColors[rev.status] || ""}>
                      {rev.status}
                    </Badge>
                    {rev.id === quote.id && (
                      <Badge variant="secondary">Current</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ''}
                  </span>
                </div>
                {rev.revisionReason && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Reason: {rev.revisionReason}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRevisionHistory(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Edit Sent Quote?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This quote has already been sent to the client. Editing it may cause 
              inconsistencies if the client has already viewed or responded to the original quote.
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-edit">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEdit} data-testid="button-confirm-edit">
              Continue Editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
