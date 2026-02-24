import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface AppSettings {
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

async function fetchSettings(): Promise<AppSettings | null> {
  const res = await fetch("/api/settings", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  return res.json();
}

export function useSettings() {
  const queryClient = useQueryClient();
  const query = useQuery<AppSettings | null>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: fetchSettings,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
