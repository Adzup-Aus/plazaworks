import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  Filter,
  Grid3X3,
  List,
} from "lucide-react";
import type { Job } from "@shared/schema";
import { jobStatuses } from "@shared/schema";
import { PermissionGate } from "@/components/permission-gate";

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    in_progress: "bg-green-500/10 text-green-600 dark:text-green-400",
    on_hold: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Jobs() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/invoices/generate/job/${jobId}`);
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      if (data?.id) setLocation(`/invoices/${data.id}`);
      toast({ title: "Invoice created" });
    },
    onError: () => {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    },
  });

  const filteredJobs = (jobs || []).filter((job) => {
    const matchesSearch =
      searchQuery === "" ||
      job.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground">
            Manage all your jobs and track their progress
          </p>
        </div>
        <PermissionGate permission="create_jobs">
          <Button asChild data-testid="button-new-job">
            <Link href="/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              New Job
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <Card className="overflow-visible">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-jobs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {jobStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-md border">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  data-testid="button-view-grid"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("table")}
                  data-testid="button-view-table"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-visible">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-20" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No jobs found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first job to get started"}
              </p>
              {!searchQuery && statusFilter === "all" && (
                <PermissionGate permission="create_jobs">
                  <Button className="mt-4" asChild>
                    <Link href="/jobs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Job
                    </Link>
                  </Button>
                </PermissionGate>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  className="cursor-pointer overflow-visible transition-colors hover-elevate"
                  onClick={() => setLocation(`/jobs/${job.id}`)}
                  data-testid={`job-card-${job.id}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold truncate">{job.clientName}</h3>
                        <Badge variant="secondary" className={`flex-shrink-0 ${getStatusColor(job.status)}`}>
                          {formatStatus(job.status)}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-2">{job.address}</span>
                      </div>
                      {job.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {job.description}
                        </p>
                      )}
                      {job.clientPhone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{job.clientPhone}</span>
                        </div>
                      )}
                      <PermissionGate permission="create_invoices">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            createInvoiceMutation.mutate(job.id);
                          }}
                          disabled={createInvoiceMutation.isPending}
                          data-testid={`button-create-invoice-${job.id}`}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Create Invoice
                        </Button>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => setLocation(`/jobs/${job.id}`)}
                      data-testid={`job-row-${job.id}`}
                    >
                      <TableCell>
                        <div className="font-medium">{job.clientName}</div>
                        {job.clientEmail && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {job.clientEmail}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {job.address}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getStatusColor(job.status)}>
                          {formatStatus(job.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {job.createdAt
                          ? new Date(job.createdAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <PermissionGate permission="create_invoices">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => createInvoiceMutation.mutate(job.id)}
                            disabled={createInvoiceMutation.isPending}
                            data-testid={`button-create-invoice-${job.id}`}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Create Invoice
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
