import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Edit,
  Settings as SettingsIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RichTextEditor } from "@/components/RichTextEditor";
import type { TermsTemplate } from "@shared/schema";

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  content: z.string().min(1, "Template content is required"),
  serviceType: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

export default function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TermsTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery<TermsTemplate[]>({
    queryKey: ["/api/terms-templates"],
  });

  const createForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      content: "",
      serviceType: "",
    },
  });

  const editForm = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      content: "",
      serviceType: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return apiRequest("POST", "/api/terms-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terms-templates"] });
      toast({ title: "Template created successfully" });
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TemplateFormData }) => {
      return apiRequest("PATCH", `/api/terms-templates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terms-templates"] });
      toast({ title: "Template updated successfully" });
      setEditingTemplate(null);
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/terms-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/terms-templates"] });
      toast({ title: "Template deleted successfully" });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const handleCreate = (data: TemplateFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (template: TermsTemplate) => {
    setEditingTemplate(template);
    editForm.reset({
      name: template.name,
      content: template.content,
      serviceType: template.serviceType || "",
    });
  };

  const handleUpdate = (data: TemplateFormData) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    }
  };

  const filteredTemplates = templates?.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.serviceType?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your templates and preferences
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="mr-2 h-4 w-4" />
            Terms Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Terms of Trade Templates</CardTitle>
                  <CardDescription>
                    Create reusable terms for different service types (e.g., Drainage, Bathroom Renovations)
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-template">
                  <Plus className="mr-2 h-4 w-4" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-templates"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : filteredTemplates?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No templates found</p>
                  <p className="text-sm">Create your first terms of trade template</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTemplates?.map((template) => (
                    <Card key={template.id} className="p-4" data-testid={`card-template-${template.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium" data-testid={`text-template-name-${template.id}`}>
                              {template.name}
                            </h3>
                            {template.serviceType && (
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {template.serviceType}
                              </span>
                            )}
                          </div>
                          <div 
                            className="text-sm text-muted-foreground line-clamp-2 prose prose-sm dark:prose-invert max-w-none"
                            dangerouslySetInnerHTML={{ __html: template.content }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                            data-testid={`button-edit-template-${template.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(template.id)}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Terms Template</DialogTitle>
            <DialogDescription>
              Create a reusable terms of trade template for your quotes
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Drainage Terms" 
                        data-testid="input-template-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Drainage, Bathroom Renovation" 
                        data-testid="input-service-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms Content</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Enter your terms of trade content..."
                        data-testid="input-template-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  data-testid="button-save-template"
                >
                  {createMutation.isPending ? "Creating..." : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Terms Template</DialogTitle>
            <DialogDescription>
              Update your terms of trade template
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Drainage Terms" 
                        data-testid="input-edit-template-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., Drainage, Bathroom Renovation" 
                        data-testid="input-edit-service-type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms Content</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Enter your terms of trade content..."
                        data-testid="input-edit-template-content"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTemplate(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  data-testid="button-update-template"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
