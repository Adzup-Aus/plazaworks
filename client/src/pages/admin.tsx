import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AppSettings {
  id: string;
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  timezone: string | null;
  autoConvertApprovedQuotes: boolean;
  autoCreateJobFromInvoice: boolean;
  defaultTaxRate: string | null;
  defaultPaymentTermsDays: number | null;
  quoteNumberPrefix: string | null;
  invoiceNumberPrefix: string | null;
  jobNumberPrefix: string | null;
  defaultQuoteTerms: string | null;
  defaultInvoiceTerms: string | null;
  featuresEnabled: string[] | null;
  maxUsers: number | null;
  maxJobsPerMonth: number | null;
}

const SETTINGS_QUERY_KEY = ["/api/settings"];

export default function Admin() {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<AppSettings>>({});

  const { data: settings, isLoading } = useQuery<AppSettings | null>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/settings", { credentials: "include" });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const body = await res.json();
      if (body && !form.companyName) setForm(body);
      return body;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      setForm(updated);
      toast({ title: "Settings saved" });
    },
    onError: (err: unknown) => {
      toast({
        title: "Failed to save",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const current = { ...settings, ...form };

  const handleSave = () => {
    updateMutation.mutate({
      companyName: current.companyName,
      companyAddress: current.companyAddress ?? undefined,
      companyPhone: current.companyPhone ?? undefined,
      companyEmail: current.companyEmail ?? undefined,
      companyWebsite: current.companyWebsite ?? undefined,
      timezone: current.timezone ?? undefined,
      autoConvertApprovedQuotes: current.autoConvertApprovedQuotes,
      autoCreateJobFromInvoice: current.autoCreateJobFromInvoice,
      defaultTaxRate: current.defaultTaxRate ?? undefined,
      defaultPaymentTermsDays: current.defaultPaymentTermsDays ?? undefined,
      quoteNumberPrefix: current.quoteNumberPrefix ?? undefined,
      invoiceNumberPrefix: current.invoiceNumberPrefix ?? undefined,
      jobNumberPrefix: current.jobNumberPrefix ?? undefined,
      defaultQuoteTerms: current.defaultQuoteTerms ?? undefined,
      defaultInvoiceTerms: current.defaultInvoiceTerms ?? undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-admin-title">
          Admin – Settings
        </h1>
        <p className="text-muted-foreground">Global application settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Company &amp; numbering
          </CardTitle>
          <CardDescription>Company details and quote/invoice/job number prefixes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={current.companyName ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Company email</Label>
              <Input
                id="companyEmail"
                type="email"
                value={current.companyEmail ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, companyEmail: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyAddress">Address</Label>
            <Textarea
              id="companyAddress"
              value={current.companyAddress ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, companyAddress: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Phone</Label>
              <Input
                id="companyPhone"
                value={current.companyPhone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, companyPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Website</Label>
              <Input
                id="companyWebsite"
                value={current.companyWebsite ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, companyWebsite: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="jobNumberPrefix">Job number prefix</Label>
              <Input
                id="jobNumberPrefix"
                value={current.jobNumberPrefix ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, jobNumberPrefix: e.target.value }))}
                placeholder="J-"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quoteNumberPrefix">Quote number prefix</Label>
              <Input
                id="quoteNumberPrefix"
                value={current.quoteNumberPrefix ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, quoteNumberPrefix: e.target.value }))}
                placeholder="Q-"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNumberPrefix">Invoice number prefix</Label>
              <Input
                id="invoiceNumberPrefix"
                value={current.invoiceNumberPrefix ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, invoiceNumberPrefix: e.target.value }))}
                placeholder="INV-"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRate">Default tax rate (%)</Label>
              <Input
                id="defaultTaxRate"
                value={current.defaultTaxRate ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, defaultTaxRate: e.target.value }))}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPaymentTermsDays">Default payment terms (days)</Label>
              <Input
                id="defaultPaymentTermsDays"
                type="number"
                value={current.defaultPaymentTermsDays ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    defaultPaymentTermsDays: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder="14"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="autoConvertApprovedQuotes"
                checked={current.autoConvertApprovedQuotes ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, autoConvertApprovedQuotes: v }))}
              />
              <Label htmlFor="autoConvertApprovedQuotes">Auto-convert approved quotes to jobs</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="autoCreateJobFromInvoice"
                checked={current.autoCreateJobFromInvoice ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, autoCreateJobFromInvoice: v }))}
              />
              <Label htmlFor="autoCreateJobFromInvoice">Auto-create job from invoice</Label>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            {updateMutation.isPending ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
