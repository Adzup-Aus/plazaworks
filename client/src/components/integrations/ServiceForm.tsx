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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { Service } from "@shared/schema";
import type { ConfigurationField } from "./ServiceCard";

const FIELD_TYPES: ConfigurationField["type"][] = [
  "text",
  "password",
  "url",
  "number",
  "email",
  "textarea",
];

const emptyField = (): ConfigurationField => ({
  name: "",
  type: "text",
  label: "",
  required: false,
  placeholder: "",
  defaultValue: "",
  helpText: "",
});

export interface ServiceFormValues {
  name: string;
  type: string;
  description: string;
  configurationFields: ConfigurationField[];
}

function toFormValues(service: Service | null): ServiceFormValues {
  if (!service) {
    return {
      name: "",
      type: "",
      description: "",
      configurationFields: [emptyField()],
    };
  }
  const fields = (service.configurationFields ?? []) as ConfigurationField[];
  return {
    name: service.name,
    type: service.type,
    description: service.description ?? "",
    configurationFields:
      Array.isArray(fields) && fields.length > 0
        ? fields.map((f) => ({
            name: f.name ?? "",
            type: (f.type ?? "text") as ConfigurationField["type"],
            label: f.label ?? "",
            required: Boolean(f.required),
            placeholder: f.placeholder ?? "",
            defaultValue: f.defaultValue ?? "",
            helpText: f.helpText ?? "",
          }))
        : [emptyField()],
  };
}

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null; // null = create, non-null = edit
}

export function ServiceDialog({ open, onOpenChange, service }: ServiceDialogProps) {
  const isEdit = !!service;
  const [form, setForm] = useState<ServiceFormValues>(() => toFormValues(service));
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(toFormValues(service));
  }, [open, service]);

  const resetForm = () => setForm(toFormValues(service));

  const createMutation = useMutation({
    mutationFn: async (body: ServiceFormValues) => {
      const res = await apiRequest("POST", "/api/services", {
        name: body.name.trim(),
        type: body.type.trim(),
        description: body.description.trim() || undefined,
        configurationFields: body.configurationFields
          .filter((f) => f.name.trim() || f.label.trim())
          .map((f) => ({
            name: f.name.trim() || f.label.trim().toLowerCase().replace(/\s+/g, "_"),
            type: f.type,
            label: f.label.trim() || f.name.trim(),
            required: f.required,
            placeholder: f.placeholder.trim() || undefined,
            defaultValue: f.defaultValue.trim() || undefined,
            helpText: f.helpText.trim() || undefined,
          })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service created" });
      onOpenChange(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (body: ServiceFormValues) => {
      const res = await apiRequest("PATCH", `/api/services/${service!.id}`, {
        name: body.name.trim(),
        type: body.type.trim(),
        description: body.description.trim() || undefined,
        configurationFields: body.configurationFields
          .filter((f) => f.name.trim() || f.label.trim())
          .map((f) => ({
            name: f.name.trim() || f.label.trim().toLowerCase().replace(/\s+/g, "_"),
            type: f.type,
            label: f.label.trim() || f.name.trim(),
            required: f.required,
            placeholder: f.placeholder.trim() || undefined,
            defaultValue: f.defaultValue.trim() || undefined,
            helpText: f.helpText.trim() || undefined,
          })),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service updated" });
      onOpenChange(false);
      resetForm();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm();
    }
    onOpenChange(next);
  };

  const updateField = (index: number, patch: Partial<ConfigurationField>) => {
    setForm((prev) => ({
      ...prev,
      configurationFields: prev.configurationFields.map((f, i) =>
        i === index ? { ...f, ...patch } : f
      ),
    }));
  };

  const addField = () => {
    setForm((prev) => ({
      ...prev,
      configurationFields: [...prev.configurationFields, emptyField()],
    }));
  };

  const removeField = (index: number) => {
    setForm((prev) => ({
      ...prev,
      configurationFields: prev.configurationFields.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!form.type.trim()) {
      toast({ title: "Service type is required", variant: "destructive" });
      return;
    }
    const validFields = form.configurationFields.filter((f) => f.name.trim() || f.label.trim());
    if (validFields.length === 0) {
      toast({ title: "Add at least one configuration field", variant: "destructive" });
      return;
    }
    if (isEdit) {
      updateMutation.mutate({ ...form, configurationFields: validFields });
    } else {
      createMutation.mutate({ ...form, configurationFields: validFields });
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit service" : "Add service"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update outbound service configuration and fields."
              : "Add an outbound service (e.g. Slack, webhook) with configurable fields."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Name</Label>
              <Input
                id="service-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Slack"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-type">Service type</Label>
              <Input
                id="service-type"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                placeholder="e.g. slack, webhook"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-desc">Description (optional)</Label>
            <Input
              id="service-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What this service is for"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Configuration fields</Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="mr-2 h-4 w-4" />
                Add field
              </Button>
            </div>
            <div className="space-y-3 rounded-md border p-3 max-h-64 overflow-y-auto">
              {form.configurationFields.map((field, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 items-start rounded border p-2 bg-muted/30"
                >
                  <div className="col-span-4 space-y-1">
                    <Input
                      placeholder="Field name (key)"
                      value={field.name}
                      onChange={(e) => updateField(index, { name: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Select
                      value={field.type}
                      onValueChange={(v) => updateField(index, { type: v as ConfigurationField["type"] })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Input
                      placeholder="Label"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex items-center gap-1 pt-1">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(index, { required: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-xs text-muted-foreground">Req</span>
                  </div>
                  <div className="col-span-11 grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Placeholder"
                      value={field.placeholder}
                      onChange={(e) => updateField(index, { placeholder: e.target.value })}
                      className="h-7 text-xs"
                    />
                    <Input
                      placeholder="Default value"
                      value={field.defaultValue}
                      onChange={(e) => updateField(index, { defaultValue: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-11">
                    <Input
                      placeholder="Help text"
                      value={field.helpText}
                      onChange={(e) => updateField(index, { helpText: e.target.value })}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="col-span-1 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeField(index)}
                      disabled={form.configurationFields.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {isEdit ? "Update" : "Create"} service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
