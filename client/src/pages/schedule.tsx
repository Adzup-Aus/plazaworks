import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Briefcase,
  Trash2,
  User,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, ChevronDown, X } from "lucide-react";
import type { Activity, Job, ScheduleEntry, StaffProfile } from "@shared/schema";

type ScheduleDayEntry = {
  date: string;
  staffId: string;
  durationHours: string;
  notes: string;
};

type CalendarDaySchedule = {
  entry: ScheduleEntry;
  job?: Job;
  activity?: Activity;
};

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  schedules: CalendarDaySchedule[];
};

const SLOTS_PER_HOUR = 6;
const TOTAL_SLOTS = 24 * SLOTS_PER_HOUR; // 144, 10-min each

type DragSelection = {
  staffId: string;
  scheduledDate: string;
  startSlot: number;
  endSlot: number;
};

function slotToTime(slot: number): string {
  if (slot >= TOTAL_SLOTS) return "24:00";
  const h = Math.floor(slot / SLOTS_PER_HOUR);
  const m = (slot % SLOTS_PER_HOUR) * 10;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToSlot(time: string | null): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h) ? 0 : h >= 24) return TOTAL_SLOTS;
  const hour = Math.min(23, Math.max(0, isNaN(h) ? 0 : h));
  const min = Math.min(50, Math.max(0, Math.floor((isNaN(m) ? 0 : m) / 10) * 10));
  return hour * SLOTS_PER_HOUR + min / 10;
}

