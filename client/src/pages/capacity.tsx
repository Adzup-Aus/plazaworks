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
import { BarChart3, Users, Calendar as CalendarIcon, AlertTriangle, ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { StaffCapacityView, StaffProfile, StaffTimeOff, StaffCapacityRule } from "@shared/schema";
import { format, startOfWeek, addWeeks, subWeeks, addDays } from "date-fns";

type StaffWithUser = StaffProfile & { user?: { firstName?: string; lastName?: string; email?: string } };

function staffDisplayName(s: StaffWithUser): string {
  const first = s.user?.firstName ?? "";
  const last = s.user?.lastName ?? "";
  const name = `${first} ${last}`.trim();
  return name || (s.user?.email ?? "Unknown");
}

export default function CapacityPage() {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [isCapacityRuleOpen, setIsCapacityRuleOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const [newTimeOff, setNewTimeOff] = useState({
    staffId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [newCapacityRule, setNewCapacityRule] = useState({
    staffId: "",
    mondayHours: "8",
    tuesdayHours: "8",
    wednesdayHours: "8",
    thursdayHours: "8",
    fridayHours: "8",
    saturdayHours: "0",
    sundayHours: "0",
  });

  const { data: capacity, isLoading: capacityLoading } = useQuery<StaffCapacityView[]>({
    queryKey: [`/api/capacity?weekStart=${weekStart}`],
  });

  const { data: staff } = useQuery<StaffWithUser[]>({
    queryKey: ["/api/staff"],
  });

  const weekEndDate = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
  const { data: timeOff } = useQuery<StaffTimeOff[]>({
    queryKey: [`/api/time-off?dateFrom=${weekStart}&dateTo=${weekEndDate}`],
  });

  const { data: capacityRules } = useQuery<StaffCapacityRule[]>({
    queryKey: ["/api/capacity-rules"],
  });

  const createTimeOffMutation = useMutation({
    mutationFn: async (data: typeof newTimeOff) => {
      return apiRequest("POST", "/api/time-off", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) =>
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/time-off")
      });
      queryClient.invalidateQueries({ predicate: (query) =>
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/capacity")
      });
      toast({ title: "Time off request created" });
      setIsTimeOffOpen(false);
      setNewTimeOff({ staffId: "", startDate: "", endDate: "", reason: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error creating time off", description: error.message, variant: "destructive" });
    },
  });

  const approveTimeOffMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/time-off/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) =>
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/time-off")
      });
      queryClient.invalidateQueries({ predicate: (query) =>
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/capacity")
      });
      toast({ title: "Time off approved" });
    },
  });

  const rejectTimeOffMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/time-off/${id}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) =>
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/time-off")
      });
      queryClient.invalidateQueries({ predicate: (query) =>
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/capacity")
      });
      toast({ title: "Time off rejected" });
    },
  });

  const createCapacityRuleMutation = useMutation({
    mutationFn: async (data: typeof newCapacityRule) => {
      return apiRequest("POST", "/api/capacity-rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-rules"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0]?.toString() ?? "").startsWith("/api/capacity")
      });
      toast({ title: "Capacity rule saved" });
      setIsCapacityRuleOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error saving capacity rule", description: error.message, variant: "destructive" });
    },
  });

  const navigateWeek = (direction: "prev" | "next") => {
    const current = new Date(weekStart);
    const newDate = direction === "prev" ? subWeeks(current, 1) : addWeeks(current, 1);
    setWeekStart(format(newDate, "yyyy-MM-dd"));
  };

  const totalCapacity = capacity?.reduce((sum, s) => sum + s.weeklyCapacity, 0) || 0;
  const totalScheduled = capacity?.reduce((sum, s) => sum + s.scheduledHours, 0) || 0;
  const totalAvailable = capacity?.reduce((sum, s) => sum + s.availableHours, 0) || 0;
  const avgUtilization = capacity && capacity.length > 0
    ? capacity.reduce((sum, s) => sum + s.utilizationPercent, 0) / capacity.length
    : 0;

  const overloadedStaff = capacity?.filter(s => s.utilizationPercent > 100) || [];
  const underutilizedStaff = capacity?.filter(s => s.utilizationPercent < 50 && s.weeklyCapacity > 0) || [];

  const getUtilizationColor = (percent: number) => {
    if (percent > 100) return "text-red-600 dark:text-red-400";
    if (percent > 80) return "text-amber-600 dark:text-amber-400";
    if (percent < 50) return "text-blue-600 dark:text-blue-400";
    return "text-green-600 dark:text-green-400";
  };

  const getUtilizationBadge = (percent: number) => {
    if (percent > 100) return <Badge variant="destructive">Overloaded</Badge>;
    if (percent > 80) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">High</Badge>;
    if (percent < 50) return <Badge variant="secondary">Low</Badge>;
    return <Badge variant="default">Optimal</Badge>;
  };

  const handleSubmitTimeOff = () => {
    if (!newTimeOff.staffId || !newTimeOff.startDate || !newTimeOff.endDate) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createTimeOffMutation.mutate(newTimeOff);
  };

  const handleSubmitCapacityRule = () => {
    if (!newCapacityRule.staffId) {
      toast({ title: "Please select a staff member", variant: "destructive" });
      return;
    }
    createCapacityRuleMutation.mutate(newCapacityRule);
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-capacity">Capacity Planning</h1>
          <p className="text-muted-foreground">Manage staff workload and availability</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsTimeOffOpen(true)} data-testid="button-add-time-off">
            <CalendarIcon className="mr-2 h-4 w-4" />
            Request Time Off
          </Button>
          <Button onClick={() => setIsCapacityRuleOpen(true)} data-testid="button-set-capacity">
            <Clock className="mr-2 h-4 w-4" />
            Set Availability
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigateWeek("prev")} data-testid="button-prev-week">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <span className="text-lg font-medium">
            Week of {format(new Date(weekStart), "MMM d, yyyy")}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigateWeek("next")} data-testid="button-next-week">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-capacity">{totalCapacity.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">Available hours this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-scheduled">{totalScheduled.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">Planned work hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-available">{totalAvailable.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">Remaining capacity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Utilization</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-utilization">{avgUtilization.toFixed(0)}%</div>
            <Progress value={Math.min(avgUtilization, 100)} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {(overloadedStaff.length > 0 || underutilizedStaff.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {overloadedStaff.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Overloaded Staff
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overloadedStaff.map((s) => (
                    <div key={s.staffId} className="flex items-center justify-between">
                      <span>{s.staffName}</span>
                      <Badge variant="destructive">{s.utilizationPercent.toFixed(0)}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {underutilizedStaff.length > 0 && (
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Users className="h-4 w-4" />
                  Available Capacity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {underutilizedStaff.map((s) => (
                    <div key={s.staffId} className="flex items-center justify-between">
                      <span>{s.staffName}</span>
                      <span className="text-sm text-muted-foreground">{s.availableHours.toFixed(0)}h free</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Staff Overview</TabsTrigger>
          <TabsTrigger value="time-off" data-testid="tab-time-off">Time Off Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Capacity</CardTitle>
              <CardDescription>Workload distribution for the week</CardDescription>
            </CardHeader>
            <CardContent>
              {capacityLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : capacity && capacity.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Scheduled</TableHead>
                      <TableHead className="text-right">Logged</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacity.map((staff) => (
                      <TableRow key={staff.staffId} data-testid={`row-staff-${staff.staffId}`}>
                        <TableCell className="font-medium">{staff.staffName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{staff.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{staff.weeklyCapacity.toFixed(0)}h</TableCell>
                        <TableCell className="text-right">{staff.scheduledHours.toFixed(0)}h</TableCell>
                        <TableCell className="text-right">{staff.loggedHours.toFixed(0)}h</TableCell>
                        <TableCell className="text-right">{staff.availableHours.toFixed(0)}h</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(staff.utilizationPercent, 100)} className="w-16" />
                            <span className={`text-sm ${getUtilizationColor(staff.utilizationPercent)}`}>
                              {staff.utilizationPercent.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getUtilizationBadge(staff.utilizationPercent)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No capacity data available</p>
                  <p className="text-sm">Set availability rules to see capacity planning</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-off" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Time Off Requests</CardTitle>
              <CardDescription>Pending and approved leave requests</CardDescription>
            </CardHeader>
            <CardContent>
              {timeOff && timeOff.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeOff.map((request) => {
                      const staffMember = staff?.find(s => s.id === request.staffId);
                      return (
                        <TableRow key={request.id} data-testid={`row-time-off-${request.id}`}>
                          <TableCell className="font-medium">
                            {staffMember ? staffDisplayName(staffMember) : "Unknown"}
                          </TableCell>
                          <TableCell>{format(new Date(request.startDate), "MMM d, yyyy")}</TableCell>
                          <TableCell>{format(new Date(request.endDate), "MMM d, yyyy")}</TableCell>
                          <TableCell>{request.reason || "-"}</TableCell>
                          <TableCell>
                            {request.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                            {request.status === "approved" && <Badge variant="default">Approved</Badge>}
                            {request.status === "rejected" && <Badge variant="destructive">Rejected</Badge>}
                          </TableCell>
                          <TableCell>
                            {request.status === "pending" && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approveTimeOffMutation.mutate(request.id)}
                                  data-testid={`button-approve-${request.id}`}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => rejectTimeOffMutation.mutate(request.id)}
                                  data-testid={`button-reject-${request.id}`}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No time off requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isTimeOffOpen} onOpenChange={setIsTimeOffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
            <DialogDescription>Submit a leave request for a team member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={newTimeOff.staffId} onValueChange={(v) => setNewTimeOff({ ...newTimeOff, staffId: v })}>
                <SelectTrigger data-testid="select-time-off-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {staffDisplayName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={newTimeOff.startDate}
                  onChange={(e) => setNewTimeOff({ ...newTimeOff, startDate: e.target.value })}
                  data-testid="input-time-off-start"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={newTimeOff.endDate}
                  onChange={(e) => setNewTimeOff({ ...newTimeOff, endDate: e.target.value })}
                  data-testid="input-time-off-end"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                placeholder="e.g., Annual leave, Sick leave"
                value={newTimeOff.reason}
                onChange={(e) => setNewTimeOff({ ...newTimeOff, reason: e.target.value })}
                data-testid="input-time-off-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTimeOffOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitTimeOff} disabled={createTimeOffMutation.isPending} data-testid="button-submit-time-off">
              {createTimeOffMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCapacityRuleOpen} onOpenChange={setIsCapacityRuleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Weekly Availability</DialogTitle>
            <DialogDescription>Configure default working hours for a staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={newCapacityRule.staffId} onValueChange={(v) => setNewCapacityRule({ ...newCapacityRule, staffId: v })}>
                <SelectTrigger data-testid="select-capacity-staff">
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {staffDisplayName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((day) => (
                <div key={day} className="space-y-1">
                  <Label className="text-xs capitalize">{day.slice(0, 3)}</Label>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={(newCapacityRule as any)[`${day}Hours`]}
                    onChange={(e) => setNewCapacityRule({ ...newCapacityRule, [`${day}Hours`]: e.target.value })}
                    className="text-center"
                    data-testid={`input-${day}-hours`}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCapacityRuleOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitCapacityRule} disabled={createCapacityRuleMutation.isPending} data-testid="button-submit-capacity">
              {createCapacityRuleMutation.isPending ? "Saving..." : "Save Availability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
