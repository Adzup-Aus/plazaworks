import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Briefcase,
  Calendar,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  CheckCircle2,
  Timer,
} from "lucide-react";
import type { Job } from "@shared/schema";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
}) {
  return (
    <Card className="overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

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

export default function Dashboard() {
  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const activeJobs = jobs?.filter((j) => ["pending", "scheduled", "in_progress"].includes(j.status)) || [];
  const pendingJobs = jobs?.filter((j) => j.status === "pending") || [];
  const inProgressJobs = jobs?.filter((j) => j.status === "in_progress") || [];
  const completedThisMonth = jobs?.filter((j) => {
    if (j.status !== "completed" || !j.updatedAt) return false;
    const updated = new Date(j.updatedAt);
    const now = new Date();
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
  }) || [];

  const recentJobs = [...(jobs || [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your job management system
          </p>
        </div>
        <Button asChild data-testid="button-new-job">
          <Link href="/jobs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Jobs"
          value={activeJobs.length}
          description="Jobs in progress"
          icon={Briefcase}
          isLoading={jobsLoading}
        />
        <StatCard
          title="Pending"
          value={pendingJobs.length}
          description="Awaiting scheduling"
          icon={Clock}
          isLoading={jobsLoading}
        />
        <StatCard
          title="In Progress"
          value={inProgressJobs.length}
          description="Currently working"
          icon={Timer}
          isLoading={jobsLoading}
        />
        <StatCard
          title="Completed"
          value={completedThisMonth.length}
          description="This month"
          icon={CheckCircle2}
          isLoading={jobsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent Jobs</CardTitle>
              <CardDescription>Latest job activity</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/jobs">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No jobs yet. Create your first job to get started.
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/jobs/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Job
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-4 rounded-md p-2 hover-elevate active-elevate-2"
                    data-testid={`job-item-${job.id}`}
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">{job.clientName}</p>
                      <p className="truncate text-xs text-muted-foreground">{job.address}</p>
                    </div>
                    <Badge variant="secondary" className={getStatusColor(job.status)}>
                      {formatStatus(job.status)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-visible">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" className="h-auto justify-start p-4" asChild>
                <Link href="/jobs/new">
                  <div className="flex items-start gap-3">
                    <Plus className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">New Job</div>
                      <div className="text-xs text-muted-foreground">Create a new job entry</div>
                    </div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto justify-start p-4" asChild>
                <Link href="/schedule">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Schedule</div>
                      <div className="text-xs text-muted-foreground">View & manage calendar</div>
                    </div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto justify-start p-4" asChild>
                <Link href="/team">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Team</div>
                      <div className="text-xs text-muted-foreground">Manage staff & roles</div>
                    </div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="h-auto justify-start p-4" asChild>
                <Link href="/jobs?status=pending">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <div className="text-left">
                      <div className="font-medium">Pending Jobs</div>
                      <div className="text-xs text-muted-foreground">{pendingJobs.length} jobs awaiting</div>
                    </div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