function getSlotFromPointer(hour: number, offsetX: number, cellWidth: number): number {
  const segment = Math.min(5, Math.max(0, Math.floor((offsetX / Math.max(1, cellWidth)) * SLOTS_PER_HOUR)));
  return hour * SLOTS_PER_HOUR + segment;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-amber-500",
    scheduled: "bg-blue-500",
    in_progress: "bg-green-500",
    on_hold: "bg-orange-500",
    completed: "bg-emerald-500",
    cancelled: "bg-red-500",
  };
  return colors[status] || "bg-muted";
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour24(h: number): string {
  return String(h).padStart(2, "0");
}

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "day">("day");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayEntry[]>([]);
  const [globalNotes, setGlobalNotes] = useState<string>("");
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [rightSheetOpen, setRightSheetOpen] = useState(false);
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [selectedSlotJobId, setSelectedSlotJobId] = useState<string | null>(null);
  const [selectedSlotActivityId, setSelectedSlotActivityId] = useState<string | null>(null);
  const [selectedSlotStaffId, setSelectedSlotStaffId] = useState<string | null>(null);
  const [jobComboboxOpen, setJobComboboxOpen] = useState(false);
  const [staffComboboxOpen, setStaffComboboxOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntry | null>(null);
  const [dragCurrentTime, setDragCurrentTime] = useState<string | null>(null);
  const [dragTooltipPos, setDragTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingEntryDrag, setPendingEntryDrag] = useState<{ entry: ScheduleEntry; durationSlots: number } | null>(null);
  const [entryDrag, setEntryDrag] = useState<{ entry: ScheduleEntry; durationSlots: number } | null>(null);
  const [dropTargetSlot, setDropTargetSlot] = useState<number | null>(null);
  const dropTargetSlotRef = useRef<number | null>(null);
  const entryDragRef = useRef<{ entry: ScheduleEntry; durationSlots: number } | null>(null);
  const pendingEntryDragRef = useRef<{ entry: ScheduleEntry; durationSlots: number } | null>(null);
  const hasMovedRef = useRef(false);
  dropTargetSlotRef.current = dropTargetSlot;
  entryDragRef.current = entryDrag;
  pendingEntryDragRef.current = pendingEntryDrag;
  const { toast } = useToast();

  useEffect(() => {
    if (rightSheetOpen && editingEntry) {
      setSlotStartTime(editingEntry.startTime ?? "");
      setSlotEndTime(editingEntry.endTime ?? "");
      setSelectedSlotStaffId(editingEntry.staffId);
      setSelectedSlotJobId(editingEntry.jobId ?? null);
      setSelectedSlotActivityId(editingEntry.activityId ?? null);
    }
  }, [rightSheetOpen, editingEntry]);

  useEffect(() => {
    if (rightSheetOpen && dragSelection) {
      const startSlot = Math.min(dragSelection.startSlot, dragSelection.endSlot);
      const endSlot = Math.max(dragSelection.startSlot, dragSelection.endSlot);
      setSlotStartTime(slotToTime(startSlot));
      setSlotEndTime(slotToTime(endSlot));
      setSelectedSlotStaffId(dragSelection.staffId);
      setSelectedSlotJobId(null);
      setSelectedSlotActivityId(null);
    }
  }, [rightSheetOpen, dragSelection]);

  useEffect(() => {
    if (!pendingEntryDrag && !entryDrag) return;
    const onPointerMove = () => {
      const pending = pendingEntryDragRef.current;
      if (pending && !hasMovedRef.current) {
        hasMovedRef.current = true;
        const startSlot = timeToSlot(pending.entry.startTime);
        setEntryDrag({ entry: pending.entry, durationSlots: pending.durationSlots });
        setDropTargetSlot(startSlot);
        setPendingEntryDrag(null);
      }
    };
    const onPointerUp = () => {
      const slot = dropTargetSlotRef.current;
      const drag = entryDragRef.current;
      const pending = pendingEntryDragRef.current;
      if (drag && slot != null) {
        const clampedSlot = Math.max(0, Math.min(slot, TOTAL_SLOTS - drag.durationSlots));
        const newStart = slotToTime(clampedSlot);
        const newEnd = slotToTime(clampedSlot + drag.durationSlots);
        updateScheduleEntryMutation.mutate({
          id: drag.entry.id,
          staffId: drag.entry.staffId,
          scheduledDate: drag.entry.scheduledDate,
          startTime: newStart,
          endTime: newEnd,
          jobId: drag.entry.jobId ?? undefined,
          activityId: drag.entry.activityId ?? undefined,
        });
      } else if (pending) {
        setEditingEntry(pending.entry);
        setRightSheetOpen(true);
      }
      setPendingEntryDrag(null);
      setEntryDrag(null);
      setDropTargetSlot(null);
      hasMovedRef.current = false;
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [pendingEntryDrag, entryDrag]);

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const selectedDateStr = selectedDate.toISOString().split("T")[0];
  const { data: scheduleEntries, isLoading: scheduleLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule", selectedDateStr],
    queryFn: async () => {
      const res = await fetch(
        `/api/schedule?startDate=${selectedDateStr}&endDate=${selectedDateStr}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return res.json();
    },
    enabled: viewMode === "day",
  });

  const allScheduleEntries = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule"],
  });

  const { data: staffProfiles } = useQuery<StaffProfile[]>({
    queryKey: ["/api/staff"],
  });

  const createBulkScheduleMutation = useMutation({
    mutationFn: async (entries: { jobId: string; scheduledDate: string; staffId?: string; durationHours?: string; notes?: string }[]) => {
      const res = await apiRequest("POST", "/api/schedule/bulk", { entries });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsAddDialogOpen(false);
      setSelectedJob("");
      setScheduleDays([]);
      setGlobalNotes("");
      toast({
        title: "Schedule Created",
        description: `Job scheduled for ${scheduleDays.length} day(s) successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createScheduleEntryMutation = useMutation({
    mutationFn: async (body: {
      jobId?: string;
      activityId?: string;
      staffId: string;
      scheduledDate: string;
      startTime: string;
      endTime: string;
    }) => {
      const res = await apiRequest("POST", "/api/schedule", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setRightSheetOpen(false);
      setDragSelection(null);
      toast({ title: "Scheduled", description: "Entry added to schedule." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/schedule/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({
        title: "Schedule Entry Deleted",
        description: "The schedule entry has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateScheduleEntryMutation = useMutation({
    mutationFn: async ({
      id,
      staffId,
      scheduledDate,
      startTime,
      endTime,
      jobId,
      activityId,
    }: {
      id: string;
      staffId: string;
      scheduledDate: string;
      startTime: string;
      endTime: string;
      jobId?: string | null;
      activityId?: string | null;
    }) => {
      const body: Record<string, unknown> = {
        staffId,
        scheduledDate,
        startTime,
        endTime,
        jobId: jobId ?? null,
        activityId: activityId ?? null,
      };
      const res = await apiRequest("PATCH", `/api/schedule/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setRightSheetOpen(false);
      setEditingEntry(null);
      toast({ title: "Schedule updated", description: "Entry has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateSchedule = () => {
    if (!selectedJob || scheduleDays.length === 0) {
      toast({
        title: "Error",
        description: "Please select a job and at least one date.",
        variant: "destructive",
      });
      return;
    }

    const entries = scheduleDays.map((day) => ({
      jobId: selectedJob,
      scheduledDate: day.date,
      staffId: day.staffId || undefined,
      durationHours: day.durationHours || "7.5",
      notes: day.notes || globalNotes || undefined,
    }));

    createBulkScheduleMutation.mutate(entries);
  };

  const addScheduleDay = () => {
    const newDate = new Date();
    if (scheduleDays.length > 0) {
      const lastDate = new Date(scheduleDays[scheduleDays.length - 1].date);
      lastDate.setDate(lastDate.getDate() + 1);
      while (lastDate.getDay() === 0 || lastDate.getDay() === 6) {
        lastDate.setDate(lastDate.getDate() + 1);
      }
      newDate.setTime(lastDate.getTime());
    }

    setScheduleDays([
      ...scheduleDays,
      {
        date: newDate.toISOString().split("T")[0],
        staffId: "",
        durationHours: "7.5",
        notes: "",
      },
    ]);
  };

  const updateScheduleDay = (index: number, updates: Partial<ScheduleDayEntry>) => {
    const updated = [...scheduleDays];
    updated[index] = { ...updated[index], ...updates };
    setScheduleDays(updated);
  };

  const removeScheduleDay = (index: number) => {
    setScheduleDays(scheduleDays.filter((_, i) => i !== index));
  };

  const formatDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const getStaffName = (staffId: string) => {
    if (!staffProfiles) return "Unassigned";
    const staff = staffProfiles.find((s) => s.id === staffId);
    return staff?.userId || "Unassigned";
  };

  const entriesForMonth = viewMode === "month" ? (allScheduleEntries.data ?? []) : [];
  const isLoading = jobsLoading || scheduleLoading || (viewMode === "day" && scheduleLoading);

  const unscheduledJobs = useMemo(() => {
    if (!jobs) return [];
    const scheduledJobIds = new Set((allScheduleEntries.data || []).map((e) => e.jobId).filter(Boolean));
    return jobs.filter((job) => !scheduledJobIds.has(job.id) && job.status !== "completed" && job.status !== "cancelled");
  }, [jobs, allScheduleEntries.data]);

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const year = currentDate.getFullYear();

  const calendarDays = useMemo((): CalendarDay[] => {
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: CalendarDay[] = [];

    const getSchedulesForDate = (dateStr: string): CalendarDaySchedule[] => {
      return (entriesForMonth || [])
        .filter((entry) => entry.scheduledDate === dateStr && entry.status !== "cancelled")
        .map((entry) => {
          if (entry.jobId) {
            const job = jobs?.find((j) => j.id === entry.jobId);
            return job ? { entry, job } : null;
          }
          if (entry.activityId) {
            const activity = activities?.find((a) => a.id === entry.activityId);
            return activity ? { entry, activity } : { entry };
          }
          return null;
        })
        .filter((s): s is CalendarDaySchedule => s !== null);
    };

    const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        schedules: getSchedulesForDate(dateStr),
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = date.toISOString().split("T")[0];

      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        schedules: getSchedulesForDate(dateStr),
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        schedules: getSchedulesForDate(dateStr),
      });
    }

    return days;
  }, [currentDate, jobs, activities, entriesForMonth]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const navigateDay = (direction: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    setSelectedDate(d);
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const upcomingJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    return (allScheduleEntries.data || [])
      .filter((entry) => entry.scheduledDate >= todayStr)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        job: entry.jobId ? jobs?.find((j) => j.id === entry.jobId) : undefined,
        activity: entry.activityId ? activities?.find((a) => a.id === entry.activityId) : undefined,
      }))
      .filter((e) => e.job || e.activity);
  }, [allScheduleEntries.data, jobs, activities]);

  const staffList = useMemo(
    () => (staffProfiles || []).filter((s) => s.isActive !== false),
    [staffProfiles]
  );

  const handlePointerDown = (staffId: string, hour: number, e: React.PointerEvent) => {
    if (entryDrag) return;
    const cellWidth = e.currentTarget.getBoundingClientRect().width;
    const slot = getSlotFromPointer(hour, e.nativeEvent.offsetX, cellWidth);
    setDragSelection({ staffId, scheduledDate: selectedDateStr, startSlot: slot, endSlot: slot });
    setDragCurrentTime(slotToTime(slot));
    setDragTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (staffId: string, hour: number, e: React.PointerEvent) => {
    if (entryDrag && entryDrag.entry.staffId === staffId) {
      const cellWidth = e.currentTarget.getBoundingClientRect().width;
      const slot = getSlotFromPointer(hour, e.nativeEvent.offsetX, cellWidth);
      setDropTargetSlot(slot);
      return;
    }
    if (!dragSelection || dragSelection.staffId !== staffId) return;
    const cellWidth = e.currentTarget.getBoundingClientRect().width;
    const slot = getSlotFromPointer(hour, e.nativeEvent.offsetX, cellWidth);
    setDragSelection((prev) => (prev ? { ...prev, endSlot: slot } : null));
    setDragCurrentTime(slotToTime(slot));
    setDragTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = () => {
    if (entryDrag) return;
    if (!dragSelection) return;
    setDragCurrentTime(null);
    setDragTooltipPos(null);
    const start = Math.min(dragSelection.startSlot, dragSelection.endSlot);
    const end = Math.max(dragSelection.startSlot, dragSelection.endSlot);
    setDragSelection((prev) => (prev ? { ...prev, startSlot: start, endSlot: end } : null));
    setRightSheetOpen(true);
  };

  const handleEntryBlockPointerDown = (entry: ScheduleEntry, durationSlots: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPendingEntryDrag({ entry, durationSlots });
  };

  const handleOpenEdit = (entry: ScheduleEntry, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragSelection(null);
    setEditingEntry(entry);
    setRightSheetOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    const jobId = selectedSlotJobId ?? undefined;
    const activityId = selectedSlotActivityId ?? undefined;
    if (!slotStartTime.trim() || !slotEndTime.trim() || !selectedSlotStaffId) return;
    if (!jobId && !activityId) return;
    if (jobId && activityId) return;
    updateScheduleEntryMutation.mutate({
      id: editingEntry.id,
      staffId: selectedSlotStaffId,
      scheduledDate: editingEntry.scheduledDate,
      startTime: slotStartTime.trim(),
      endTime: slotEndTime.trim(),
      jobId: jobId || null,
      activityId: activityId || null,
    });
  };

  const handleConfirmAssignment = (jobId?: string, activityId?: string) => {
    const id = jobId ?? selectedSlotJobId ?? activityId ?? selectedSlotActivityId;
    if (!dragSelection || !id) return;
    const staffId = selectedSlotStaffId ?? dragSelection.staffId;
    const startSlot = Math.min(dragSelection.startSlot, dragSelection.endSlot);
    const endSlot = Math.max(dragSelection.startSlot, dragSelection.endSlot);
    const startTime = slotToTime(startSlot);
    const endTime = slotToTime(endSlot);
    createScheduleEntryMutation.mutate({
      staffId,
      scheduledDate: dragSelection.scheduledDate,
      startTime,
      endTime,
      ...(jobId ?? selectedSlotJobId ? { jobId: jobId ?? selectedSlotJobId! } : {}),
      ...(activityId ?? selectedSlotActivityId ? { activityId: activityId ?? selectedSlotActivityId! } : {}),
    });
  };

  const getEntryLabel = (entry: ScheduleEntry) => {
    if (entry.jobId) {
      const job = jobs?.find((j) => j.id === entry.jobId);
      return job?.clientName ?? "Job";
    }
    if (entry.activityId) {
      const act = activities?.find((a) => a.id === entry.activityId);
      return act?.name ?? "Activity";
    }
    return "";
  };

  const getActivityColor = (entry: ScheduleEntry) => {
    if (!entry.activityId) return null;
    const act = activities?.find((a) => a.id === entry.activityId);
    return act?.color ?? "#6366f1";
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            View and manage job schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "day" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("day")}
          >
            Day
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("month")}
          >
            Month
          </Button>
          &nbsp;
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setSelectedJob("");
              setScheduleDays([]);
              setGlobalNotes("");
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-job">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Schedule Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Schedule a Job</DialogTitle>
                <DialogDescription>
                  Select a job and add dates. You can schedule multiple days at once.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="job">Job</Label>
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger id="job" data-testid="select-job">
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs?.filter((j) => j.status !== "completed" && j.status !== "cancelled").length === 0 ? (
                        <SelectItem value="none" disabled>
                          No jobs available
                        </SelectItem>
                      ) : (
                        jobs?.filter((j) => j.status !== "completed" && j.status !== "cancelled").map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.clientName} - {job.jobType}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Schedule Days</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addScheduleDay}
                      data-testid="button-add-schedule-day"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Day
                    </Button>
                  </div>

                  {scheduleDays.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-6 text-center">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No days scheduled yet. Click "Add Day" to start.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[280px]">
                      <div className="space-y-3 pr-4">
                        {scheduleDays.map((day, index) => (
                          <div
                            key={index}
                            className="flex flex-col gap-2 rounded-md border p-3"
                            data-testid={`schedule-day-${index}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  Day {index + 1}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {formatDayName(day.date)}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeScheduleDay(index)}
                                data-testid={`button-remove-day-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Date</Label>
                                <Input
                                  type="date"
                                  value={day.date}
                                  onChange={(e) =>
                                    updateScheduleDay(index, { date: e.target.value })
                                  }
                                  data-testid={`input-day-date-${index}`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Staff</Label>
                                <Select
                                  value={day.staffId || "unassigned"}
                                  onValueChange={(value) =>
                                    updateScheduleDay(index, {
                                      staffId: value === "unassigned" ? "" : value,
                                    })
                                  }
                                >
                                  <SelectTrigger data-testid={`select-staff-${index}`}>
                                    <SelectValue placeholder="Staff" />
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
                              <div>
                                <Label className="text-xs">Hours</Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0.5"
                                  max="12"
                                  value={day.durationHours}
                                  onChange={(e) =>
                                    updateScheduleDay(index, { durationHours: e.target.value })
                                  }
                                  data-testid={`input-hours-${index}`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any scheduling notes..."
                    value={globalNotes}
                    onChange={(e) => setGlobalNotes(e.target.value)}
                    data-testid="input-schedule-notes"
                  />
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
                  <Clock className="h-4 w-4" />
                  <span>Total: {scheduleDays.reduce((sum, d) => sum + parseFloat(d.durationHours || "0"), 0).toFixed(1)} hours</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSchedule}
                  disabled={createBulkScheduleMutation.isPending || !selectedJob || scheduleDays.length === 0}
                  data-testid="button-confirm-schedule"
                >
                  {createBulkScheduleMutation.isPending ? "Scheduling..." : `Schedule ${scheduleDays.length} Day(s)`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button asChild variant="outline" data-testid="button-new-job">
            <Link href="/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {viewMode === "day" ? (
          <Card className="lg:col-span-3 overflow-visible">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                  </h2>
                </div>
                <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={goToToday}>Today</Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="min-w-[800px] overflow-visible">
                  <div className="grid gap-0 border rounded-md overflow-visible" style={{ gridTemplateColumns: "100px repeat(24, minmax(0, 1fr))" }}>
                    <div className="border-b border-r bg-muted/50 p-2 text-xs font-medium sticky left-0 z-10" />
                    {HOURS.map((h) => (
                      <div key={h} className="border-b border-r p-1 text-center text-xs text-muted-foreground" style={{ minWidth: 28 }}>
                        {formatHour24(h)}
                      </div>
                    ))}
                    {staffList.map((staff) => (
                      <React.Fragment key={staff.id}>
                        <div className="border-b border-r bg-muted/50 p-2 text-sm font-medium sticky left-0 z-10 truncate" title={staff.userId}>
                          {staff.userId?.split("@")[0] || staff.id.slice(0, 8)}
                        </div>
                        {HOURS.map((hour) => {
                          const cellStartSlot = hour * SLOTS_PER_HOUR;
                          const cellEndSlot = cellStartSlot + SLOTS_PER_HOUR;
                          const dragStart = dragSelection ? Math.min(dragSelection.startSlot, dragSelection.endSlot) : 0;
                          const dragEnd = dragSelection ? Math.max(dragSelection.startSlot, dragSelection.endSlot) : -1;
                          const overlapStart = dragSelection?.staffId === staff.id ? Math.max(dragStart, cellStartSlot) : cellStartSlot;
                          const overlapEnd = dragSelection?.staffId === staff.id ? Math.min(dragEnd, cellEndSlot - 1) : -1;
                          const hasSelectionInCell = overlapEnd >= overlapStart;
                          const selectionLeftPct = hasSelectionInCell ? ((overlapStart - cellStartSlot) / SLOTS_PER_HOUR) * 100 : 0;
                          const selectionWidthPct = hasSelectionInCell ? ((overlapEnd - overlapStart + 1) / SLOTS_PER_HOUR) * 100 : 0;
                          const isStartSlotInCell = dragSelection?.staffId === staff.id && dragStart >= cellStartSlot && dragStart < cellEndSlot;
                          const startMarkerLeftPct = isStartSlotInCell ? ((dragStart - cellStartSlot) / SLOTS_PER_HOUR) * 100 : 0;
                          const selectionDurationSlots = dragSelection?.staffId === staff.id ? dragEnd - dragStart + 1 : 0;
                          const midSlot = dragSelection?.staffId === staff.id ? (dragStart + dragEnd) / 2 : 0;
                          const isDurationCenterInCell = hasSelectionInCell && selectionDurationSlots >= 1 && midSlot >= cellStartSlot && midSlot < cellEndSlot;
                          const durationCenterLeftPct = isDurationCenterInCell ? ((midSlot - cellStartSlot) / SLOTS_PER_HOUR) * 100 : 0;
                          const durationMinutes = selectionDurationSlots * 10;
                          const durationHours = Math.floor(durationMinutes / 60);
                          const durationMins = durationMinutes % 60;
                          const durationLabel = durationHours > 0 && durationMins > 0
                            ? `${durationHours}h ${durationMins}m`
                            : durationHours > 0
                              ? `${durationHours}h`
                              : `${durationMins}m`;
                          const entry = (scheduleEntries || []).find((ev: ScheduleEntry) => {
                            if (ev.staffId !== staff.id || ev.scheduledDate !== selectedDateStr || ev.status === "cancelled") return false;
                            const es = timeToSlot(ev.startTime);
                            const ee = ev.endTime ? timeToSlot(ev.endTime) : es + SLOTS_PER_HOUR;
                            return cellEndSlot > es && cellStartSlot <= ee;
                          });
                          const entryStartSlot = entry ? timeToSlot(entry.startTime) : 0;
                          const entryEndSlot = entry
                            ? (entry.endTime ? timeToSlot(entry.endTime) : entryStartSlot + SLOTS_PER_HOUR)
                            : 0;
                          const startMatch = entry != null && Math.floor(entryStartSlot / SLOTS_PER_HOUR) === hour;
                          const durationSlots = startMatch ? Math.max(1, entryEndSlot - entryStartSlot + 1) : 0;
                          const leftPct = startMatch ? ((entryStartSlot % SLOTS_PER_HOUR) / SLOTS_PER_HOUR) * 100 : 0;
                          const widthPct = startMatch ? (durationSlots / SLOTS_PER_HOUR) * 100 : 0;
                          return (
                            <div
                              key={`${staff.id}-${hour}`}
                              className={`border-b border-r min-h-[55px] relative overflow-visible ${startMatch ? "p-0" : ""}`}
                              onPointerDown={(e) => handlePointerDown(staff.id, hour, e)}
                              onPointerMove={(e) => handlePointerMove(staff.id, hour, e)}
                              onPointerUp={handlePointerUp}
                            >
                              {hasSelectionInCell && (
                                <>
                                  <div
                                    className="absolute inset-y-0 bg-primary/20 ring-1 ring-primary pointer-events-none rounded-sm z-[1]"
                                    style={{ left: `${selectionLeftPct}%`, width: `${selectionWidthPct}%` }}
                                  />
                                  {isDurationCenterInCell && (
                                    <div
                                      className="absolute bottom-1 -translate-x-1/2 z-[2] pointer-events-none px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary text-primary-foreground whitespace-nowrap"
                                      style={{ left: `${durationCenterLeftPct}%` }}
                                    >
                                      {durationLabel}
                                    </div>
                                  )}
                                </>
                              )}
                              {isStartSlotInCell && (
                                <div className="absolute inset-y-0 z-[2] pointer-events-none" style={{ left: `${startMarkerLeftPct}%` }}>
                                  <div className="absolute top-0.5 left-1 px-1 py-0.5 rounded text-[10px] font-medium bg-primary text-primary-foreground whitespace-nowrap shadow-sm border border-primary-foreground/20">
                                    {slotToTime(dragStart)}
                                  </div>
                                  <div className="absolute inset-y-0 w-0.5 bg-primary left-0" title={`Start ${slotToTime(dragStart)}`} />
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary border-2 border-background shadow-sm" />
                                </div>
                              )}
                              {entryDrag?.entry.staffId === staff.id && dropTargetSlot != null && Math.floor(dropTargetSlot / SLOTS_PER_HOUR) === hour && (
                                <div
                                  className="absolute inset-y-0 z-[5] rounded px-1 py-0.5 text-xs text-white flex flex-col justify-center pointer-events-none border-2 border-dashed border-primary opacity-95"
                                  style={{
                                    left: `${((dropTargetSlot % SLOTS_PER_HOUR) / SLOTS_PER_HOUR) * 100}%`,
                                    width: `${(entryDrag.durationSlots / SLOTS_PER_HOUR) * 100}%`,
                                    minWidth: 0,
                                    backgroundColor: entryDrag.entry.activityId && getActivityColor(entryDrag.entry) ? getActivityColor(entryDrag.entry)! : "hsl(var(--primary))",
                                  }}
                                >
                                  <span className="text-[10px] font-medium opacity-90 whitespace-nowrap">{slotToTime(dropTargetSlot)}</span>
                                  <span className="truncate">{getEntryLabel(entryDrag.entry)}</span>
                                </div>
                              )}
                              {startMatch && entry && (
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={`group absolute inset-y-0 z-10 rounded px-1 py-0.5 text-xs text-white truncate flex items-center cursor-grab active:cursor-grabbing hover:opacity-95 ${
                                    entry.activityId ? "" : getStatusColor(entry.status || "scheduled")
                                  } ${entryDrag?.entry.id === entry.id ? "opacity-20" : ""}`}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    minWidth: 0,
                                    ...(entry.activityId && getActivityColor(entry)
                                      ? { backgroundColor: getActivityColor(entry)! }
                                      : {}),
                                  }}
                                  title={getEntryLabel(entry)}
                                  onPointerDown={(e) => handleEntryBlockPointerDown(entry, durationSlots, e)}
                                >
                                  <span className="truncate flex-1 min-w-0">{getEntryLabel(entry)}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-white/20 text-white rounded p-0"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      deleteScheduleMutation.mutate(entry.id);
                                    }}
                                    aria-label="Delete schedule entry"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
        <Card className="lg:col-span-3 overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth(-1)}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold">
                  {monthName} {year}
                </h2>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth(1)}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" onClick={goToToday} data-testid="button-today">
              Today
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => (
                    <Skeleton key={day} className="h-8" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(35)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <div
                      key={index}
                      className={`min-h-[100px] rounded-md border p-2 transition-colors ${
                        day.isCurrentMonth
                          ? "bg-background"
                          : "bg-muted/30 text-muted-foreground"
                      } ${
                        day.isToday
                          ? "border-primary ring-1 ring-primary"
                          : "border-border"
                      }`}
                      data-testid={`calendar-day-${day.date.getDate()}`}
                    >
                      <div
                        className={`mb-1 text-sm font-medium ${
                          day.isToday ? "text-primary" : ""
                        }`}
                      >
                        {day.date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {day.schedules.slice(0, 3).map(({ entry, job, activity }) => (
                          job ? (
                            <Link
                              key={entry.id}
                              href={`/jobs/${job.id}`}
                              className="block"
                            >
                              <div
                                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white truncate ${
                                  entry.status === "completed"
                                    ? "bg-emerald-500"
                                    : getStatusColor(job.status)
                                }`}
                              >
                                {entry.status === "completed" && (
                                  <CheckCircle className="h-3 w-3 flex-shrink-0" />
                                )}
                                <span className="truncate">{job.clientName}</span>
                              </div>
                            </Link>
                          ) : (
                            <div
                              key={entry.id}
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white truncate bg-violet-500"
                            >
                              <span className="truncate">{activity?.name ?? "Activity"}</span>
                            </div>
                          )
                        ))}
                        {day.schedules.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1.5">
                            +{day.schedules.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-base">Upcoming Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingJobs.length === 0 ? (
                <div className="py-8 text-center">
                  <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No upcoming scheduled jobs
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingJobs.map((entry) => {
                    const label = entry.job?.clientName ?? entry.activity?.name ?? "—";
                    const href = entry.jobId ? `/jobs/${entry.jobId}` : undefined;
                    const Wrapper = href ? Link : "div";
                    return (
                      <Wrapper
                        key={entry.id}
                        {...(href ? { href, className: "flex items-start gap-3 rounded-md p-2 hover-elevate active-elevate-2" } : { className: "flex items-start gap-3 rounded-md p-2" })}
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-md bg-primary/10">
                          <span className="text-xs font-bold text-primary">
                            {new Date(entry.scheduledDate).getDate()}
                          </span>
                          <span className="text-[10px] uppercase text-primary">
                            {new Date(entry.scheduledDate).toLocaleString("default", { month: "short" })}
                          </span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium">{label}</p>
                          {entry.job && (
                            <Badge variant="secondary" className={`text-xs ${getStatusColor(entry.job.status).replace("bg-", "bg-opacity-20 text-")}`}>
                              {formatStatus(entry.job.status)}
                            </Badge>
                          )}
                          {entry.activity && (
                            <Badge variant="secondary" className="text-xs bg-violet-500/20 text-violet-700 dark:text-violet-300">Activity</Badge>
                          )}
                        </div>
                      </Wrapper>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader>
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { status: "pending", label: "Pending" },
                  { status: "scheduled", label: "Scheduled" },
                  { status: "in_progress", label: "In Progress" },
                  { status: "on_hold", label: "On Hold" },
                  { status: "completed", label: "Completed" },
                  { status: "cancelled", label: "Cancelled" },
                ].map(({ status, label }) => (
                  <div key={status} className="flex items-center gap-2">
                    <div
                      className={`h-3 w-3 rounded-full ${getStatusColor(status)}`}
                    />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {dragSelection && dragCurrentTime != null && dragTooltipPos && (
        <div
          className="fixed z-50 pointer-events-none rounded bg-primary text-primary-foreground px-2 py-1 text-xs font-mono shadow-md"
          style={{ left: dragTooltipPos.x + 12, top: dragTooltipPos.y + 8 }}
        >
          {dragCurrentTime}
        </div>
      )}

      <Sheet open={rightSheetOpen} onOpenChange={(open) => {
        setRightSheetOpen(open);
        if (!open) {
          setDragSelection(null);
          setEditingEntry(null);
          setDragCurrentTime(null);
          setDragTooltipPos(null);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingEntry ? "Edit schedule entry" : "Assign to slot"}</SheetTitle>
          </SheetHeader>
          {(dragSelection || editingEntry) && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {(editingEntry?.scheduledDate ?? dragSelection?.scheduledDate ?? selectedDateStr)
                  ? new Date(editingEntry?.scheduledDate ?? dragSelection?.scheduledDate ?? selectedDateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                  : selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <div>
                <Label className="text-sm font-medium mb-2 block">Staff</Label>
                <Popover open={staffComboboxOpen} onOpenChange={setStaffComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={staffComboboxOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedSlotStaffId
                        ? (() => {
                            const s = staffList.find((x) => x.id === selectedSlotStaffId);
                            return s ? (s.userId?.split("@")[0] || s.id.slice(0, 8)) : "Select staff...";
                          })()
                        : "Select staff..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search staff..." />
                      <CommandList>
                        <CommandEmpty>No staff found.</CommandEmpty>
                        <CommandGroup>
                          {staffList.map((staff) => (
                            <CommandItem
                              key={staff.id}
                              value={staff.userId ?? staff.id}
                              onSelect={() => {
                                setSelectedSlotStaffId(staff.id);
                                setStaffComboboxOpen(false);
                              }}
                            >
                              {staff.userId?.split("@")[0] || staff.id.slice(0, 8)}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Start time</Label>
                  <Input
                    type="time"
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">End time</Label>
                  <Input
                    type="time"
                    value={slotEndTime}
                    onChange={(e) => setSlotEndTime(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Job</Label>
                <Popover open={jobComboboxOpen} onOpenChange={setJobComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={jobComboboxOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedSlotJobId
                        ? (() => {
                            const j = jobs?.find((x) => x.id === selectedSlotJobId);
                            return j ? `${j.clientName} – ${j.jobType}` : "Select job...";
                          })()
                        : "Select job..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search jobs..." />
                      <CommandList>
                        <CommandEmpty>No job found.</CommandEmpty>
                        <CommandGroup>
                          {jobs?.filter((j) => j.status !== "completed" && j.status !== "cancelled").map((job) => (
                            <CommandItem
                              key={job.id}
                              value={`${job.clientName} ${job.jobType}`}
                              onSelect={() => {
                                setSelectedSlotJobId(job.id);
                                setSelectedSlotActivityId(null);
                                setJobComboboxOpen(false);
                              }}
                            >
                              {job.clientName} – {job.jobType}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Activities</h3>
                <ScrollArea className="h-32 rounded border p-2">
                  {(activities ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activities</p>
                  ) : (
                    <ul className="space-y-1">
                      {(activities ?? []).map((a) => (
                        <li key={a.id}>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`w-full justify-start ${selectedSlotActivityId === a.id ? "bg-violet-500/20 border-violet-500" : "bg-violet-500/10 border-violet-500/30"}`}
                            onClick={() => {
                              setSelectedSlotActivityId(a.id);
                              setSelectedSlotJobId(null);
                            }}
                            disabled={createScheduleEntryMutation.isPending || updateScheduleEntryMutation.isPending}
                          >
                            {a.name}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </div>
              <div className="flex gap-2">
                {editingEntry ? (
                  <>
                    <Button
                      className="flex-1"
                      disabled={(!selectedSlotJobId && !selectedSlotActivityId) || !slotStartTime.trim() || !slotEndTime.trim() || !selectedSlotStaffId || updateScheduleEntryMutation.isPending}
                      onClick={handleSaveEdit}
                    >
                      {updateScheduleEntryMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRightSheetOpen(false); setEditingEntry(null); }}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="flex-1"
                      disabled={(!selectedSlotJobId && !selectedSlotActivityId) || createScheduleEntryMutation.isPending}
                      onClick={() => handleConfirmAssignment()}
                    >
                      {createScheduleEntryMutation.isPending ? "Assigning..." : "Assign"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRightSheetOpen(false); setDragSelection(null); }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
