import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
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
import { Label } from "@/components/ui/label";
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
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionGate } from "@/components/permission-gate";
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
  ChevronUp,
  Receipt,
  DollarSign,
  Undo2,
  FileText,
  Eye,
  ExternalLink
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { jobStatuses, pcItemStatuses, type Job, type PCItem, type Client, type ClientAccessToken, type JobPhoto, type JobReceipt, type ScheduleEntry, type StaffProfile, type Quote, type QuoteWithDetails, type LineItem, type QuoteMilestone, type QuotePaymentSchedule, type Invoice, type JobMilestone } from "@shared/schema";
import type { User as AuthUser } from "@shared/models/auth";

type StaffProfileWithUser = StaffProfile & { user?: AuthUser };

const formSchema = z.object({
  clientId: z.string().optional(),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  description: z.string().optional(),
  status: z.enum(jobStatuses),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  estimatedDurationDays: z.number().min(0).optional(),
  estimatedDurationHours: z.number().min(0).max(23).optional(),
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
  startDate: Date | null;
  finishDate: Date | null;
  assignedToId: string;
  description: string;
  milestoneId: string;
}

const defaultPCItemForm: PCItemFormData = {
  title: "",
  status: "pending",
  startDate: null,
  finishDate: null,
  assignedToId: "__none__",
  description: "",
  milestoneId: "__none__",
};

function PCItemsSection({ jobId, quoteId, invoiceId }: { jobId: string; quoteId?: string | null; invoiceId?: string | null }) {
  const { toast } = useToast();
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [formData, setFormData] = useState<PCItemFormData>(defaultPCItemForm);
  const [editingItem, setEditingItem] = useState<PCItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");

  const { data: pcItems, isLoading } = useQuery<PCItem[]>({
    queryKey: [`/api/jobs/${jobId}/pc-items`],
  });

  const { data: staffMembers } = useQuery<StaffProfileWithUser[]>({
    queryKey: ["/api/staff"],
  });

  const { data: invoice } = useQuery<Invoice>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  const effectiveQuoteId = invoice?.quoteId ?? quoteId;

  const { data: quoteDetails } = useQuery<QuoteWithDetails>({
    queryKey: ["/api/quotes", effectiveQuoteId],
    enabled: !!effectiveQuoteId,
  });

  const { data: jobMilestones } = useQuery<JobMilestone[]>({
    queryKey: [`/api/jobs/${jobId}/milestones`],
  });

  const quoteMilestones = quoteDetails?.milestones || [];
  
  // Combine quote milestones and job milestones
  const allMilestones: Array<{ id: string; title: string; sequence: number; source: 'quote' | 'job' }> = [
    ...quoteMilestones.map(m => ({ id: m.id, title: m.title, sequence: m.sequence, source: 'quote' as const })),
    ...((jobMilestones || []).map(m => ({ id: m.id, title: m.title, sequence: m.sortOrder || 0, source: 'job' as const }))),
  ].sort((a, b) => a.sequence - b.sequence);

  const addMilestoneMutation = useMutation({
    mutationFn: async (title: string) => {
      // Calculate max sort order from both quote and job milestones to avoid conflicts
      const maxQuoteSequence = quoteMilestones.length > 0 
        ? Math.max(...quoteMilestones.map(m => m.sequence)) 
        : 0;
      const maxJobSortOrder = (jobMilestones?.length || 0) > 0 
        ? Math.max(...(jobMilestones || []).map(m => m.sortOrder || 0)) 
        : 0;
      const nextSortOrder = Math.max(maxQuoteSequence, maxJobSortOrder) + 1;
      
      return apiRequest("POST", `/api/jobs/${jobId}/milestones`, {
        title,
        sortOrder: nextSortOrder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/milestones`] });
      setIsAddingMilestone(false);
      setNewMilestoneTitle("");
      toast({ title: "Milestone added", description: "New milestone has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return apiRequest("DELETE", `/api/job-milestones/${milestoneId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/milestones`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      toast({ title: "Milestone deleted", description: "Milestone has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: PCItemFormData) => {
      return apiRequest("POST", `/api/jobs/${jobId}/pc-items`, {
        title: data.title,
        status: data.status,
        startDate: data.startDate ? format(data.startDate, "yyyy-MM-dd") : null,
        finishDate: data.finishDate ? format(data.finishDate, "yyyy-MM-dd") : null,
        assignedToId: data.assignedToId && data.assignedToId !== "__none__" ? data.assignedToId : null,
        description: data.description || null,
        milestoneId: data.milestoneId && data.milestoneId !== "__none__" ? data.milestoneId : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
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
      if (data.startDate !== undefined) {
        payload.startDate = data.startDate ? format(data.startDate, "yyyy-MM-dd") : null;
      }
      if (data.finishDate !== undefined) {
        payload.finishDate = data.finishDate ? format(data.finishDate, "yyyy-MM-dd") : null;
      }
      if (data.assignedToId !== undefined) {
        payload.assignedToId = data.assignedToId && data.assignedToId !== "__none__" ? data.assignedToId : null;
      }
      if (data.description !== undefined) {
        payload.description = data.description || null;
      }
      if (data.milestoneId !== undefined) {
        payload.milestoneId = data.milestoneId && data.milestoneId !== "__none__" ? data.milestoneId : null;
      }
      
      return apiRequest("PATCH", `/api/pc-items/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/pc-items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
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
      startDate: item.startDate ? new Date(item.startDate) : null,
      finishDate: item.finishDate ? new Date(item.finishDate) : null,
      assignedToId: item.assignedToId || "__none__",
      description: item.description || "",
      milestoneId: (item as any).milestoneId || "__none__",
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

  const renderPCItem = (item: PCItem) => {
    const isExpanded = expandedItems.has(item.id);
    const isEditing = editingItem?.id === item.id;
    const assigneeName = getStaffName(item.assignedToId);
    const hasDetails = item.description || item.startDate || item.finishDate || item.assignedToId;

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
            onCheckedChange={(checked) => updateItemMutation.mutate({ 
              id: item.id, 
              data: { status: checked ? "completed" : "pending" } 
            })}
            data-testid={`checkbox-pc-item-${item.id}`}
          />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
              {item.title}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
              {(item.startDate || item.finishDate) && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {item.startDate && format(new Date(item.startDate), "MMM d")}
                  {item.startDate && item.finishDate && " - "}
                  {item.finishDate && format(new Date(item.finishDate), "MMM d, yyyy")}
                  {item.startDate && !item.finishDate && ", " + new Date(item.startDate).getFullYear()}
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
  };

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
          <label className="text-sm font-medium mb-2 block">Start Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid={isEdit ? "button-edit-pc-item-startdate" : "button-new-pc-item-startdate"}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.startDate ? format(formData.startDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={formData.startDate || undefined}
                onSelect={(date) => setFormData({ ...formData, startDate: date || null })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Finish Date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                data-testid={isEdit ? "button-edit-pc-item-finishdate" : "button-new-pc-item-finishdate"}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.finishDate ? format(formData.finishDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={formData.finishDate || undefined}
                onSelect={(date) => setFormData({ ...formData, finishDate: date || null })}
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

        <div>
          <label className="text-sm font-medium mb-2 block">Milestone</label>
          <Select
            value={formData.milestoneId}
            onValueChange={(value) => setFormData({ ...formData, milestoneId: value })}
          >
            <SelectTrigger data-testid={isEdit ? "select-edit-pc-item-milestone" : "select-new-pc-item-milestone"}>
              <SelectValue placeholder="Select milestone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{allMilestones.length === 0 ? "Milestone 1" : "General Items"}</SelectItem>
              {allMilestones.map((milestone) => (
                <SelectItem key={milestone.id} value={milestone.id}>
                  {milestone.title}
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

  // Default milestone name when no milestones exist
  const defaultMilestoneName = allMilestones.length === 0 ? "Milestone 1" : "General Items";

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
      </CardHeader>
      <CardContent className="space-y-3">
        {isAddingItem && renderForm(false)}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const generalItems = (pcItems || []).filter((item) => !(item as any).milestoneId);
              const generalCompleted = generalItems.filter((item) => item.status === "completed").length;
              return (
                <div data-testid="milestone-section-general">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-muted text-foreground px-3 py-1.5 rounded-md font-medium text-sm whitespace-nowrap">
                      {defaultMilestoneName}
                    </div>
                    {generalItems.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {generalCompleted}/{generalItems.length}
                      </Badge>
                    )}
                  </div>
                  <div className="ml-4 pl-4 border-l-2 border-muted space-y-2">
                    {generalItems.map((item) => renderPCItem(item))}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground hover:text-foreground border border-dashed"
                      onClick={() => {
                        setFormData({ ...defaultPCItemForm, milestoneId: "__none__" });
                        setIsAddingItem(true);
                      }}
                      data-testid="button-add-item-general"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                </div>
              );
            })()}
            {allMilestones.map((milestone, index) => {
              const milestoneItems = (pcItems || []).filter((item) => (item as any).milestoneId === milestone.id);
              const milestoneCompleted = milestoneItems.filter((item) => item.status === "completed").length;
              
              return (
                <div key={milestone.id} data-testid={`milestone-section-${milestone.id}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-muted text-foreground px-3 py-1.5 rounded-md font-medium text-sm whitespace-nowrap">
                      {milestone.title}
                    </div>
                    {milestoneItems.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {milestoneCompleted}/{milestoneItems.length}
                      </Badge>
                    )}
                    {milestone.source === 'job' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => deleteMilestoneMutation.mutate(milestone.id)}
                        disabled={deleteMilestoneMutation.isPending}
                        data-testid={`button-delete-milestone-${milestone.id}`}
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <div className="ml-4 pl-4 border-l-2 border-muted space-y-2">
                    {milestoneItems.map((item) => renderPCItem(item))}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-muted-foreground hover:text-foreground border border-dashed"
                      onClick={() => {
                        setFormData({ ...defaultPCItemForm, milestoneId: milestone.id });
                        setIsAddingItem(true);
                      }}
                      data-testid={`button-add-item-milestone-${milestone.id}`}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                </div>
              );
            })}
            
            {isAddingMilestone ? (
              <div className="flex items-center gap-2 p-3 border border-dashed rounded-md bg-muted/30">
                <Input
                  placeholder="Enter milestone name..."
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  autoFocus
                  data-testid="input-new-milestone-title"
                />
                <Button
                  size="sm"
                  onClick={() => addMilestoneMutation.mutate(newMilestoneTitle)}
                  disabled={addMilestoneMutation.isPending || !newMilestoneTitle.trim()}
                  data-testid="button-save-milestone"
                >
                  {addMilestoneMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingMilestone(false);
                    setNewMilestoneTitle("");
                  }}
                  data-testid="button-cancel-milestone"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAddingMilestone(true)}
                data-testid="button-add-milestone"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Milestone
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobPhotosSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<JobPhoto | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: photos, isLoading } = useQuery<JobPhoto[]>({
    queryKey: [`/api/jobs/${jobId}/photos`],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { url: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/photos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/photos`] });
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const newPreviewUrls: string[] = [];
    
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: `${file.name} is not an image file.`, variant: "destructive" });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} exceeds 10MB limit.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
      newPreviewUrls.push(URL.createObjectURL(file));
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddPhotos = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "Photos required", description: "Please select at least one photo to upload.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    
    const totalFiles = selectedFiles.length;
    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = selectedFiles[i];
        
        const urlResponse = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
          }),
        });

        if (!urlResponse.ok) {
          toast({ title: "Upload failed", description: `Failed to get upload URL for ${file.name}`, variant: "destructive" });
          continue;
        }

        const { uploadURL, objectPath } = await urlResponse.json();

        const uploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!uploadResponse.ok) {
          toast({ title: "Upload failed", description: `Failed to upload ${file.name}`, variant: "destructive" });
          continue;
        }

        await uploadMutation.mutateAsync({ url: objectPath });
        successCount++;
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }
      
      if (successCount > 0) {
        toast({ 
          title: "Photos uploaded", 
          description: `${successCount} photo${successCount > 1 ? 's' : ''} added to the job.` 
        });
        setIsAddDialogOpen(false);
        setSelectedFiles([]);
        setPreviewUrls([]);
      }
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload photos", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
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

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setSelectedFiles([]);
            setPreviewUrls([]);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Photos</DialogTitle>
              <DialogDescription>Upload photos from your device to document this job</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-photo-file"
              />
              {previewUrls.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {previewUrls.map((url, index) => (
                      <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-5 w-5"
                          onClick={() => {
                            setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            setPreviewUrls(prev => prev.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add More Photos
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  data-testid="dropzone-photo"
                >
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select photos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports JPG, PNG, HEIC up to 10MB each
                  </p>
                </div>
              )}
              {isUploading && (
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isUploading}>
                Cancel
              </Button>
              <Button
                onClick={handleAddPhotos}
                disabled={isUploading || uploadMutation.isPending || selectedFiles.length === 0}
                data-testid="button-confirm-add-photo"
              >
                {isUploading ? "Uploading..." : `Add ${selectedFiles.length > 0 ? selectedFiles.length : ''} Photo${selectedFiles.length !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Photo</DialogTitle>
            </DialogHeader>
            {selectedPhoto && (
              <div className="space-y-4">
                <img
                  src={selectedPhoto.url}
                  alt="Job photo"
                  className="w-full max-h-[60vh] object-contain rounded-md"
                />
                <p className="text-sm text-muted-foreground">
                  Uploaded: {new Date(selectedPhoto.createdAt || "").toLocaleString()}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function JobReceiptsSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<JobReceipt | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newReceiptDescription, setNewReceiptDescription] = useState("");
  const [newReceiptVendor, setNewReceiptVendor] = useState("");
  const [newReceiptAmount, setNewReceiptAmount] = useState("");
  const [newReceiptCategory, setNewReceiptCategory] = useState("materials");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: receipts, isLoading } = useQuery<JobReceipt[]>({
    queryKey: [`/api/jobs/${jobId}/receipts`],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { url: string; description?: string; vendor?: string; amount?: string; category?: string }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/receipts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/receipts`] });
      toast({ title: "Receipt added", description: "Receipt has been added to the job." });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      return apiRequest("DELETE", `/api/job-receipts/${receiptId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/receipts`] });
      toast({ title: "Receipt deleted", description: "Receipt has been removed." });
      setSelectedReceipt(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setNewReceiptDescription("");
    setNewReceiptVendor("");
    setNewReceiptAmount("");
    setNewReceiptCategory("materials");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif", "application/pdf"];
      if (!allowedTypes.includes(file.type)) {
        toast({ title: "Invalid file", description: "Please select an image or PDF file.", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select a file under 10MB.", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleAddReceipt = async () => {
    if (!selectedFile) {
      toast({ title: "File required", description: "Please select a receipt to upload.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await urlResponse.json();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload receipt");
      }

      uploadMutation.mutate({
        url: objectPath,
        description: newReceiptDescription.trim() || undefined,
        vendor: newReceiptVendor.trim() || undefined,
        amount: newReceiptAmount.trim() || undefined,
        category: newReceiptCategory,
      });
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Failed to upload receipt", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Receipts & Expenses
            </CardTitle>
            <CardDescription>Upload receipts and expense documentation</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={uploadMutation.isPending}
            data-testid="button-add-receipt"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Receipt
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
        ) : receipts && receipts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="relative aspect-square rounded-md overflow-hidden border group cursor-pointer"
                onClick={() => setSelectedReceipt(receipt)}
                data-testid={`receipt-${receipt.id}`}
              >
                <img
                  src={receipt.url}
                  alt={receipt.description || "Receipt"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this receipt?")) {
                      deleteMutation.mutate(receipt.id);
                    }
                  }}
                  data-testid={`button-delete-receipt-${receipt.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                {receipt.amount && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {receipt.amount}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No receipts yet</p>
            <p className="text-sm">Upload receipts to track job expenses</p>
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Receipt</DialogTitle>
              <DialogDescription>Scan or upload a receipt to document job expenses</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Receipt File <span className="text-destructive">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-receipt-file"
                />
                {selectedFile ? (
                  <div className="relative">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-contain rounded-md border"
                      />
                    ) : (
                      <div className="p-4 border rounded-md bg-muted flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        <span className="text-sm">{selectedFile.name}</span>
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    data-testid="dropzone-receipt"
                  >
                    <Camera className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Tap to scan or select a receipt</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports images and PDFs up to 10MB
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="receipt-vendor" className="text-sm font-medium">
                    Vendor
                  </label>
                  <Input
                    id="receipt-vendor"
                    placeholder="Store name..."
                    value={newReceiptVendor}
                    onChange={(e) => setNewReceiptVendor(e.target.value)}
                    data-testid="input-receipt-vendor"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="receipt-amount" className="text-sm font-medium">
                    Amount
                  </label>
                  <Input
                    id="receipt-amount"
                    placeholder="0.00"
                    value={newReceiptAmount}
                    onChange={(e) => setNewReceiptAmount(e.target.value)}
                    data-testid="input-receipt-amount"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="receipt-category" className="text-sm font-medium">
                  Category
                </label>
                <Select value={newReceiptCategory} onValueChange={setNewReceiptCategory}>
                  <SelectTrigger data-testid="select-receipt-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="supplies">Supplies</SelectItem>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="receipt-description" className="text-sm font-medium">
                  Description (optional)
                </label>
                <Input
                  id="receipt-description"
                  placeholder="What was purchased..."
                  value={newReceiptDescription}
                  onChange={(e) => setNewReceiptDescription(e.target.value)}
                  data-testid="input-receipt-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddReceipt}
                disabled={isUploading || uploadMutation.isPending || !selectedFile}
                data-testid="button-confirm-add-receipt"
              >
                {isUploading ? "Uploading..." : uploadMutation.isPending ? "Saving..." : "Add Receipt"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Receipt Details</DialogTitle>
            </DialogHeader>
            {selectedReceipt && (
              <div className="space-y-4">
                <img
                  src={selectedReceipt.url}
                  alt={selectedReceipt.description || "Receipt"}
                  className="w-full max-h-[60vh] object-contain rounded-md"
                />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedReceipt.vendor && (
                    <div>
                      <span className="text-muted-foreground">Vendor:</span>{" "}
                      <span className="font-medium">{selectedReceipt.vendor}</span>
                    </div>
                  )}
                  {selectedReceipt.amount && (
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      <span className="font-medium">${selectedReceipt.amount}</span>
                    </div>
                  )}
                </div>
                {selectedReceipt.description && (
                  <p className="text-sm text-muted-foreground">{selectedReceipt.description}</p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Uploaded: {new Date(selectedReceipt.createdAt || "").toLocaleString()}</span>
                  {selectedReceipt.category && (
                    <Badge variant="secondary">{selectedReceipt.category}</Badge>
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

  const copyLink = (link: ClientAccessToken, useShortLink: boolean = true) => {
    const url = useShortLink && link.shortCode 
      ? `${window.location.origin}/s/${link.shortCode}`
      : `${window.location.origin}/portal/${link.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: useShortLink ? "Short link copied to clipboard." : "Full link copied to clipboard." });
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
                <div className="space-y-3">
                  {activeLinks.map((link) => (
                    <div
                      key={link.id}
                      className="p-3 rounded-md border"
                      data-testid={`share-link-${link.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Full link:</span>
                        <div className="flex-1 truncate text-sm font-mono bg-muted px-2 py-1 rounded">
                          {link.shortCode 
                            ? `${window.location.origin}/s/${link.shortCode}` 
                            : `.../${link.token.slice(0, 12)}...`}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyLink(link, !!link.shortCode)}
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

function InvoicePreviewSection({ job }: { job: Job }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: invoicesByJob } = useQuery<Invoice[]>({
    queryKey: [`/api/invoices?jobId=${job.id}`],
    enabled: !!job?.id,
  });

  const { data: quoteDetails, isLoading } = useQuery<QuoteWithDetails>({
    queryKey: [`/api/quotes/${job.quoteId}`],
    enabled: !!job.quoteId && isPreviewOpen,
  });

  const hasQuote = !!job.quoteId;
  const hasInvoices = !!job.invoiceId || (invoicesByJob && invoicesByJob.length > 0);
  if (!hasQuote && !hasInvoices) {
    return null;
  }

  const milestones = quoteDetails?.milestones || [];
  const lineItems = quoteDetails?.lineItems || [];
  const paymentSchedules = quoteDetails?.paymentSchedules || [];

  const getMilestoneItems = (milestoneId: string) => 
    lineItems.filter(item => item.quoteMilestoneId === milestoneId);

  const getUnassignedItems = () => 
    lineItems.filter(item => !item.quoteMilestoneId);

  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Linked Quote/Invoice
          </CardTitle>
          <CardDescription>
            View deliverables and milestones from the original quote
          </CardDescription>
        </div>
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-preview-invoice">
              <Eye className="mr-2 h-4 w-4" />
              Preview Deliverables
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Quote Deliverables</DialogTitle>
              <DialogDescription>
                Reference this when creating checklist items
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : quoteDetails ? (
                <>
                  {milestones.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Milestones
                      </h3>
                      {milestones.sort((a, b) => a.sequence - b.sequence).map((milestone) => (
                        <div key={milestone.id} className="border rounded-md p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{milestone.title}</span>
                            {milestone.description && (
                              <span className="text-xs text-muted-foreground">{milestone.description}</span>
                            )}
                          </div>
                          {getMilestoneItems(milestone.id).length > 0 && (
                            <div className="pl-4 border-l-2 border-primary/30 space-y-2">
                              {getMilestoneItems(milestone.id).map((item) => (
                                <div key={item.id} className="text-sm">
                                  <div className="font-medium">{item.description}</div>
                                  {item.richDescription && (
                                    <div 
                                      className="text-muted-foreground text-xs mt-1 prose prose-sm max-w-none"
                                      dangerouslySetInnerHTML={{ __html: item.richDescription }}
                                    />
                                  )}
                                  {item.quantity && item.unitPrice && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Qty: {item.quantity} × ${item.unitPrice} = ${parseFloat(item.quantity) * parseFloat(item.unitPrice)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {getUnassignedItems().length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Line Items
                      </h3>
                      <div className="border rounded-md p-4 space-y-3">
                        {getUnassignedItems().map((item) => (
                          <div key={item.id} className="text-sm pb-3 border-b last:border-b-0">
                            {item.heading && (
                              <div className="font-semibold text-primary mb-1">{item.heading}</div>
                            )}
                            <div className="font-medium">{item.description}</div>
                            {item.richDescription && (
                              <div 
                                className="text-muted-foreground text-xs mt-1 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: item.richDescription }}
                              />
                            )}
                            {item.quantity && item.unitPrice && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Qty: {item.quantity} × ${item.unitPrice} = ${(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {paymentSchedules.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Payment Schedule
                      </h3>
                      <div className="border rounded-md p-4">
                        <div className="space-y-2">
                          {paymentSchedules.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((schedule) => (
                            <div key={schedule.id} className="flex items-center justify-between text-sm">
                              <span>{schedule.name}</span>
                              <span className="font-medium">
                                {schedule.calculatedAmount ? `$${schedule.calculatedAmount}` : schedule.percentage ? `${schedule.percentage}%` : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {quoteDetails.total && (
                    <div className="border-t pt-4 flex items-center justify-between">
                      <span className="font-semibold">Total Quote Value</span>
                      <span className="text-lg font-bold">${quoteDetails.total}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No quote details available</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-5">
        {job.quoteId && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quote
            </p>
            <Link
              href={`/quotes/${job.quoteId}`}
              className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60 hover:border-primary/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium">
                  Quote #{job.referenceNumber || job.quoteId.slice(0, 8)}
                </span>
                <p className="text-xs text-muted-foreground">View quote details and line items</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        )}
        {((invoicesByJob && invoicesByJob.length > 0) || job.invoiceId) && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Invoices
            </p>
            <div className="space-y-2">
              {(invoicesByJob && invoicesByJob.length > 0)
                ? invoicesByJob.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60 hover:border-primary/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <p className="text-xs text-muted-foreground">
                          {inv.status ? `${inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}` : "View invoice"}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))
                : job.invoiceId && (
                    <Link
                      href={`/invoices/${job.invoiceId}`}
                      className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60 hover:border-primary/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">Linked invoice</span>
                        <p className="text-xs text-muted-foreground">View invoice details</p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UserWorkingHours {
  id: string;
  staffId: string;
  dayOfWeek: number;
  isWorkingDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

function calculateHoursFromTimeRange(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 7.5;
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

function JobScheduleSection({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canManageSchedule = hasPermission("manage_schedule");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [useEndDate, setUseEndDate] = useState(false);
  const [newStaffId, setNewStaffId] = useState("");
  const [newDurationHours, setNewDurationHours] = useState("7.5");
  const [newNotes, setNewNotes] = useState("");
  const [autoCalculateHours, setAutoCalculateHours] = useState(false);
  const [staffWorkingHours, setStaffWorkingHours] = useState<UserWorkingHours[]>([]);

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
      setStartDate(undefined);
      setEndDate(undefined);
      setUseEndDate(false);
      setNewStaffId("");
      setNewDurationHours("7.5");
      setNewNotes("");
      setAutoCalculateHours(false);
      setStaffWorkingHours([]);
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

  const resetScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/schedule/${id}/reset`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Status reset", description: "The entry has been reset to scheduled." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Fetch staff working hours when a staff member is selected
  useEffect(() => {
    if (newStaffId && newStaffId !== "unassigned") {
      fetch(`/api/staff/${newStaffId}/working-hours`)
        .then((res) => res.json())
        .then((hours: UserWorkingHours[]) => {
          setStaffWorkingHours(hours);
          // Auto-calculate if enabled and we have dates
          if (autoCalculateHours && startDate) {
            calculateAndSetDuration(startDate, endDate, hours);
          }
        })
        .catch(() => setStaffWorkingHours([]));
    } else {
      setStaffWorkingHours([]);
    }
  }, [newStaffId]);

  // Re-calculate when dates change and auto-calculate is enabled
  useEffect(() => {
    if (autoCalculateHours && startDate && staffWorkingHours.length > 0) {
      calculateAndSetDuration(startDate, endDate, staffWorkingHours);
    }
  }, [startDate, endDate, autoCalculateHours, staffWorkingHours]);

  const calculateAndSetDuration = (start: Date, end: Date | undefined, hours: UserWorkingHours[]) => {
    const dates: Date[] = [];
    const current = new Date(start);
    const endD = end || start;
    
    while (current <= endD) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    let totalDuration = 0;
    for (const d of dates) {
      const dayOfWeek = d.getDay();
      const dayHours = hours.find((h) => h.dayOfWeek === dayOfWeek);
      if (dayHours && dayHours.isWorkingDay) {
        totalDuration += calculateHoursFromTimeRange(dayHours.startTime, dayHours.endTime);
      }
    }

    // If no working hours found, default to 7.5 per day
    if (totalDuration === 0 && dates.length > 0) {
      totalDuration = dates.length * 7.5;
    }

    setNewDurationHours(totalDuration.toFixed(1));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSchedule = async () => {
    if (!startDate) {
      toast({ title: "Date required", description: "Please select a date.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const dates: Date[] = [];
    const current = new Date(startDate);
    const endD = useEndDate && endDate ? endDate : startDate;
    
    while (current <= endD) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    // Build list of schedule entries to create
    const entriesToCreate: Array<{ date: Date; duration: number }> = [];
    
    for (const date of dates) {
      let dayDuration = parseFloat(newDurationHours);
      
      if (autoCalculateHours && staffWorkingHours.length > 0) {
        const dayOfWeek = date.getDay();
        const dayHours = staffWorkingHours.find((h) => h.dayOfWeek === dayOfWeek);
        if (dayHours && dayHours.isWorkingDay) {
          dayDuration = calculateHoursFromTimeRange(dayHours.startTime, dayHours.endTime);
        } else {
          dayDuration = 0; // Skip non-working days
        }
      }

      if (dayDuration > 0) {
        entriesToCreate.push({ date, duration: dayDuration });
      }
    }

    if (entriesToCreate.length === 0) {
      toast({ 
        title: "No working days", 
        description: "No working days found in the selected date range for this staff member.", 
        variant: "destructive" 
      });
      setIsSubmitting(false);
      return;
    }

    try {
      for (const entry of entriesToCreate) {
        await apiRequest("POST", "/api/schedule", {
          jobId,
          scheduledDate: format(entry.date, "yyyy-MM-dd"),
          staffId: newStaffId || undefined,
          durationHours: entry.duration.toFixed(1),
          notes: newNotes || undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ 
        title: "Schedule added", 
        description: `${entriesToCreate.length} day${entriesToCreate.length !== 1 ? "s" : ""} scheduled.` 
      });
      setIsAddDialogOpen(false);
      setStartDate(undefined);
      setEndDate(undefined);
      setUseEndDate(false);
      setNewStaffId("");
      setNewDurationHours("7.5");
      setNewNotes("");
      setAutoCalculateHours(false);
      setStaffWorkingHours([]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create schedule", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
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
        <PermissionGate permission="manage_schedule">
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
                <label className="text-sm font-medium">{useEndDate ? "Start Date" : "Date"}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-schedule-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span className="text-muted-foreground">Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useEndDate"
                  checked={useEndDate}
                  onCheckedChange={(checked) => {
                    setUseEndDate(checked === true);
                    if (!checked) setEndDate(undefined);
                  }}
                  data-testid="checkbox-use-end-date"
                />
                <label htmlFor="useEndDate" className="text-sm font-medium cursor-pointer">
                  Schedule multiple days (date range)
                </label>
              </div>

              {useEndDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-schedule-end-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span className="text-muted-foreground">Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

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

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoCalcHours"
                  checked={autoCalculateHours}
                  onCheckedChange={(checked) => setAutoCalculateHours(checked === true)}
                  disabled={!newStaffId || newStaffId === "unassigned"}
                  data-testid="checkbox-auto-calculate"
                />
                <label 
                  htmlFor="autoCalcHours" 
                  className={`text-sm font-medium cursor-pointer ${!newStaffId || newStaffId === "unassigned" ? "text-muted-foreground" : ""}`}
                >
                  Auto-calculate hours from staff working schedule
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {autoCalculateHours ? "Total Duration (hours) - calculated" : "Duration (hours)"}
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={newDurationHours}
                  onChange={(e) => setNewDurationHours(e.target.value)}
                  disabled={autoCalculateHours}
                  data-testid="input-schedule-duration"
                />
                {autoCalculateHours && staffWorkingHours.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Based on staff member's configured working hours
                  </p>
                )}
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
                disabled={isSubmitting}
                data-testid="button-confirm-add-schedule"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </PermissionGate>
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
                      {canManageSchedule && (
                        <>
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
                            <>
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Done
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => resetScheduleMutation.mutate(entry.id)}
                                disabled={resetScheduleMutation.isPending}
                                title="Undo - reset to scheduled"
                                data-testid={`button-reset-schedule-${entry.id}`}
                              >
                                <Undo2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                          {entry.status === "cancelled" && (
                            <>
                              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelled
                              </Badge>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => resetScheduleMutation.mutate(entry.id)}
                                disabled={resetScheduleMutation.isPending}
                                title="Undo - reset to scheduled"
                                data-testid={`button-reset-schedule-${entry.id}`}
                              >
                                <Undo2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
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
                        </>
                      )}
                      {!canManageSchedule && entry.status === "completed" && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Done
                        </Badge>
                      )}
                      {!canManageSchedule && entry.status === "cancelled" && (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Cancelled
                        </Badge>
                      )}
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

  const { hasPermission } = usePermissions();
  const canViewClients = hasPermission("view_clients");
  const canCreateClients = hasPermission("create_clients");
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: canViewClients,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      address: "",
      description: "",
      status: "pending",
      priority: "normal",
      estimatedDurationDays: 0,
      estimatedDurationHours: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (job && isEditing) {
      const totalHours = job.estimatedDurationHours ? parseFloat(job.estimatedDurationHours) : 0;
      const days = Math.floor(totalHours / 8);
      const hours = Math.round((totalHours % 8) * 10) / 10;
      
      form.reset({
        clientId: job.clientId || "",
        clientName: job.clientName,
        clientEmail: job.clientEmail || "",
        clientPhone: job.clientPhone || "",
        address: job.address,
        description: job.description || "",
        status: job.status as typeof jobStatuses[number],
        priority: (job.priority as "low" | "normal" | "high" | "urgent") || "normal",
        estimatedDurationDays: days,
        estimatedDurationHours: hours,
        notes: job.notes || "",
      });
    }
  }, [job, isEditing, form]);

  function buildAddressFromClient(c: Client): string {
    const parts = [
      c.streetAddress,
      c.streetAddress2,
      c.city,
      c.state,
      c.postalCode,
      c.country,
    ].filter(Boolean);
    return parts.join(", ") || "";
  }

  const createClientMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email?: string; phone?: string; streetAddress?: string }) => {
      const res = await apiRequest("POST", "/api/clients", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || undefined,
        phone: data.phone || undefined,
        streetAddress: data.streetAddress || undefined,
      });
      return res.json() as Promise<Client>;
    },
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      form.setValue("clientId", newClient.id);
      form.setValue("clientName", `${newClient.firstName} ${newClient.lastName}`);
      form.setValue("clientEmail", newClient.email || "");
      form.setValue("clientPhone", newClient.phone || newClient.mobilePhone || "");
      form.setValue("address", buildAddressFromClient(newClient));
      setCreateClientDialogOpen(false);
      toast({ title: "Client created", description: "Client has been added and selected for this job." });
    },
    onError: () => {
      toast({ title: "Failed to create client", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const totalHours = ((data.estimatedDurationDays || 0) * 8) + (data.estimatedDurationHours || 0);
      const { estimatedDurationDays, estimatedDurationHours, ...rest } = data;

      let clientId = rest.clientId;
      let clientName = rest.clientName;
      let clientEmail = rest.clientEmail;
      let clientPhone = rest.clientPhone;

      // Manual entry on create: create a client first, then link the job to it
      if (!clientId && rest.clientName?.trim()) {
        const nameParts = rest.clientName.trim().split(/\s+/);
        const firstName = nameParts[0] || "Client";
        const lastName = nameParts.slice(1).join(" ") || "—";
        const clientRes = await apiRequest("POST", "/api/clients", {
          firstName,
          lastName,
          email: rest.clientEmail || undefined,
          phone: rest.clientPhone || undefined,
          streetAddress: rest.address || undefined,
        });
        const newClient = (await clientRes.json()) as Client;
        clientId = newClient.id;
        clientName = `${newClient.firstName} ${newClient.lastName}`;
        clientEmail = newClient.email ?? rest.clientEmail ?? "";
        clientPhone = newClient.phone ?? newClient.mobilePhone ?? rest.clientPhone ?? "";
      }

      const response = await apiRequest("POST", "/api/jobs", {
        ...rest,
        clientId: clientId || undefined,
        clientName,
        clientEmail: clientEmail || undefined,
        clientPhone: clientPhone || undefined,
        estimatedDurationHours: totalHours > 0 ? totalHours.toString() : null,
        jobType: "general", // Default job type - field is hidden per project requirements
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
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
      const totalHours = ((data.estimatedDurationDays || 0) * 8) + (data.estimatedDurationHours || 0);
      const { estimatedDurationDays, estimatedDurationHours, ...rest } = data;
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, {
        ...rest,
        estimatedDurationHours: totalHours > 0 ? totalHours.toString() : null,
      });
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

  const handleCreateInvoiceFromJob = () => {
    if (id) setLocation(`/invoices/new?jobId=${id}`);
  };

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
      <div className="flex flex-wrap items-center justify-between gap-4">
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
        {isEditing && id && (
          <PermissionGate permission="create_invoices">
            <Button
              variant="outline"
              onClick={handleCreateInvoiceFromJob}
              data-testid="button-create-invoice-from-job"
            >
              <FileText className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </PermissionGate>
        )}
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
              {canViewClients && (
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => {
                    const clientLocked = isEditing && !!job?.clientId;
                    return (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select
                          value={field.value || "_manual"}
                          onValueChange={(value) => {
                            if (value === "_manual") {
                              field.onChange("");
                              return;
                            }
                            if (value === "__create__") {
                              field.onChange("");
                              setCreateClientDialogOpen(true);
                              return;
                            }
                            field.onChange(value);
                            const client = (clientsList || []).find((c) => c.id === value);
                            if (client) {
                              form.setValue("clientName", `${client.firstName} ${client.lastName}`);
                              form.setValue("clientEmail", client.email || "");
                              form.setValue("clientPhone", client.phone || client.mobilePhone || "");
                              form.setValue("address", buildAddressFromClient(client));
                            }
                          }}
                          disabled={clientLocked}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-job-client">
                              <SelectValue placeholder="Select client or enter manually" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="_manual">Manual entry</SelectItem>
                            {(clientsList || []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.company ? `${c.company} (${c.firstName} ${c.lastName})` : `${c.firstName} ${c.lastName}`}
                              </SelectItem>
                            ))}
                            {canCreateClients && !clientLocked && (
                              <SelectItem value="__create__" data-testid="option-create-new-client">
                                Create new client…
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {clientLocked && (
                          <p className="text-xs text-muted-foreground">Client cannot be changed for this job.</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              )}
              {(() => {
                const hasClientSelected = !!form.watch("clientId");
                return (
                  <>
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
                                disabled={hasClientSelected}
                                readOnly={hasClientSelected}
                                className={hasClientSelected ? "bg-muted" : undefined}
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
                                disabled={hasClientSelected}
                                readOnly={hasClientSelected}
                                className={hasClientSelected ? "bg-muted" : undefined}
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
                              disabled={hasClientSelected}
                              readOnly={hasClientSelected}
                              className={hasClientSelected ? "bg-muted" : undefined}
                              data-testid="input-client-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                );
              })()}
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
                <FormItem>
                  <FormLabel>Estimated Duration</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name="estimatedDurationDays"
                      render={({ field }) => (
                        <div className="flex items-center gap-1">
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              className="w-20"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-duration-days"
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estimatedDurationHours"
                      render={({ field }) => (
                        <div className="flex items-center gap-1">
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              step={0.5}
                              className="w-20"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              data-testid="input-duration-hours"
                            />
                          </FormControl>
                          <span className="text-sm text-muted-foreground">hours</span>
                        </div>
                      )}
                    />
                  </div>
                  <FormDescription>1 day = 8 working hours</FormDescription>
                </FormItem>
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

      {isEditing && id && job && (
        <>
          <InvoicePreviewSection job={job} />
          <JobScheduleSection jobId={id} />
          <PCItemsSection jobId={id} quoteId={job.quoteId} invoiceId={job.invoiceId} />
          <JobPhotosSection jobId={id} />
          <JobReceiptsSection jobId={id} />
          <ShareLinkSection jobId={id} />
        </>
      )}

      <Dialog open={createClientDialogOpen} onOpenChange={(open) => {
        setCreateClientDialogOpen(open);
        if (!open) {
          setNewClientFirstName("");
          setNewClientLastName("");
          setNewClientEmail("");
          setNewClientPhone("");
          setNewClientAddress("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new client</DialogTitle>
            <DialogDescription>
              Add a client and use them for this job. They will appear in the client list for future jobs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-client-first">First name *</Label>
                <Input
                  id="new-client-first"
                  value={newClientFirstName}
                  onChange={(e) => setNewClientFirstName(e.target.value)}
                  placeholder="John"
                  data-testid="input-new-client-first"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-client-last">Last name *</Label>
                <Input
                  id="new-client-last"
                  value={newClientLastName}
                  onChange={(e) => setNewClientLastName(e.target.value)}
                  placeholder="Smith"
                  data-testid="input-new-client-last"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-email">Email</Label>
              <Input
                id="new-client-email"
                type="email"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-phone">Phone</Label>
              <Input
                id="new-client-phone"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="+61 400 000 000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-client-address">Address</Label>
              <Input
                id="new-client-address"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                placeholder="123 Main St, Sydney NSW 2000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateClientDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!newClientFirstName.trim() || !newClientLastName.trim() || createClientMutation.isPending}
              onClick={() => {
                createClientMutation.mutate({
                  firstName: newClientFirstName.trim(),
                  lastName: newClientLastName.trim(),
                  email: newClientEmail.trim() || undefined,
                  phone: newClientPhone.trim() || undefined,
                  streetAddress: newClientAddress.trim() || undefined,
                });
              }}
              data-testid="button-submit-new-client"
            >
              {createClientMutation.isPending ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
