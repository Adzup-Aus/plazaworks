import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Integration, Scope, Service } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateIntegrationDialog } from "@/components/integrations/CreateIntegrationDialog";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { ServiceCard } from "@/components/integrations/ServiceCard";
import { ServiceDialog } from "@/components/integrations/ServiceForm";
import { Plus, ExternalLink } from "lucide-react";
import { getQueryFn } from "@/lib/queryClient";

export default function Integrations() {
  const [createOpen, setCreateOpen] = useState(false);
  const [rotatedToken, setRotatedToken] = useState<{ id: string; token: string } | null>(null);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data: integrations, isLoading: integrationsLoading } = useQuery<Integration[]>({
    queryKey: ["/api/integrations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: scopes } = useQuery<Scope[]>({
    queryKey: ["/api/scopes"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const openCreateService = () => {
    setEditingService(null);
    setServiceDialogOpen(true);
  };

  const openEditService = (service: Service) => {
    setEditingService(service);
    setServiceDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations Center</h1>
          <p className="text-muted-foreground">
            Manage API integrations, tokens, and outbound services.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/docs" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View API docs
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create integration
            </Button>
          </div>
          {integrationsLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !integrations || integrations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="mb-4">No integrations yet.</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first integration
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {integrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  newToken={rotatedToken?.id === integration.id ? rotatedToken.token : undefined}
                  onRotateSuccess={(id, token) => setRotatedToken({ id, token })}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="services" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreateService}>
              <Plus className="mr-2 h-4 w-4" />
              Add service
            </Button>
          </div>
          {servicesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !services || services.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="mb-4">No outbound services configured yet.</p>
              <Button onClick={openCreateService}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first service
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onEdit={openEditService}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateIntegrationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        scopes={scopes ?? []}
      />
      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        service={editingService}
      />
    </div>
  );
}
