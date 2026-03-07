import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Briefcase } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SuccessDetails = {
  invoiceNumber: string;
  amountPaid: string;
  jobCreated: boolean;
  jobId?: string;
  jobNumber?: string;
};

export default function PaymentSuccess() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");

  const { data: details, isLoading, isError } = useQuery<SuccessDetails>({
    queryKey: ["/api/pay/success-details", sessionId ?? ""],
    queryFn: async () => {
      const res = await fetch(`/api/pay/success-details?session_id=${encodeURIComponent(sessionId ?? "")}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: Boolean(sessionId?.trim()),
  });

  const formatCurrency = (amount: string) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(parseFloat(amount || "0"));

  if (sessionId && isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading payment details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle>Payment successful</CardTitle>
          <CardDescription>
            {details ? (
              <>
                Thank you, your payment has been received.
                <span className="mt-2 block font-medium text-foreground">
                  Invoice #{details.invoiceNumber} · {formatCurrency(details.amountPaid)}
                </span>
                {details.jobCreated && details.jobNumber && (
                  <span className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    Your job has been created: {details.jobNumber}
                  </span>
                )}
              </>
            ) : (
              <>
                Thank you, your payment has been received.
                {sessionId && isError && (
                  <span className="mt-2 block text-xs text-muted-foreground break-all">
                    Reference: {sessionId}
                  </span>
                )}
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can safely close this page now. If you have any questions about your invoice or job,
            please contact us.
          </p>
          <Button asChild className="w-full">
            <Link href="/">Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

