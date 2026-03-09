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
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type ConfigurationField = {
  name: string;
  type: "text" | "password" | "url" | "number" | "email" | "textarea";
  label: string;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  helpText?: string;
};

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
}

export function ServiceCard({ service, onEdit }: ServiceCardProps) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
            <CardDescription>{service.description ?? "No description"}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={service.isActive ? "default" : "secondary"}>
              {service.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">{service.type}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Configuration fields</p>
            <p className="text-sm">{fieldCount} field{fieldCount !== 1 ? "s" : ""} defined</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(service)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
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
