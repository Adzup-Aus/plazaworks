import type { Integration } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TokenDisplay } from "./TokenDisplay";
import { RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface IntegrationCardProps {
  integration: Integration;
  newToken?: string | null; // when just rotated or created, show once
  onRotateSuccess?: (integrationId: string, token: string) => void;
}

export function IntegrationCard({ integration, newToken, onRotateSuccess }: IntegrationCardProps) {
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/integrations/${integration.id}/rotate`, {});
      return res.json();
    },
    onSuccess: (data: { apiToken?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      if (data.apiToken) onRotateSuccess?.(integration.id, data.apiToken);
      toast({ title: "Token rotated", description: "Copy the new token; the old one no longer works." });
      setRotateConfirm(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/integrations/${integration.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({ title: "Integration revoked" });
      setRevokeConfirm(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const isRevoked = integration.status === "revoked";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{integration.name}</CardTitle>
            <CardDescription>{integration.description ?? "No description"}</CardDescription>
          </div>
          <Badge variant={isRevoked ? "secondary" : "default"}>{integration.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Scopes</p>
            <p className="text-sm">{integration.scopes?.join(", ") ?? "—"}</p>
          </div>
          {integration.tokenExpiryDate && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Token expires</p>
              <p className="text-sm">{format(new Date(integration.tokenExpiryDate), "PPp")}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Created</p>
            <p className="text-sm">
              {integration.createdAt ? format(new Date(integration.createdAt), "PPp") : "—"}
            </p>
          </div>
          {newToken && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">API Token (copy now — shown only once)</p>
              <TokenDisplay token={newToken} />
            </div>
          )}
          {!isRevoked && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotateConfirm(true)}
                disabled={rotateMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Rotate Token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevokeConfirm(true)}
                disabled={revokeMutation.isPending}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Revoke
              </Button>
            </div>
          )}
          {isRevoked && integration.revokedAt && (
            <p className="text-sm text-muted-foreground">
              Revoked {format(new Date(integration.revokedAt), "PPp")}
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={rotateConfirm} onOpenChange={setRotateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API token?</AlertDialogTitle>
            <AlertDialogDescription>
              A new token will be generated. The current token will stop working immediately. Make sure to update any apps using this integration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotateMutation.mutate()}>
              Rotate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeConfirm} onOpenChange={setRevokeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately invalidate the API token. The integration cannot be restored; you will need to create a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeMutation.mutate()}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
