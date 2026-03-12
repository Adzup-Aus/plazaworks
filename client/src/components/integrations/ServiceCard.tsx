import type { Service } from "@shared/schema";
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
import { Pencil, Trash2, Link2, Link2Off } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type ConfigurationField = {
  name: string;
  type: "text" | "password" | "url" | "number" | "email" | "textarea";
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
};

export interface QuickBooksConnectionStatus {
  configured: boolean;
  connected: boolean;
  realmId: string | null;
  enabledAt: string | null;
}

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
  /** When service.type === "quickbooks", pass connection status to show Connected / Not connected and primary CTA */
  quickbooksConnectionStatus?: QuickBooksConnectionStatus | null;
  /** Optional callback to open service detail page (details and logs) */
  onViewDetails?: (service: Service) => void;
}

export function ServiceCard({ service, onEdit, quickbooksConnectionStatus, onViewDetails }: ServiceCardProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isQuickBooks = service.type === "quickbooks";
  const qbStatus = isQuickBooks ? quickbooksConnectionStatus : undefined;
  const qbConnected = qbStatus?.connected ?? false;
  const qbConfigured = qbStatus?.configured ?? false;

  const fields = (service.configurationFields ?? []) as ConfigurationField[];
  const fieldCount = Array.isArray(fields) ? fields.length : 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/services/${service.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service deleted" });
      setDeleteConfirm(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">{service.name}</CardTitle>
            <CardDescription>
              {isQuickBooks
                ? "Sync invoices and payments to QuickBooks Online. Connect once to enable one-way sync."
                : service.description ?? "No description"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isQuickBooks && qbStatus !== undefined && (
              <Badge
                variant={qbConnected ? "default" : "secondary"}
                className={cn(
                  qbConnected &&
                    "bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-700 dark:hover:bg-emerald-700/90"
                )}
              >
                {qbConnected ? (
                  <>
                    <Link2 className="mr-1 h-3 w-3" />
                    Connected
                  </>
                ) : qbConfigured ? (
                  <>
                    <Link2Off className="mr-1 h-3 w-3" />
                    Not connected
                  </>
                ) : (
                  "Not configured"
                )}
              </Badge>
            )}
            <Badge variant={service.isActive ? "default" : "secondary"}>
              {service.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">{service.type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isQuickBooks && qbStatus !== undefined ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              {qbConnected
                ? "Invoices and payments sync to QuickBooks when created or updated. Delete on platform voids in QuickBooks."
                : qbConfigured
                  ? "Save credentials and complete OAuth to start syncing. Reconnect if the connection has expired."
                  : "Add your Intuit app Client ID and Client Secret, then connect to your QuickBooks company."}
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Configuration fields</p>
              <p className="text-sm">
                {fieldCount} field{fieldCount !== 1 ? "s" : ""} defined
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {onViewDetails && (
              <Button size="sm" variant="outline" onClick={() => onViewDetails(service)}>
                View details
              </Button>
            )}
            {isQuickBooks ? (
              <>
                <Button
                  size="sm"
                  onClick={() => onEdit(service)}
                  variant={!qbConfigured || !qbConnected ? "default" : "outline"}
                >
                  {!qbConfigured
                    ? "Configure QuickBooks"
                    : !qbConnected
                      ? "Connect to QuickBooks"
                      : "Settings"}
                </Button>
                {qbConnected && onViewDetails && (
                  <Button size="sm" variant="ghost" onClick={() => onViewDetails(service)}>
                    View sync history
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onEdit(service)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete service?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{service.name}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
