import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Plus, 
  Check, 
  ClipboardCopy, 
  Share2, 
  Trash2,
  ListChecks,
  Link as LinkIcon
} from "lucide-react";
import { jobTypes, jobStatuses, pcItemStatuses, type Job, type PCItem, type ClientAccessToken } from "@shared/schema";

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  jobType: z.enum(jobTypes),
  description: z.string().optional(),
  status: z.enum(jobStatuses),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  estimatedDuration: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

function formatLabel(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getPCStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    not_applicable: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}

function PCItemsSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);

  const { data: pcItems, isLoading } = useQuery<PCItem[]>({
    queryKey: [`/api/jobs/${jobId}/pc-items`],
  });

  const addItemMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", `/api/jobs/${jobId}/pc-items`, { title, status: "pending" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      setNewItemTitle("");
      setIsAddingItem(false);
      toast({ title: "Item added", description: "PC item has been added to the checklist." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("POST", `/api/pc-items/${itemId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      toast({ title: "Item completed", description: "PC item marked as complete." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest("DELETE", `/api/pc-items/${itemId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      toast({ title: "Item deleted", description: "PC item has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddItem = () => {
    if (newItemTitle.trim()) {
      addItemMutation.mutate(newItemTitle.trim());
    }
  };

  const completedCount = pcItems?.filter((item) => item.status === "completed").length || 0;
  const totalCount = pcItems?.length || 0;

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Practical Completion Checklist
          </CardTitle>
          <CardDescription>
            {totalCount > 0 
              ? `${completedCount} of ${totalCount} items completed`
              : "Track completion items for this job"}
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsAddingItem(true)}
          data-testid="button-add-pc-item"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAddingItem && (
          <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
            <Input
              placeholder="Enter checklist item..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              className="flex-1"
              autoFocus
              data-testid="input-new-pc-item"
            />
            <Button 
              size="sm" 
              onClick={handleAddItem}
              disabled={addItemMutation.isPending || !newItemTitle.trim()}
              data-testid="button-save-pc-item"
            >
              {addItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => { setIsAddingItem(false); setNewItemTitle(""); }}
              data-testid="button-cancel-pc-item"
            >
              Cancel
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : pcItems && pcItems.length > 0 ? (
          <div className="space-y-2">
            {pcItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-md border hover-elevate"
                data-testid={`pc-item-${item.id}`}
              >
                <Checkbox
                  checked={item.status === "completed"}
                  disabled={item.status === "completed" || completeItemMutation.isPending}
                  onCheckedChange={() => completeItemMutation.mutate(item.id)}
                  data-testid={`checkbox-pc-item-${item.id}`}
                />
                <span className={`flex-1 ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {item.title}
                </span>
                <Badge variant="secondary" className={getPCStatusColor(item.status)}>
                  {formatLabel(item.status)}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteItemMutation.mutate(item.id)}
                  disabled={deleteItemMutation.isPending}
                  data-testid={`button-delete-pc-item-${item.id}`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        ) : !isAddingItem ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListChecks className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No checklist items yet</p>
            <p className="text-sm">Add items to track job completion</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ShareLinkSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const { data: shareLinks, isLoading } = useQuery<ClientAccessToken[]>({
    queryKey: [`/api/jobs/${jobId}/share`],
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/jobs/${jobId}/share`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/share`] });
      toast({ title: "Link created", description: "Share link has been generated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revokeShareLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return apiRequest("DELETE", `/api/share/${linkId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/share`] });
      toast({ title: "Link revoked", description: "Share link has been deactivated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Link copied to clipboard." });
  };

  const activeLinks = shareLinks?.filter((link) => link.isActive) || [];

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Client Portal Access
          </CardTitle>
          <CardDescription>
            Share a link with clients to view job status
          </CardDescription>
        </div>
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-manage-share-links">
              <LinkIcon className="mr-2 h-4 w-4" />
              {activeLinks.length > 0 ? "Manage Links" : "Create Link"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Links</DialogTitle>
              <DialogDescription>
                Create and manage shareable links for this job. Clients can view job status without logging in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : activeLinks.length > 0 ? (
                <div className="space-y-2">
                  {activeLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 p-3 rounded-md border"
                      data-testid={`share-link-${link.id}`}
                    >
                      <div className="flex-1 truncate text-sm font-mono">
                        {window.location.origin}/portal/{link.token.slice(0, 8)}...
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyLink(link.token)}
                        data-testid={`button-copy-link-${link.id}`}
                      >
                        <ClipboardCopy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => revokeShareLinkMutation.mutate(link.id)}
                        disabled={revokeShareLinkMutation.isPending}
                        data-testid={`button-revoke-link-${link.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Share2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No active share links</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={() => createShareLinkMutation.mutate()}
                disabled={createShareLinkMutation.isPending}
                data-testid="button-create-share-link"
              >
                {createShareLinkMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create New Link
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {activeLinks.length > 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>{activeLinks.length} active link{activeLinks.length !== 1 ? "s" : ""}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No share links created. Click "Create Link" to generate a shareable link.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobForm() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isEditing = !!id && id !== "new";

  const { data: job, isLoading: jobLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", id],
    enabled: isEditing,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      address: "",
      jobType: "plumbing",
      description: "",
      status: "pending",
      priority: "normal",
      estimatedDuration: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (job && isEditing) {
      form.reset({
        clientName: job.clientName,
        clientEmail: job.clientEmail || "",
        clientPhone: job.clientPhone || "",
        address: job.address,
        jobType: job.jobType as typeof jobTypes[number],
        description: job.description || "",
        status: job.status as typeof jobStatuses[number],
        priority: (job.priority as "low" | "normal" | "high" | "urgent") || "normal",
        estimatedDuration: job.estimatedDuration || "",
        notes: job.notes || "",
      });
    }
  }, [job, isEditing, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job created",
        description: "The job has been created successfully.",
      });
      setLocation("/jobs");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      toast({
        title: "Job updated",
        description: "The job has been updated successfully.",
      });
      setLocation("/jobs");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && jobLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/jobs")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Job" : "New Job"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? "Update job details and status"
              : "Create a new job entry"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>
                Basic details about the client and job location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Smith"
                          {...field}
                          data-testid="input-client-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+61 400 000 000"
                          {...field}
                          data-testid="input-client-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="client@example.com"
                        {...field}
                        data-testid="input-client-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Address *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="123 Main Street, Sydney NSW 2000"
                        className="resize-none"
                        {...field}
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>
                Specify the type of work and current status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="jobType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Type *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-job-type">
                            <SelectValue placeholder="Select job type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {formatLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {formatLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimatedDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Duration</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 2 days, 4 hours"
                          {...field}
                          data-testid="input-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the job requirements and scope of work..."
                        className="min-h-[120px]"
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormDescription>
                      Include any specific requirements or notes about the job
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes for staff..."
                        className="min-h-[80px]"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormDescription>
                      Private notes visible only to staff
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/jobs")}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Saving..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? "Save Changes" : "Create Job"}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      {isEditing && id && (
        <>
          <PCItemsSection jobId={id} />
          <ShareLinkSection jobId={id} />
        </>
      )}
    </div>
  );
}
