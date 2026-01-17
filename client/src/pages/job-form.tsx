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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Link as LinkIcon,
  Camera,
  ImageIcon,
  Upload,
  X,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Pencil,
  CalendarIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { jobStatuses, pcItemStatuses, type Job, type PCItem, type ClientAccessToken, type JobPhoto, type ScheduleEntry, type StaffProfile } from "@shared/schema";
import type { User as AuthUser } from "@shared/models/auth";

type StaffProfileWithUser = StaffProfile & { user?: AuthUser };

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
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

interface PCItemFormData {
  title: string;
  status: string;
  dueDate: Date | null;
  assignedToId: string;
  description: string;
}

const defaultPCItemForm: PCItemFormData = {
  title: "",
  status: "pending",
  dueDate: null,
  assignedToId: "__none__",
  description: "",
};

function PCItemsSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [formData, setFormData] = useState<PCItemFormData>(defaultPCItemForm);
  const [editingItem, setEditingItem] = useState<PCItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: pcItems, isLoading } = useQuery<PCItem[]>({
    queryKey: [`/api/jobs/${jobId}/pc-items`],
  });

  const { data: staffMembers } = useQuery<StaffProfileWithUser[]>({
    queryKey: ["/api/staff"],
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: PCItemFormData) => {
      return apiRequest("POST", `/api/jobs/${jobId}/pc-items`, {
        title: data.title,
        status: data.status,
        dueDate: data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : null,
        assignedToId: data.assignedToId && data.assignedToId !== "__none__" ? data.assignedToId : null,
        description: data.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      setFormData(defaultPCItemForm);
      setIsAddingItem(false);
      toast({ title: "Item added", description: "PC item has been added to the checklist." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PCItemFormData> }) => {
      const payload: Record<string, unknown> = {};
      
      if (data.title !== undefined) {
        payload.title = data.title;
      }
      if (data.status !== undefined) {
        payload.status = data.status;
      }
      if (data.dueDate !== undefined) {
        payload.dueDate = data.dueDate ? format(data.dueDate, "yyyy-MM-dd") : null;
      }
      if (data.assignedToId !== undefined) {
        payload.assignedToId = data.assignedToId && data.assignedToId !== "__none__" ? data.assignedToId : null;
      }
      if (data.description !== undefined) {
        payload.description = data.description || null;
      }
      
      return apiRequest("PATCH", `/api/pc-items/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      setEditingItem(null);
      toast({ title: "Item updated", description: "PC item has been updated." });
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
    if (formData.title.trim()) {
      addItemMutation.mutate(formData);
    }
  };

  const handleEditItem = (item: PCItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      status: item.status,
      dueDate: item.dueDate ? new Date(item.dueDate) : null,
      assignedToId: item.assignedToId || "__none__",
      description: item.description || "",
    });
  };

  const handleSaveEdit = () => {
    if (editingItem && formData.title.trim()) {
      updateItemMutation.mutate({ id: editingItem.id, data: formData });
    }
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getStaffName = (staffId: string | null) => {
    if (!staffId || !staffMembers) return null;
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return null;
    if (staff.user?.firstName) {
      return `${staff.user.firstName} ${staff.user.lastName || ""}`.trim();
    }
    return staff.user?.email || "Unknown";
  };

  const completedCount = pcItems?.filter((item) => item.status === "completed").length || 0;
  const totalCount = pcItems?.length || 0;

  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4 p-4 rounded-md border bg-muted/30">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-sm font-medium mb-2 block">Item Title</label>
          <Input
            placeholder="Enter checklist item..."
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            autoFocus={!isEdit}
            data-testid={isEdit ? "input-edit-pc-item-title" : "input-new-pc-item-title"}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Status</label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger data-testid={isEdit ? "select-edit-pc-item-status" : "select-new-pc-item-status"}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {pcItemStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {formatLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Target Due Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid={isEdit ? "button-edit-pc-item-duedate" : "button-new-pc-item-duedate"}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.dueDate ? format(formData.dueDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={formData.dueDate || undefined}
                onSelect={(date) => setFormData({ ...formData, dueDate: date || null })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Assignee</label>
          <Select
            value={formData.assignedToId}
            onValueChange={(value) => setFormData({ ...formData, assignedToId: value })}
          >
            <SelectTrigger data-testid={isEdit ? "select-edit-pc-item-assignee" : "select-new-pc-item-assignee"}>
              <SelectValue placeholder="Select assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {staffMembers?.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.user?.firstName 
                    ? `${staff.user.firstName} ${staff.user.lastName || ""}`.trim()
                    : staff.user?.email || "Unknown"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium mb-2 block">Description</label>
          <RichTextEditor
            value={formData.description}
            onChange={(value) => setFormData({ ...formData, description: value })}
            placeholder="Add more details, notes, or instructions..."
            data-testid={isEdit ? "editor-edit-pc-item-description" : "editor-new-pc-item-description"}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end pt-2">
        <Button
          variant="ghost"
          onClick={() => {
            if (isEdit) {
              setEditingItem(null);
            } else {
              setIsAddingItem(false);
            }
            setFormData(defaultPCItemForm);
          }}
          data-testid={isEdit ? "button-cancel-edit-pc-item" : "button-cancel-pc-item"}
        >
          Cancel
        </Button>
        <Button
          onClick={isEdit ? handleSaveEdit : handleAddItem}
          disabled={(isEdit ? updateItemMutation.isPending : addItemMutation.isPending) || !formData.title.trim()}
          data-testid={isEdit ? "button-save-edit-pc-item" : "button-save-pc-item"}
        >
          {(isEdit ? updateItemMutation.isPending : addItemMutation.isPending) ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {isEdit ? "Save Changes" : "Add Item"}
        </Button>
      </div>
    </div>
  );

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
        {!isAddingItem && !editingItem && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddingItem(true)}
            data-testid="button-add-pc-item"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isAddingItem && renderForm(false)}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : pcItems && pcItems.length > 0 ? (
          <div className="space-y-3">
            {pcItems.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const isEditing = editingItem?.id === item.id;
              const assigneeName = getStaffName(item.assignedToId);
              const hasDetails = item.description || item.dueDate || item.assignedToId;

              if (isEditing) {
                return (
                  <div key={item.id}>
                    {renderForm(true)}
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className="rounded-md border hover-elevate"
                  data-testid={`pc-item-${item.id}`}
                >
                  <div className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={item.status === "completed"}
                      disabled={item.status === "completed"}
                      onCheckedChange={() => updateItemMutation.mutate({ id: item.id, data: { status: "completed" } })}
                      data-testid={`checkbox-pc-item-${item.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {item.title}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(item.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                        {assigneeName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {assigneeName}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className={getPCStatusColor(item.status)}>
                      {formatLabel(item.status)}
                    </Badge>
                    {hasDetails && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleExpanded(item.id)}
                        data-testid={`button-expand-pc-item-${item.id}`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditItem(item)}
                      data-testid={`button-edit-pc-item-${item.id}`}
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
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
                  {isExpanded && item.description && (
                    <div className="px-3 pb-3 pt-0 border-t mx-3 mt-2">
                      <div 
                        className="prose prose-sm dark:prose-invert max-w-none pt-3"
                        dangerouslySetInnerHTML={{ __html: item.description }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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

function JobPhotosSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [newPhotoCategory, setNewPhotoCategory] = useState("general");

  const { data: photos, isLoading } = useQuery<JobPhoto[]>({
    queryKey: [`/api/jobs/${jobId}/photos`],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { url: string; caption?: string; category?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/photos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/photos`] });
      toast({ title: "Photo added", description: "Photo has been added to the job." });
      setIsAddDialogOpen(false);
      setNewPhotoUrl("");
      setNewPhotoCaption("");
      setNewPhotoCategory("general");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return apiRequest("DELETE", `/api/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/photos`] });
      toast({ title: "Photo deleted", description: "Photo has been removed." });
      setSelectedPhoto(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddPhoto = () => {
    if (!newPhotoUrl.trim()) {
      toast({ title: "URL required", description: "Please enter a photo URL.", variant: "destructive" });
      return;
    }
    uploadMutation.mutate({
      url: newPhotoUrl.trim(),
      caption: newPhotoCaption.trim() || undefined,
      category: newPhotoCategory,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Job Photos
            </CardTitle>
            <CardDescription>Upload and manage photos for this job</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={uploadMutation.isPending}
            data-testid="button-add-photo"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Photo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-md overflow-hidden border group cursor-pointer"
                onClick={() => setSelectedPhoto(photo)}
                data-testid={`photo-${photo.id}`}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || "Job photo"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this photo?")) {
                      deleteMutation.mutate(photo.id);
                    }
                  }}
                  data-testid={`button-delete-photo-${photo.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
                    {photo.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ImageIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No photos yet</p>
            <p className="text-sm">Add photos to document this job</p>
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Photo</DialogTitle>
              <DialogDescription>Add a photo to document this job</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="photo-url" className="text-sm font-medium">
                  Photo URL <span className="text-destructive">*</span>
                </label>
                <Input
                  id="photo-url"
                  placeholder="https://example.com/photo.jpg"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  data-testid="input-photo-url"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="photo-caption" className="text-sm font-medium">
                  Caption (optional)
                </label>
                <Input
                  id="photo-caption"
                  placeholder="Describe this photo..."
                  value={newPhotoCaption}
                  onChange={(e) => setNewPhotoCaption(e.target.value)}
                  data-testid="input-photo-caption"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="photo-category" className="text-sm font-medium">
                  Category
                </label>
                <Select value={newPhotoCategory} onValueChange={setNewPhotoCategory}>
                  <SelectTrigger data-testid="select-photo-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="before">Before</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddPhoto}
                disabled={uploadMutation.isPending || !newPhotoUrl.trim()}
                data-testid="button-confirm-add-photo"
              >
                {uploadMutation.isPending ? "Adding..." : "Add Photo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Photo Details</DialogTitle>
            </DialogHeader>
            {selectedPhoto && (
              <div className="space-y-4">
                <img
                  src={selectedPhoto.url}
                  alt={selectedPhoto.caption || "Job photo"}
                  className="w-full max-h-[60vh] object-contain rounded-md"
                />
                {selectedPhoto.caption && (
                  <p className="text-sm text-muted-foreground">{selectedPhoto.caption}</p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Uploaded: {new Date(selectedPhoto.createdAt || "").toLocaleString()}</span>
                  {selectedPhoto.category && (
                    <Badge variant="secondary">{selectedPhoto.category}</Badge>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
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

function JobScheduleSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStaffId, setNewStaffId] = useState("");
  const [newDurationHours, setNewDurationHours] = useState("7.5");
  const [newNotes, setNewNotes] = useState("");

  const { data: scheduleEntries, isLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule"],
  });

  const { data: staffProfiles } = useQuery<StaffProfile[]>({
    queryKey: ["/api/staff"],
  });

  const jobSchedules = scheduleEntries?.filter((e) => e.jobId === jobId) || [];

  const addScheduleMutation = useMutation({
    mutationFn: async (data: { jobId: string; scheduledDate: string; staffId?: string; durationHours?: string; notes?: string }) => {
      return apiRequest("POST", "/api/schedule", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Schedule added", description: "The job has been scheduled." });
      setIsAddDialogOpen(false);
      setNewDate("");
      setNewStaffId("");
      setNewDurationHours("7.5");
      setNewNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/schedule/${id}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Schedule completed", description: "The scheduled day has been marked complete." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const cancelScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/schedule/${id}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Schedule cancelled", description: "The scheduled day has been cancelled." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/schedule/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Schedule deleted", description: "The schedule entry has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddSchedule = () => {
    if (!newDate) {
      toast({ title: "Date required", description: "Please select a date.", variant: "destructive" });
      return;
    }
    addScheduleMutation.mutate({
      jobId,
      scheduledDate: newDate,
      staffId: newStaffId || undefined,
      durationHours: newDurationHours,
      notes: newNotes || undefined,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const getStaffName = (staffId: string) => {
    if (!staffProfiles) return "Unassigned";
    const staff = staffProfiles.find((s) => s.id === staffId);
    if (!staff) return "Unassigned";
    return staff.userId?.split("@")[0] || staff.id.slice(0, 8);
  };

  const totalHours = jobSchedules
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + parseFloat(s.durationHours || "0"), 0);

  const completedDays = jobSchedules.filter((s) => s.status === "completed").length;
  const scheduledDays = jobSchedules.filter((s) => s.status === "scheduled").length;

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Job Schedule
          </CardTitle>
          <CardDescription>
            {jobSchedules.length > 0
              ? `${completedDays} completed, ${scheduledDays} scheduled | ${totalHours.toFixed(1)} total hours`
              : "Schedule work days for this job"}
          </CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-add-schedule">
              <Plus className="mr-2 h-4 w-4" />
              Add Day
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Work Day</DialogTitle>
              <DialogDescription>Add a new scheduled day for this job.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-schedule-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Staff Member</label>
                <Select value={newStaffId || "unassigned"} onValueChange={(v) => setNewStaffId(v === "unassigned" ? "" : v)}>
                  <SelectTrigger data-testid="select-schedule-staff">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffProfiles?.filter((s) => s.isActive).map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.userId?.split("@")[0] || staff.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (hours)</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={newDurationHours}
                  onChange={(e) => setNewDurationHours(e.target.value)}
                  data-testid="input-schedule-duration"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Any notes for this day..."
                  data-testid="input-schedule-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddSchedule}
                disabled={addScheduleMutation.isPending}
                data-testid="button-confirm-add-schedule"
              >
                {addScheduleMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : jobSchedules.length > 0 ? (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {jobSchedules
                .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-2 rounded-md border p-3 ${
                      entry.status === "completed"
                        ? "bg-emerald-50 dark:bg-emerald-950/30"
                        : entry.status === "cancelled"
                        ? "bg-muted/50 opacity-60"
                        : ""
                    }`}
                    data-testid={`schedule-entry-${entry.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-primary/10">
                        <span className="text-sm font-bold text-primary">
                          {new Date(entry.scheduledDate).getDate()}
                        </span>
                        <span className="text-[10px] uppercase text-primary">
                          {new Date(entry.scheduledDate).toLocaleString("default", { month: "short" })}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{formatDate(entry.scheduledDate)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{getStaffName(entry.staffId)}</span>
                          <Clock className="h-3 w-3 ml-2" />
                          <span>{entry.durationHours || "7.5"}h</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.status === "scheduled" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => completeScheduleMutation.mutate(entry.id)}
                            disabled={completeScheduleMutation.isPending}
                            title="Mark complete"
                            data-testid={`button-complete-schedule-${entry.id}`}
                          >
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => cancelScheduleMutation.mutate(entry.id)}
                            disabled={cancelScheduleMutation.isPending}
                            title="Cancel"
                            data-testid={`button-cancel-schedule-${entry.id}`}
                          >
                            <XCircle className="h-4 w-4 text-amber-500" />
                          </Button>
                        </>
                      )}
                      {entry.status === "completed" && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </Badge>
                      )}
                      {entry.status === "cancelled" && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancelled
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this schedule entry?")) {
                            deleteScheduleMutation.mutate(entry.id);
                          }
                        }}
                        disabled={deleteScheduleMutation.isPending}
                        title="Delete"
                        data-testid={`button-delete-schedule-${entry.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No schedule entries yet</p>
            <p className="text-sm">Add days to schedule work for this job</p>
          </div>
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
                Specify the job status and details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
          <JobScheduleSection jobId={id} />
          <PCItemsSection jobId={id} />
          <JobPhotosSection jobId={id} />
          <ShareLinkSection jobId={id} />
        </>
      )}
    </div>
  );
}
