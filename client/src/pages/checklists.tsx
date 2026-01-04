import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Search,
  ClipboardCheck,
  ClipboardList,
  Trash2,
  Edit,
  Play,
  Check,
  X,
  GripVertical,
  Truck,
  Briefcase,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistRun,
  ChecklistRunItem,
  Vehicle,
  Job,
} from "@shared/schema";
import { checklistTargets, checklistItemTypes, insertChecklistTemplateSchema } from "@shared/schema";

const templateFormSchema = insertChecklistTemplateSchema;

type TemplateFormData = z.infer<typeof templateFormSchema>;

interface TemplateWithItems extends ChecklistTemplate {
  items?: ChecklistTemplateItem[];
}

interface ChecklistRunWithItems extends ChecklistRun {
  items?: ChecklistRunItem[];
}

function formatItemType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getTargetBadge(target: string | null | undefined) {
  if (target === "vehicle") {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <Truck className="mr-1 h-3 w-3" />
        Vehicle
      </Badge>
    );
  }
  return (
    <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
      <Briefcase className="mr-1 h-3 w-3" />
      Job
    </Badge>
  );
}

export default function Checklists() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateWithItems | null>(null);
  const [newItems, setNewItems] = useState<{ question: string; itemType: string; isRequired: boolean; sortOrder: number }[]>([]);
  const [runningChecklist, setRunningChecklist] = useState<{
    template: TemplateWithItems;
    target: string;
    targetId: string;
    items: ChecklistTemplateItem[];
  } | null>(null);
  const [runItemValues, setRunItemValues] = useState<Record<string, any>>({});

  const { data: templates, isLoading: templatesLoading } = useQuery<TemplateWithItems[]>({
    queryKey: ["/api/checklist-templates"],
  });

  const { data: runs, isLoading: runsLoading } = useQuery<ChecklistRunWithItems[]>({
    queryKey: ["/api/checklist-runs"],
  });

  const { data: vehicles } = useQuery<Vehicle[]>({
    queryKey: ["/api/vehicles"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      target: "vehicle",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const response = await apiRequest("POST", "/api/checklist-templates", data);
      return response.json();
    },
    onSuccess: async (template: ChecklistTemplate) => {
      for (const item of newItems) {
        await apiRequest("POST", `/api/checklist-templates/${template.id}/items`, item);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-templates"] });
      toast({ title: "Checklist template created successfully" });
      setIsCreateOpen(false);
      setNewItems([]);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error creating template", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateFormData> }) => {
      return await apiRequest("PATCH", `/api/checklist-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-templates"] });
      toast({ title: "Template updated successfully" });
      setEditingTemplate(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error updating template", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/checklist-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-templates"] });
      toast({ title: "Template deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting template", description: error.message, variant: "destructive" });
    },
  });

  const startRunMutation = useMutation({
    mutationFn: async (data: {
      templateId: string;
      vehicleId?: string;
      jobId?: string;
      itemResponses: Record<string, any>;
    }): Promise<any> => {
      const { itemResponses, ...runData } = data;
      const runResponse = await apiRequest("POST", "/api/checklist-runs", runData);
      const run = await runResponse.json();
      
      if (run.items && run.items.length > 0) {
        for (const runItem of run.items) {
          const templateItemId = runItem.templateItemId;
          const response = itemResponses[templateItemId];
          if (response !== undefined) {
            const updateData: Record<string, any> = {};
            
            if (runItem.itemType === "checkbox") {
              updateData.isChecked = Boolean(response);
            } else if (runItem.itemType === "text") {
              updateData.textValue = String(response);
            } else if (runItem.itemType === "number") {
              updateData.numberValue = response !== "" ? String(response) : null;
            } else if (runItem.itemType === "photo") {
              updateData.photoUrl = String(response);
            }
            
            await apiRequest("PATCH", `/api/checklist-run-items/${runItem.id}`, updateData);
          }
        }
        
        await apiRequest("POST", `/api/checklist-runs/${run.id}/complete`);
      }
      
      return run;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-runs"] });
      toast({ title: "Checklist completed successfully" });
      setRunningChecklist(null);
      setRunItemValues({});
    },
    onError: (error: any) => {
      toast({ title: "Error completing checklist", description: error.message, variant: "destructive" });
    },
  });

  const filteredTemplates = (templates || []).filter((t) =>
    searchQuery === "" || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addNewItem = () => {
    setNewItems([...newItems, { question: "", itemType: "checkbox", isRequired: false, sortOrder: newItems.length }]);
  };

  const updateNewItem = (index: number, field: string, value: any) => {
    const updated = [...newItems];
    (updated[index] as any)[field] = value;
    setNewItems(updated);
  };

  const removeNewItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const openRunDialog = async (template: TemplateWithItems) => {
    const response = await fetch(`/api/checklist-templates/${template.id}/items`);
    const items = await response.json();
    setRunningChecklist({
      template,
      target: template.target || "vehicle",
      targetId: "",
      items,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Checklists</h1>
          <p className="text-muted-foreground">
            Create and manage pre-start checklists for vehicles and jobs
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-template" onClick={() => { form.reset(); setNewItems([]); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Checklist Template</DialogTitle>
              <DialogDescription>
                Define a reusable checklist template with custom items.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-template-name" placeholder="Pre-Start Vehicle Check" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} data-testid="input-template-desc" placeholder="Description of the checklist..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-target-type">
                            <SelectValue placeholder="Select target" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {checklistTargets.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Checklist Items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addNewItem} data-testid="button-add-item">
                      <Plus className="mr-1 h-3 w-3" />
                      Add Item
                    </Button>
                  </div>
                  {newItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No items yet. Add items to create your checklist.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {newItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={item.question}
                            onChange={(e) => updateNewItem(index, "question", e.target.value)}
                            placeholder="Item question"
                            className="flex-1"
                            data-testid={`input-item-question-${index}`}
                          />
                          <Select
                            value={item.itemType}
                            onValueChange={(value) => updateNewItem(index, "itemType", value)}
                          >
                            <SelectTrigger className="w-[120px]" data-testid={`select-item-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {checklistItemTypes.map((itemType) => (
                                <SelectItem key={itemType} value={itemType}>
                                  {formatItemType(itemType)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1">
                            <Checkbox
                              checked={item.isRequired}
                              onCheckedChange={(checked) => updateNewItem(index, "isRequired", !!checked)}
                              data-testid={`checkbox-required-${index}`}
                            />
                            <Label className="text-xs">Required</Label>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeNewItem(index)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-template">
                    {createMutation.isPending ? "Creating..." : "Create Template"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <ClipboardList className="mr-1 h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <ClipboardCheck className="mr-1 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-templates"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No templates yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first checklist template to get started
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{template.name}</p>
                            {template.description && (
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getTargetBadge(template.target)}</TableCell>
                        <TableCell>
                          <Badge className={template.isActive ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-600"}>
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openRunDialog(template)}
                              data-testid={`button-run-${template.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this template?")) {
                                  deleteMutation.mutate(template.id);
                                }
                              }}
                              data-testid={`button-delete-${template.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist History</CardTitle>
              <CardDescription>View completed and in-progress checklists</CardDescription>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (runs || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium">No checklist runs yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Start a checklist from a template to track it here
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs?.map((run) => (
                      <TableRow key={run.id} data-testid={`row-run-${run.id}`}>
                        <TableCell className="font-medium">{run.templateId}</TableCell>
                        <TableCell>
                          {run.vehicleId && <Badge className="bg-blue-500/10 text-blue-600">Vehicle</Badge>}
                          {run.jobId && <Badge className="bg-purple-500/10 text-purple-600">Job</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            run.status === "completed" 
                              ? "bg-green-500/10 text-green-600" 
                              : run.status === "in_progress"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-gray-500/10 text-gray-600"
                          }>
                            {run.status.replace("_", " ").charAt(0).toUpperCase() + run.status.slice(1).replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(run.startedAt!).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!runningChecklist} onOpenChange={(open) => !open && setRunningChecklist(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Start Checklist: {runningChecklist?.template.name}</DialogTitle>
            <DialogDescription>
              Select a {runningChecklist?.target} and complete the checklist items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select {runningChecklist?.target === "vehicle" ? "Vehicle" : "Job"}</Label>
              <Select
                value={runningChecklist?.targetId || ""}
                onValueChange={(value) => setRunningChecklist(prev => prev ? { ...prev, targetId: value } : null)}
              >
                <SelectTrigger data-testid="select-target">
                  <SelectValue placeholder={`Select ${runningChecklist?.target}`} />
                </SelectTrigger>
                <SelectContent>
                  {runningChecklist?.target === "vehicle"
                    ? vehicles?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registrationNumber} - {v.make} {v.model}
                        </SelectItem>
                      ))
                    : jobs?.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.clientName} - {j.address}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>

            {runningChecklist?.items && runningChecklist.items.length > 0 && (
              <div className="space-y-3">
                <Label>Checklist Items</Label>
                {runningChecklist.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-md border">
                    {item.itemType === "checkbox" ? (
                      <Checkbox
                        checked={runItemValues[item.id] === true}
                        onCheckedChange={(checked) => setRunItemValues({ ...runItemValues, [item.id]: checked })}
                        data-testid={`run-item-${item.id}`}
                      />
                    ) : item.itemType === "text" ? (
                      <Input
                        value={runItemValues[item.id] || ""}
                        onChange={(e) => setRunItemValues({ ...runItemValues, [item.id]: e.target.value })}
                        placeholder="Enter text..."
                        className="flex-1"
                        data-testid={`run-item-${item.id}`}
                      />
                    ) : item.itemType === "number" ? (
                      <Input
                        type="number"
                        value={runItemValues[item.id] || ""}
                        onChange={(e) => setRunItemValues({ ...runItemValues, [item.id]: e.target.value })}
                        placeholder="Enter number..."
                        className="w-32"
                        data-testid={`run-item-${item.id}`}
                      />
                    ) : null}
                    <span className={`flex-1 ${item.itemType === "checkbox" ? "" : "text-sm text-muted-foreground"}`}>
                      {item.question}
                      {item.isRequired && <span className="text-destructive ml-1">*</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRunningChecklist(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!runningChecklist?.targetId) {
                  toast({ title: "Please select a target", variant: "destructive" });
                  return;
                }
                const runData: {
                  templateId: string;
                  vehicleId?: string;
                  jobId?: string;
                  itemResponses: Record<string, any>;
                } = {
                  templateId: runningChecklist.template.id,
                  itemResponses: runItemValues,
                };
                if (runningChecklist.target === "vehicle") {
                  runData.vehicleId = runningChecklist.targetId;
                } else {
                  runData.jobId = runningChecklist.targetId;
                }
                await startRunMutation.mutateAsync(runData);
              }}
              disabled={!runningChecklist?.targetId || startRunMutation.isPending}
              data-testid="button-start-run"
            >
              {startRunMutation.isPending ? "Completing..." : "Complete Checklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
