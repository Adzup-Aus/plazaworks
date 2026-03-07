import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListTodo, Plus, Pencil, Trash2, Loader2, Briefcase, TreePalm, CalendarX, BookOpen, Wrench, Ban, CircleSlash } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Activity } from "@shared/schema";

const DEFAULT_COLOR = "#6366f1";

const ACTIVITY_ICON_OPTIONS: { value: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "Briefcase", label: "Job / Briefcase", Icon: Briefcase },
  { value: "TreePalm", label: "Annual Leave", Icon: TreePalm },
  { value: "CalendarX", label: "Sick Leave", Icon: CalendarX },
  { value: "CircleSlash", label: "RDO", Icon: CircleSlash },
  { value: "BookOpen", label: "Training", Icon: BookOpen },
  { value: "Wrench", label: "Unavailable", Icon: Wrench },
  { value: "Ban", label: "Blocked", Icon: Ban },
];

export default function Activities() {
  const [newActivityName, setNewActivityName] = useState("");
  const [newActivityColor, setNewActivityColor] = useState(DEFAULT_COLOR);
  const [newActivityIcon, setNewActivityIcon] = useState<string>("");
  const [activityEditId, setActivityEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState<string>("");
  const { toast } = useToast();

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const createActivityMutation = useMutation({
    mutationFn: async ({ name, color, icon }: { name: string; color?: string; icon?: string | null }) => {
      const res = await apiRequest("POST", "/api/activities", {
        name,
        color: color ?? DEFAULT_COLOR,
        icon: icon && icon.trim() ? icon.trim() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setNewActivityName("");
      setNewActivityColor(DEFAULT_COLOR);
      setNewActivityIcon("");
      toast({ title: "Activity created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({
      id,
      name,
      color,
      icon,
    }: {
      id: string;
      name: string;
      color: string;
      icon?: string | null;
    }) => {
      const res = await apiRequest("PATCH", `/api/activities/${id}`, { name, color, icon: icon ?? null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setActivityEditId(null);
      toast({ title: "Activity updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setActivityEditId(null);
      toast({ title: "Activity deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const startEdit = (a: Activity) => {
    setActivityEditId(a.id);
    setEditName(a.name);
    setEditColor(a.color ?? DEFAULT_COLOR);
    setEditIcon(a.icon ?? "");
  };

  const saveEdit = () => {
    if (!activityEditId || !editName.trim()) return;
    updateActivityMutation.mutate({
      id: activityEditId,
      name: editName.trim(),
      color: editColor || DEFAULT_COLOR,
      icon: editIcon.trim() || null,
    });
  };

  const renderActivityIcon = (iconName: string | null | undefined) => {
    const option = ACTIVITY_ICON_OPTIONS.find((o) => o.value === iconName);
    const Icon = option?.Icon ?? Briefcase;
    return <Icon className="h-4 w-4 shrink-0" />;
  };

  const cancelEdit = () => {
    setActivityEditId(null);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Activities</h1>
        <p className="text-muted-foreground">
          Manage activities that can be scheduled (e.g. Travel, Admin, Sales). Each activity has a color used on the schedule.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            All activities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3 bg-muted/30">
            <div className="flex-1 min-w-[120px] space-y-2">
              <Label className="text-sm">Name</Label>
              <Input
                placeholder="New activity"
                value={newActivityName}
                onChange={(e) => setNewActivityName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newActivityName.trim()) {
                    createActivityMutation.mutate({
                      name: newActivityName.trim(),
                      color: newActivityColor,
                      icon: newActivityIcon.trim() || null,
                    });
                  }
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Icon</Label>
              <Select value={newActivityIcon || "none"} onValueChange={(v) => setNewActivityIcon(v === "none" ? "" : v)}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Icon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default</SelectItem>
                  {ACTIVITY_ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.Icon className="h-4 w-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newActivityColor}
                  onChange={(e) => setNewActivityColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background"
                />
                <Input
                  value={newActivityColor}
                  onChange={(e) => setNewActivityColor(e.target.value)}
                  className="h-9 w-24 font-mono text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="h-9"
              disabled={
                !newActivityName.trim() || createActivityMutation.isPending
              }
              onClick={() => {
                if (newActivityName.trim())
                  createActivityMutation.mutate({
                    name: newActivityName.trim(),
                    color: newActivityColor,
                    icon: newActivityIcon.trim() || null,
                  });
              }}
            >
              {createActivityMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </>
              )}
            </Button>
          </div>

          {/* List */}
          {activitiesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="space-y-2">
              {(activities ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground py-4">
                  No activities yet. Add one above.
                </li>
              ) : (
                (activities ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3 group"
                  >
                    {activityEditId === a.id ? (
                      <div className="flex flex-wrap items-center gap-3 flex-1">
                        <Input
                          className="h-9 flex-1 min-w-[120px]"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <div className="space-y-1">
                          <Label className="text-xs">Icon</Label>
                          <Select value={editIcon || "none"} onValueChange={(v) => setEditIcon(v === "none" ? "" : v)}>
                            <SelectTrigger className="h-9 w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Default</SelectItem>
                              {ACTIVITY_ICON_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span className="flex items-center gap-2">
                                    <opt.Icon className="h-4 w-4" />
                                    {opt.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="h-9 w-10 cursor-pointer rounded border border-input bg-background"
                          />
                          <Input
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="h-9 w-20 font-mono text-xs"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-9"
                            onClick={saveEdit}
                            disabled={
                              !editName.trim() ||
                              updateActivityMutation.isPending
                            }
                          >
                            {updateActivityMutation.isPending
                              ? "Saving..."
                              : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="h-8 w-8 rounded shrink-0 border border-border flex items-center justify-center"
                            style={{
                              backgroundColor: a.color ?? DEFAULT_COLOR,
                              color: "#fff",
                            }}
                            title={a.color ?? DEFAULT_COLOR}
                          >
                            {renderActivityIcon(a.icon)}
                          </div>
                          <span className="text-sm font-medium truncate">
                            {a.name}
                          </span>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  "Delete this activity? It will be removed from the schedule page."
                                )
                              )
                                deleteActivityMutation.mutate(a.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
