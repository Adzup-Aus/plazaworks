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
import { DollarSign, Plus, TrendingUp, TrendingDown, AlertTriangle, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Job, JobBackcostingSummary, JobCostEntry } from "@shared/schema";
import { Link } from "wouter";

export default function BackcostingPage() {
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isAddCostOpen, setIsAddCostOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [newCost, setNewCost] = useState({
    description: "",
    category: "material",
    quantity: "1",
    unitCost: "",
    totalCost: "",
    vendor: "",
    notes: "",
  });

  const { data: backcosting, isLoading: backcostingLoading } = useQuery<JobBackcostingSummary[]>({
    queryKey: ["/api/backcosting"],
  });

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: jobCosts, isLoading: costsLoading } = useQuery<JobCostEntry[]>({
    queryKey: ["/api/jobs", selectedJobId, "cost-entries"],
    enabled: !!selectedJobId,
  });

  const { data: jobBackcosting } = useQuery<JobBackcostingSummary>({
    queryKey: ["/api/jobs", selectedJobId, "backcosting"],
    enabled: !!selectedJobId,
  });

  const createCostMutation = useMutation({
    mutationFn: async (data: typeof newCost & { jobId: string }) => {
      return apiRequest("POST", `/api/jobs/${data.jobId}/cost-entries`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backcosting"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJobId, "cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJobId, "backcosting"] });
      toast({ title: "Cost entry added successfully" });
      setIsAddCostOpen(false);
      setNewCost({
        description: "",
        category: "material",
        quantity: "1",
        unitCost: "",
        totalCost: "",
        vendor: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error adding cost entry", description: error.message, variant: "destructive" });
    },
  });

  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/cost-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backcosting"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJobId, "cost-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJobId, "backcosting"] });
      toast({ title: "Cost entry deleted" });
    },
  });

  const filteredBackcosting = backcosting?.filter((job) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "profitable") return job.grossProfit > 0;
    if (filterStatus === "loss") return job.grossProfit < 0;
    if (filterStatus === "over_budget") return job.variance > 0;
    return true;
  });

  const totalQuoted = backcosting?.reduce((sum, j) => sum + j.quotedAmount, 0) || 0;
  const totalActual = backcosting?.reduce((sum, j) => sum + j.totalActualCost, 0) || 0;
  const totalProfit = backcosting?.reduce((sum, j) => sum + j.grossProfit, 0) || 0;
  const profitableJobs = backcosting?.filter(j => j.grossProfit > 0).length || 0;

  const handleSubmit = () => {
    if (!selectedJobId || !newCost.description || !newCost.unitCost) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    const totalCost = newCost.totalCost || (parseFloat(newCost.quantity) * parseFloat(newCost.unitCost)).toFixed(2);
    createCostMutation.mutate({ ...newCost, totalCost, jobId: selectedJobId });
  };

  const updateTotal = () => {
    if (newCost.quantity && newCost.unitCost) {
      const total = (parseFloat(newCost.quantity) * parseFloat(newCost.unitCost)).toFixed(2);
      setNewCost({ ...newCost, totalCost: total });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(amount);
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-green-600 dark:text-green-400";
    if (profit < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <div className="flex-1 space-y-6 p-6 overflow-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-backcosting">Job Backcosting</h1>
          <p className="text-muted-foreground">Track actual costs vs quoted amounts for profitability analysis</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quoted</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-quoted">{formatCurrency(totalQuoted)}</div>
            <p className="text-xs text-muted-foreground">Across all jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-actual">{formatCurrency(totalActual)}</div>
            <p className="text-xs text-muted-foreground">Recorded costs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            {totalProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getProfitColor(totalProfit)}`} data-testid="text-total-profit">
              {formatCurrency(totalProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Quoted minus actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profitable Jobs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-profitable-jobs">
              {profitableJobs} / {backcosting?.length || 0}
            </div>
            <Progress value={backcosting?.length ? (profitableJobs / backcosting.length) * 100 : 0} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="job-detail" data-testid="tab-job-detail">Job Detail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Job Profitability</CardTitle>
                <CardDescription>Compare quoted vs actual costs for all jobs</CardDescription>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  <SelectItem value="profitable">Profitable</SelectItem>
                  <SelectItem value="loss">Loss Making</SelectItem>
                  <SelectItem value="over_budget">Over Budget</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {backcostingLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredBackcosting && filteredBackcosting.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Quoted</TableHead>
                      <TableHead className="text-right">Labor</TableHead>
                      <TableHead className="text-right">Materials</TableHead>
                      <TableHead className="text-right">Other</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBackcosting.map((job) => (
                      <TableRow key={job.jobId} data-testid={`row-job-${job.jobId}`}>
                        <TableCell className="font-medium">{job.jobTitle}</TableCell>
                        <TableCell className="text-right">{formatCurrency(job.quotedAmount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(job.actualLaborCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(job.actualMaterialCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(job.actualOtherCosts)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(job.totalActualCost)}</TableCell>
                        <TableCell className={`text-right font-medium ${getProfitColor(job.grossProfit)}`}>
                          {formatCurrency(job.grossProfit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {job.profitMargin >= 0 ? (
                            <Badge variant="secondary">{job.profitMargin.toFixed(0)}%</Badge>
                          ) : (
                            <Badge variant="destructive">{job.profitMargin.toFixed(0)}%</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedJobId(job.jobId)}
                            data-testid={`button-view-job-${job.jobId}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No backcosting data available</p>
                  <p className="text-sm">Create quotes and log costs to see profitability analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job-detail" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Job</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedJobId || ""} onValueChange={setSelectedJobId}>
                <SelectTrigger data-testid="select-job-detail">
                  <SelectValue placeholder="Choose a job to view details" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.clientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedJobId && jobBackcosting && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Quoted Amount</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(jobBackcosting.quotedAmount)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(jobBackcosting.totalActualCost)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getProfitColor(jobBackcosting.grossProfit)}`}>
                      {formatCurrency(jobBackcosting.grossProfit)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getProfitColor(jobBackcosting.profitMargin)}`}>
                      {jobBackcosting.profitMargin.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle>Cost Entries</CardTitle>
                    <CardDescription>Recorded expenses for this job</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddCostOpen(true)} data-testid="button-add-cost">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Cost
                  </Button>
                </CardHeader>
                <CardContent>
                  {costsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : jobCosts && jobCosts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Vendor</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobCosts.map((cost) => (
                          <TableRow key={cost.id} data-testid={`row-cost-${cost.id}`}>
                            <TableCell className="font-medium">{cost.description}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{cost.category}</Badge>
                            </TableCell>
                            <TableCell>{cost.vendor || "-"}</TableCell>
                            <TableCell className="text-right">{cost.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(parseFloat(cost.unitCost || "0"))}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(parseFloat(cost.totalCost || "0"))}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteCostMutation.mutate(cost.id)}
                                data-testid={`button-delete-cost-${cost.id}`}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <DollarSign className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p>No cost entries yet</p>
                      <p className="text-sm">Click "Add Cost" to record expenses</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isAddCostOpen} onOpenChange={setIsAddCostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cost Entry</DialogTitle>
            <DialogDescription>Record an expense for this job</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                placeholder="e.g., Copper pipes, PVC fittings"
                value={newCost.description}
                onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                data-testid="input-cost-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={newCost.category} onValueChange={(v) => setNewCost({ ...newCost, category: v })}>
                  <SelectTrigger data-testid="select-cost-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="labor">Labor</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="misc">Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Input
                  placeholder="e.g., Bunnings"
                  value={newCost.vendor}
                  onChange={(e) => setNewCost({ ...newCost, vendor: e.target.value })}
                  data-testid="input-cost-vendor"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newCost.quantity}
                  onChange={(e) => setNewCost({ ...newCost, quantity: e.target.value })}
                  onBlur={updateTotal}
                  data-testid="input-cost-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit Cost *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="$0.00"
                  value={newCost.unitCost}
                  onChange={(e) => setNewCost({ ...newCost, unitCost: e.target.value })}
                  onBlur={updateTotal}
                  data-testid="input-cost-unit-cost"
                />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newCost.totalCost}
                  onChange={(e) => setNewCost({ ...newCost, totalCost: e.target.value })}
                  data-testid="input-cost-total"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional notes"
                value={newCost.notes}
                onChange={(e) => setNewCost({ ...newCost, notes: e.target.value })}
                data-testid="input-cost-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCostOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createCostMutation.isPending} data-testid="button-submit-cost">
              {createCostMutation.isPending ? "Saving..." : "Add Cost"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
