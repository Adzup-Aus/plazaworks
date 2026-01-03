import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Briefcase,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job, ScheduleEntry } from "@shared/schema";

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  jobs: Job[];
};

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

export default function Schedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const { toast } = useToast();

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: scheduleEntries, isLoading: scheduleLoading } = useQuery<ScheduleEntry[]>({
    queryKey: ["/api/schedule"],
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: { jobId: string; scheduledDate: string; notes?: string }) => {
      const res = await apiRequest("POST", "/api/schedule", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setIsAddDialogOpen(false);
      setSelectedJob("");
      setSelectedDate("");
      setNotes("");
      toast({
        title: "Schedule Entry Created",
        description: "The job has been scheduled successfully.",
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

  const handleCreateSchedule = () => {
    if (!selectedJob || !selectedDate) {
      toast({
        title: "Error",
        description: "Please select a job and date.",
        variant: "destructive",
      });
      return;
    }
    createScheduleMutation.mutate({
      jobId: selectedJob,
      scheduledDate: selectedDate,
      notes: notes || undefined,
    });
  };

  const isLoading = jobsLoading || scheduleLoading;

  const unscheduledJobs = useMemo(() => {
    if (!jobs) return [];
    const scheduledJobIds = new Set((scheduleEntries || []).map((e) => e.jobId));
    return jobs.filter((job) => !scheduledJobIds.has(job.id) && job.status !== "completed" && job.status !== "cancelled");
  }, [jobs, scheduleEntries]);

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

    const prevMonthDays = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        jobs: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dateStr = date.toISOString().split("T")[0];
      
      const dayJobs = (scheduleEntries || [])
        .filter((entry) => entry.scheduledDate === dateStr)
        .map((entry) => jobs?.find((j) => j.id === entry.jobId))
        .filter((j): j is Job => !!j);

      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        jobs: dayJobs,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        jobs: [],
      });
    }

    return days;
  }, [currentDate, jobs, scheduleEntries]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const upcomingJobs = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    return (scheduleEntries || [])
      .filter((entry) => entry.scheduledDate >= todayStr)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        job: jobs?.find((j) => j.id === entry.jobId),
      }))
      .filter((e) => e.job);
  }, [scheduleEntries, jobs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            View and manage job schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-job">
                <CalendarIcon className="mr-2 h-4 w-4" />
                Schedule Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Schedule a Job</DialogTitle>
                <DialogDescription>
                  Select a job and date to add it to the schedule.
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
                      {unscheduledJobs.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No unscheduled jobs available
                        </SelectItem>
                      ) : (
                        unscheduledJobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.clientName} - {job.jobType}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    data-testid="input-schedule-date"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any scheduling notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    data-testid="input-schedule-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel-schedule"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSchedule}
                  disabled={createScheduleMutation.isPending || !selectedJob || !selectedDate}
                  data-testid="button-confirm-schedule"
                >
                  {createScheduleMutation.isPending ? "Scheduling..." : "Schedule"}
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
                        {day.jobs.slice(0, 3).map((job) => (
                          <Link
                            key={job.id}
                            href={`/jobs/${job.id}`}
                            className="block"
                          >
                            <div
                              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white truncate ${getStatusColor(
                                job.status
                              )}`}
                            >
                              <span className="truncate">{job.clientName}</span>
                            </div>
                          </Link>
                        ))}
                        {day.jobs.length > 3 && (
                          <div className="text-xs text-muted-foreground px-1.5">
                            +{day.jobs.length - 3} more
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
                  {upcomingJobs.map((entry) => (
                    <Link
                      key={entry.id}
                      href={`/jobs/${entry.jobId}`}
                      className="flex items-start gap-3 rounded-md p-2 hover-elevate active-elevate-2"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-md bg-primary/10">
                        <span className="text-xs font-bold text-primary">
                          {new Date(entry.scheduledDate).getDate()}
                        </span>
                        <span className="text-[10px] uppercase text-primary">
                          {new Date(entry.scheduledDate).toLocaleString("default", {
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate text-sm font-medium">
                          {entry.job?.clientName}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              entry.job
                                ? getStatusColor(entry.job.status).replace(
                                    "bg-",
                                    "bg-opacity-20 text-"
                                  )
                                : ""
                            }`}
                          >
                            {entry.job ? formatStatus(entry.job.status) : "Unknown"}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
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
  );
}
