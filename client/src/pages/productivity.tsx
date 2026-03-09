import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Clock, Plus, Users, TrendingUp, Calendar as CalendarIcon, Briefcase } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job, StaffProfile, JobTimeEntry, StaffProductivityMetrics } from "@shared/schema";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";

export default function ProductivityPage() {
  const { toast } = useToast();
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    to: format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  });

  const [newEntry, setNewEntry] = useState({
    jobId: "",
    workDate: format(new Date(), "yyyy-MM-dd"),
    hoursWorked: "",
    category: "labor",
    isBillable: true,
    hourlyRate: "",
    notes: "",
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<StaffProductivityMetrics[]>({
    queryKey: [`/api/productivity/metrics?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`],
  });

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<JobTimeEntry[]>({
    queryKey: [`/api/time-entries?dateFrom=${dateRange.from}&dateTo=${dateRange.to}`],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: staff } = useQuery<(StaffProfile & { user?: { firstName?: string; lastName?: string } })[]>({
    queryKey: ["/api/staff"],
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: typeof newEntry) => {
      return apiRequest("POST", `/api/jobs/${data.jobId}/time-entries`, {
        ...data,
        staffId: selectedStaffId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0]?.toString().startsWith("/api/time-entries") ||
        query.queryKey[0]?.toString().startsWith("/api/productivity/metrics")
      });
      toast({ title: "Time entry added successfully" });
      setIsAddEntryOpen(false);
      setNewEntry({
        jobId: "",
        workDate: format(new Date(), "yyyy-MM-dd"),
        hoursWorked: "",
        category: "labor",
        isBillable: true,
        hourlyRate: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error adding time entry", description: error.message, variant: "destructive" });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/time-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0]?.toString().startsWith("/api/time-entries") ||
        query.queryKey[0]?.toString().startsWith("/api/productivity/metrics")
      });
      toast({ title: "Time entry deleted" });
    },
  });

  const totalHours = metrics?.reduce((sum, m) => sum + m.totalHours, 0) || 0;
  const totalBillable = metrics?.reduce((sum, m) => sum + m.billableHours, 0) || 0;
  const avgUtilization = metrics && metrics.length > 0
    ? metrics.reduce((sum, m) => sum + m.utilizationRate, 0) / metrics.length
    : 0;

  const handleSubmit = () => {
    if (!newEntry.jobId || !newEntry.hoursWorked) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createEntryMutation.mutate(newEntry);
  };

  const setWeekRange = (weeksAgo: number) => {
    const targetDate = subWeeks(new Date(), weeksAgo);
    setDateRange({
      from: format(startOfWeek(targetDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      to: format(endOfWeek(targetDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    });
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-productivity">Time Tracking & Productivity</h1>
          <p className="text-muted-foreground">Track time entries and view staff productivity metrics</p>
        </div>
        <Button onClick={() => setIsAddEntryOpen(true)} data-testid="button-add-time-entry">
          <Plus className="mr-2 h-4 w-4" />
          Log Time
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={dateRange.from === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd") ? "default" : "outline"} size="sm" onClick={() => setWeekRange(0)}>
          This Week
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekRange(1)}>
          Last Week
        </Button>
        <Button variant="outline" size="sm" onClick={() => setWeekRange(2)}>
          2 Weeks Ago
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="w-auto"
            data-testid="input-date-from"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="w-auto"
            data-testid="input-date-to"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-hours">{totalHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Logged this period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Billable Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-billable-hours">{totalBillable.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Chargeable to clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-utilization">{avgUtilization.toFixed(0)}%</div>
            <Progress value={avgUtilization} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-staff">
              {metrics?.filter(m => m.totalHours > 0).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">With logged time</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList>
          <TabsTrigger value="entries" data-testid="tab-entries">Time Entries</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">Staff Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Time Entries</CardTitle>
              <CardDescription>All time logged during the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : timeEntries && timeEntries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeEntries.map((entry) => {
                      const job = jobs?.find(j => j.id === entry.jobId);
                      const staffMember = staff?.find(s => s.id === entry.staffId);
                      return (
                        <TableRow key={entry.id} data-testid={`row-time-entry-${entry.id}`}>
                          <TableCell>{format(new Date(entry.workDate), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <UserAvatar user={staffMember?.user} size="sm" />
                              {staffMember?.user?.firstName || staffMember?.user?.lastName
                                ? `${staffMember.user.firstName || ""} ${staffMember.user.lastName || ""}`.trim()
                                : "Unknown"}
                            </span>
                          </TableCell>
                          <TableCell>{job?.clientName || "Unknown Job"}</TableCell>
                          <TableCell className="font-medium">{entry.hoursWorked}h</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{entry.category || "labor"}</Badge>
                          </TableCell>
                          <TableCell>
                            {entry.isBillable ? (
                              <Badge variant="default">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteEntryMutation.mutate(entry.id)}
                              data-testid={`button-delete-entry-${entry.id}`}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No time entries for this period</p>
                  <p className="text-sm">Click "Log Time" to add your first entry</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Productivity</CardTitle>
              <CardDescription>Hours logged and utilization by team member</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : metrics && metrics.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Billable Hours</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Jobs Worked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map((metric) => (
                      <TableRow key={metric.staffId} data-testid={`row-staff-metric-${metric.staffId}`}>
                        <TableCell className="font-medium">{metric.staffName}</TableCell>
                        <TableCell>{metric.totalHours.toFixed(1)}h</TableCell>
                        <TableCell>{metric.billableHours.toFixed(1)}h</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={metric.utilizationRate} className="w-20" />
                            <span className="text-sm">{metric.utilizationRate.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{metric.jobsWorked}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No productivity data for this period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Time Entry</DialogTitle>
            <DialogDescription>Record time worked on a job</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Job *</Label>
              <Select value={newEntry.jobId} onValueChange={(v) => setNewEntry({ ...newEntry, jobId: v })}>
                <SelectTrigger data-testid="select-job">
                  <SelectValue placeholder="Select job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newEntry.workDate}
                  onChange={(e) => setNewEntry({ ...newEntry, workDate: e.target.value })}
                  data-testid="input-work-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Hours Worked *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g., 8"
                  value={newEntry.hoursWorked}
                  onChange={(e) => setNewEntry({ ...newEntry, hoursWorked: e.target.value })}
                  data-testid="input-hours-worked"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={newEntry.category} onValueChange={(v) => setNewEntry({ ...newEntry, category: v })}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="break">Break</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={newEntry.hourlyRate}
                  onChange={(e) => setNewEntry({ ...newEntry, hourlyRate: e.target.value })}
                  data-testid="input-hourly-rate"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes about the work done"
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEntryOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createEntryMutation.isPending} data-testid="button-submit-entry">
              {createEntryMutation.isPending ? "Saving..." : "Log Time"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
