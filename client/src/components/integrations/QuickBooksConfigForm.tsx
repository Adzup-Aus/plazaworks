import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuickBooksConnectionStatus {
  configured: boolean;
  connected: boolean;
  realmId: string | null;
  enabledAt: string | null;
}

interface QuickBooksConfigFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickBooksConfigForm({ open, onOpenChange }: QuickBooksConfigFormProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: status, isLoading: statusLoading } = useQuery<QuickBooksConnectionStatus>({
    queryKey: ["/api/quickbooks/connection"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open,
  });

  const { data: redirectUriData } = useQuery<{ redirectUri: string }>({
    queryKey: ["/api/quickbooks/redirect-uri"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/quickbooks/connection", { clientId, clientSecret });
    },
    onSuccess: async (_, __, context: { url?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/connection"] });
      toast({ title: "Credentials saved" });
      if (context?.url) {
        window.location.href = context.url;
      }
    },
    onError: (e: Error) => {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    },
  });

  const startOAuthMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/quickbooks/oauth/start");
      const data = (await res.json()) as { url?: string };
      return data;
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (e: Error) => {
      toast({ title: "Failed to start OAuth", description: e.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/quickbooks/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/connection"] });
      toast({ title: "Disconnected from QuickBooks" });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to disconnect", description: e.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({ title: "Client ID and Client Secret are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const handleConnect = () => {
    if (!status?.configured) {
      toast({ title: "Save Client ID and Client Secret first", variant: "destructive" });
      return;
    }
    startOAuthMutation.mutate();
  };

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams(window.location.search);
    const qb = params.get("quickbooks");
    const message = params.get("message");
    if (qb === "connected") {
      toast({ title: "Connected to QuickBooks" });
      queryClient.invalidateQueries({ queryKey: ["/api/quickbooks/connection"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (qb === "error" && message) {
      toast({ title: "QuickBooks error", description: message, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [open, toast, queryClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QuickBooks configuration</DialogTitle>
          <DialogDescription>
            Enter your Intuit app Client ID and Client Secret, then connect to your QuickBooks company.
          </DialogDescription>
        </DialogHeader>
        {redirectUriData?.redirectUri && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium text-muted-foreground mb-1">Add this Redirect URI in your Intuit app (Keys & OAuth → Redirect URIs)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all select-all rounded bg-background px-2 py-1.5 text-xs">
                {redirectUriData.redirectUri}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(redirectUriData.redirectUri);
                  toast({ title: "Redirect URI copied to clipboard" });
                }}
              >
                Copy
              </Button>
            </div>
            <p className="mt-1.5 text-muted-foreground text-xs">It must match exactly in Intuit—use Copy to avoid typos.</p>
          </div>
        )}
        <details className="rounded-md border bg-muted/30 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">Troubleshooting</summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
            <li><strong>“undefined didn&apos;t connect”</strong>: <strong>Development</strong> keys only work with <strong>sandbox</strong> companies. If you sign in with a real QuickBooks company, use <strong>Production</strong> keys (requires app approval). Create a sandbox company at developer.intuit.com to test with Development keys.</li>
            <li>Ensure your Intuit app has an <strong>App Name</strong> in developer.intuit.com → Your app → Profile. Add the Redirect URI to the same section as your keys (Development or Production).</li>
          </ul>
        </details>
        {statusLoading ? (
          <div className="py-4 text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-4 py-2">
            {status?.connected && (
              <p className="text-sm text-green-600 dark:text-green-400">Connected to QuickBooks</p>
            )}
            {status?.configured && !status?.connected && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Reconnect QuickBooks to sync invoices. Your connection may have expired.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="qb-client-id">Client ID</Label>
              <Input
                id="qb-client-id"
                type="text"
                placeholder="From developer.intuit.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qb-client-secret">Client Secret</Label>
              <Input
                id="qb-client-secret"
                type="password"
                placeholder="From developer.intuit.com"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !clientId.trim() || !clientSecret.trim()}
          >
            {saveMutation.isPending ? "Saving…" : "Save credentials"}
          </Button>
          {status?.configured && (
            <>
              <Button
                variant="secondary"
                onClick={handleConnect}
                disabled={startOAuthMutation.isPending || status.connected}
              >
                {status.connected ? "Connected" : startOAuthMutation.isPending ? "Redirecting…" : "Reconnect QuickBooks"}
              </Button>
              {status.connected && (
                <Button
                  variant="destructive"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  Disconnect
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
