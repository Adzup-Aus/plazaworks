import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { TrendingUp, Target, DollarSign, Clock, Award, AlertTriangle, CheckCircle, Bell, ChevronUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KpiDashboardDaily, KpiDashboardWeekly, TradesmanKpiSummary, KpiAlert, KpiTarget, StaffProfile } from "@shared/schema";
import { format, startOfWeek, subWeeks } from "date-fns";

export default function KpiDashboardPage() {
  const { toast } = useToast();
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );

  const { data: dailyDashboard, isLoading: dailyLoading } = useQuery<KpiDashboardDaily[]>({
    queryKey: [`/api/kpi/dashboard/daily?date=${selectedDate}`],
  });

  const { data: weeklyDashboard, isLoading: weeklyLoading } = useQuery<KpiDashboardWeekly[]>({
    queryKey: [`/api/kpi/dashboard/weekly?weekStart=${selectedWeekStart}`],
  });

  const { data: staff } = useQuery<(StaffProfile & { user?: { firstName?: string; lastName?: string; email?: string } })[]>({
    queryKey: ["/api/staff"],
  });

  const { data: alerts } = useQuery<KpiAlert[]>({
    queryKey: ["/api/kpi/alerts?acknowledged=false"],
  });

  const { data: targets } = useQuery<KpiTarget[]>({
    queryKey: ["/api/kpi/targets"],
  });

  const { data: staffSummary, isLoading: summaryLoading } = useQuery<TradesmanKpiSummary>({
    queryKey: [`/api/kpi/staff/${selectedStaffId}/summary`],
    enabled: !!selectedStaffId,
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/kpi/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/alerts"] });
      toast({ title: "Alert acknowledged" });
    },
  });

  const advancePhaseMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return apiRequest("POST", `/api/kpi/staff/${staffId}/advance-phase`, { notes: "Manual advancement" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kpi/staff"] });
      toast({ title: "Sales phase advanced successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: "green" | "amber" | "red") => {
    switch (status) {
      case "green":
        return <Badge className="bg-green-500 text-white" data-testid="badge-status-green"><CheckCircle className="w-3 h-3 mr-1" />On Target</Badge>;
      case "amber":
        return <Badge className="bg-amber-500 text-white" data-testid="badge-status-amber"><AlertTriangle className="w-3 h-3 mr-1" />75%+ Target</Badge>;
      case "red":
        return <Badge className="bg-red-500 text-white" data-testid="badge-status-red"><AlertTriangle className="w-3 h-3 mr-1" />Below Target</Badge>;
    }
  };

  const getPhaseLabel = (phase: number) => {
    switch (phase) {
      case 1: return "Phase 1 - Learning";
      case 2: return "Phase 2 - Growing";
      case 3: return "Phase 3 - Full Performer";
      default: return `Phase ${phase}`;
    }
  };

  const totalDailyLabor = dailyDashboard?.reduce((sum, d) => sum + d.laborRevenue, 0) || 0;
  const totalDailyTarget = dailyDashboard?.reduce((sum, d) => sum + d.targetLabor, 0) || 0;
  const dailyTargetMet = dailyDashboard?.filter(d => d.targetMet).length || 0;
  const unacknowledgedAlerts = alerts?.filter(a => !a.acknowledged).length || 0;

  const setWeek = (weeksAgo: number) => {
    const targetDate = subWeeks(new Date(), weeksAgo);
    setSelectedWeekStart(format(startOfWeek(targetDate, { weekStartsOn: 1 }), "yyyy-MM-dd"));
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-kpi-dashboard">KPI Dashboard</h1>
          <p className="text-muted-foreground">Track tradesman performance, targets, and bonuses</p>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledgedAlerts > 0 && (
            <Button 
              variant="outline" 
              onClick={() => setIsAlertDialogOpen(true)}
              data-testid="button-view-alerts"
            >
              <Bell className="w-4 h-4 mr-2" />
              {unacknowledgedAlerts} Alerts
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Labor Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-daily-labor">
              ${totalDailyLabor.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Target: ${totalDailyTarget.toLocaleString()}
            </p>
            <Progress 
              value={totalDailyTarget > 0 ? (totalDailyLabor / totalDailyTarget) * 100 : 0} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff On Target</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-staff-on-target">
              {dailyTargetMet} / {dailyDashboard?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {dailyDashboard?.length ? Math.round((dailyTargetMet / dailyDashboard.length) * 100) : 0}% meeting daily target
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Team Config</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-team-config">
              {targets?.[0]?.teamConfig || "Not Set"}
            </div>
            <p className="text-xs text-muted-foreground">
              {targets?.length || 0} target configurations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-alert-count">
              {unacknowledgedAlerts}
            </div>
            <p className="text-xs text-muted-foreground">
              Unacknowledged alerts
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily" data-testid="tab-daily">Daily View</TabsTrigger>
          <TabsTrigger value="weekly" data-testid="tab-weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="individual" data-testid="tab-individual">Individual Details</TabsTrigger>
          <TabsTrigger value="targets" data-testid="tab-targets">Targets</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>Daily Performance</CardTitle>
                  <CardDescription>Staff labor revenue vs daily targets</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm"
                    data-testid="input-select-date"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : dailyDashboard?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Labor Revenue</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Hours Logged</TableHead>
                      <TableHead>Jobs Completed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyDashboard.map((row) => (
                      <TableRow key={row.staffId} data-testid={`row-daily-${row.staffId}`}>
                        <TableCell className="font-medium">{row.staffName}</TableCell>
                        <TableCell>${row.laborRevenue.toLocaleString()}</TableCell>
                        <TableCell>${row.targetLabor.toLocaleString()}</TableCell>
                        <TableCell>{row.hoursLogged.toFixed(1)}h</TableCell>
                        <TableCell>{row.jobsCompleted}</TableCell>
                        <TableCell>{getStatusBadge(row.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No data for selected date
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle>Weekly Performance</CardTitle>
                  <CardDescription>Week starting {selectedWeekStart}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWeek(0)} data-testid="button-this-week">
                    This Week
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeek(1)} data-testid="button-last-week">
                    Last Week
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeek(2)} data-testid="button-2-weeks-ago">
                    2 Weeks Ago
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {weeklyLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : weeklyDashboard?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Labor Revenue</TableHead>
                      <TableHead>Weekly Target</TableHead>
                      <TableHead>Close Rate</TableHead>
                      <TableHead>Days Target Met</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyDashboard.map((row) => (
                      <TableRow key={row.staffId} data-testid={`row-weekly-${row.staffId}`}>
                        <TableCell className="font-medium">{row.staffName}</TableCell>
                        <TableCell>${row.laborRevenue.toLocaleString()}</TableCell>
                        <TableCell>${row.targetLabor.toLocaleString()}</TableCell>
                        <TableCell>{row.closeRate}%</TableCell>
                        <TableCell>{row.daysTargetMet}/5</TableCell>
                        <TableCell>
                          {row.targetMet ? (
                            <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Met</Badge>
                          ) : (
                            <Badge className="bg-amber-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" />In Progress</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No data for selected week
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Individual Tradesman Details</CardTitle>
              <CardDescription>View detailed KPI summary and phase progression</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedStaffId || ""}
                  onValueChange={(value) => setSelectedStaffId(value)}
                >
                  <SelectTrigger className="w-64" data-testid="select-staff">
                    <SelectValue placeholder="Select a tradesman" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <UserAvatar user={s.user} size="sm" />
                          {s.user?.firstName 
                            ? `${s.user.firstName} ${s.user.lastName || ""}`.trim() 
                            : s.user?.email || "Unknown"}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStaffId && summaryLoading && (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              )}

              {staffSummary && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Daily Labor</span>
                        <span className="font-bold">${staffSummary.dailyLabor.toLocaleString()} / ${staffSummary.dailyTarget.toLocaleString()}</span>
                      </div>
                      <Progress value={(staffSummary.dailyLabor / staffSummary.dailyTarget) * 100} />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Weekly Labor</span>
                        <span className="font-bold">${staffSummary.weeklyLabor.toLocaleString()} / ${staffSummary.weeklyTarget.toLocaleString()}</span>
                      </div>
                      <Progress value={(staffSummary.weeklyLabor / staffSummary.weeklyTarget) * 100} />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Close Rate</span>
                        <span className="font-bold">{staffSummary.closeRate}%</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Target Streak</span>
                        <span className="font-bold">{staffSummary.streakDays} days</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Sales Phase & Bonus</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Current Phase</span>
                        <Badge variant="outline" className="text-lg">
                          <Award className="w-4 h-4 mr-2" />
                          {getPhaseLabel(staffSummary.salesPhase)}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Weeks at Phase</span>
                        <span className="font-bold">{staffSummary.weeksAtPhase}</span>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Projected Bonus</span>
                        <span className="font-bold text-green-600">${staffSummary.projectedBonus.toLocaleString()}</span>
                      </div>

                      {staffSummary.salesPhase < 3 && (
                        <Button
                          variant="outline"
                          onClick={() => advancePhaseMutation.mutate(staffSummary.staffId)}
                          disabled={advancePhaseMutation.isPending}
                          data-testid="button-advance-phase"
                        >
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Advance to Phase {staffSummary.salesPhase + 1}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {selectedStaffId && !summaryLoading && !staffSummary && (
                <div className="text-center py-8 text-muted-foreground">
                  No KPI data available for this tradesman
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team KPI Targets</CardTitle>
              <CardDescription>Revenue and profit targets by team configuration</CardDescription>
            </CardHeader>
            <CardContent>
              {targets?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Config</TableHead>
                      <TableHead>Daily Labor Target</TableHead>
                      <TableHead>Weekly Labor Target</TableHead>
                      <TableHead>Monthly Revenue</TableHead>
                      <TableHead>Monthly Profit</TableHead>
                      <TableHead>Close Rate Target</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targets.map((target) => (
                      <TableRow key={target.id} data-testid={`row-target-${target.id}`}>
                        <TableCell className="font-medium">{target.teamConfig}</TableCell>
                        <TableCell>${Number(target.dailyLaborTarget).toLocaleString()}</TableCell>
                        <TableCell>${Number(target.weeklyLaborTarget).toLocaleString()}</TableCell>
                        <TableCell>${Number(target.monthlyRevenueTarget).toLocaleString()}</TableCell>
                        <TableCell>${Number(target.monthlyProfitTarget).toLocaleString()}</TableCell>
                        <TableCell>{target.closeRateTarget}%</TableCell>
                        <TableCell>
                          {target.isActive ? (
                            <Badge className="bg-green-500 text-white">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No target configurations found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>KPI Alerts</DialogTitle>
            <DialogDescription>Review and acknowledge performance alerts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-auto">
            {alerts?.filter(a => !a.acknowledged).map((alert) => (
              <Card key={alert.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                          {alert.severity}
                        </Badge>
                        <span className="font-medium">{alert.alertType}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {alert.triggeredAt ? format(new Date(alert.triggeredAt), "PPp") : ""}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                      disabled={acknowledgeAlertMutation.isPending}
                      data-testid={`button-acknowledge-${alert.id}`}
                    >
                      Acknowledge
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!alerts?.filter(a => !a.acknowledged).length && (
              <div className="text-center py-4 text-muted-foreground">
                No unacknowledged alerts
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAlertDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
