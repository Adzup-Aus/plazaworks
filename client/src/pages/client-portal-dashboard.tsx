import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Briefcase,
  MapPin,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  Image,
  LogOut,
  ChevronRight,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Job {
  id: string;
  clientName: string;
  address: string;
  jobType: string;
  status: string;
  description: string | null;
}

interface MilestonePayment {
  id: string;
  amount: string;
  description: string | null;
  status: string;
  requestedAt: string;
}

interface MilestoneMedia {
  id: string;
  mediaType: string;
  mediaUrl: string | null;
  caption: string | null;
  workDate: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progressPercent: number;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  completedAt: string | null;
  payments: MilestonePayment[];
  mediaCount: number;
  recentMedia: MilestoneMedia[];
}

interface TimelineData {
  job: Job;
  timeline: Milestone[];
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    in_progress: "bg-green-500/10 text-green-600 dark:text-green-400",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}

function getMilestoneStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "in_progress":
      return <Clock className="h-5 w-5 text-blue-500" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

function formatLabel(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatCurrency(value: string | null): string {
  if (!value) return "$0.00";
  return `$${parseFloat(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PortalHeader({ clientName, onLogout }: { clientName: string; onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Client Portal</h1>
            <p className="text-sm text-muted-foreground">Welcome, {clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function PaymentApprovalDialog({
  payment,
  isOpen,
  onClose,
  onApprove,
  isPending,
}: {
  payment: MilestonePayment | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  isPending: boolean;
}) {
  if (!payment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve Payment Request</DialogTitle>
          <DialogDescription>
            You are about to approve a progress payment of {formatCurrency(payment.amount)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-muted p-4">
            <div className="text-2xl font-bold">{formatCurrency(payment.amount)}</div>
            {payment.description && (
              <p className="mt-2 text-sm text-muted-foreground">{payment.description}</p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            By approving this payment, you confirm that you agree with the work completed for this milestone.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-approve">
            Cancel
          </Button>
          <Button onClick={onApprove} disabled={isPending} data-testid="button-confirm-approve">
            {isPending ? "Approving..." : "Approve Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneCard({ milestone, jobId, onApprovePayment }: { 
  milestone: Milestone; 
  jobId: string;
  onApprovePayment: (payment: MilestonePayment) => void;
}) {
  const pendingPayments = milestone.payments.filter(p => p.status === "pending" || p.status === "requested");
  const hasPendingPayment = pendingPayments.length > 0;

  return (
    <Card className="relative" data-testid={`card-milestone-${milestone.id}`}>
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-transparent">
        {milestone.status === "completed" && <div className="h-full w-full rounded-l-lg bg-emerald-500" />}
        {milestone.status === "in_progress" && <div className="h-full w-full rounded-l-lg bg-blue-500" />}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {getMilestoneStatusIcon(milestone.status)}
            <div>
              <CardTitle className="text-base" data-testid={`text-milestone-title-${milestone.id}`}>
                {milestone.title}
              </CardTitle>
              {milestone.description && (
                <CardDescription className="mt-1">{milestone.description}</CardDescription>
              )}
            </div>
          </div>
          <Badge className={getStatusColor(milestone.status)}>
            {formatLabel(milestone.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {milestone.scheduledStartDate ? (
              <span>
                {format(new Date(milestone.scheduledStartDate), "MMM d")}
                {milestone.scheduledEndDate && (
                  <> - {format(new Date(milestone.scheduledEndDate), "MMM d, yyyy")}</>
                )}
              </span>
            ) : (
              <span className="italic">To be scheduled</span>
            )}
          </div>
          {milestone.completedAt && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Completed {format(new Date(milestone.completedAt), "MMM d, yyyy")}</span>
            </div>
          )}
        </div>

        {milestone.status !== "pending" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{milestone.progressPercent}%</span>
            </div>
            <Progress value={milestone.progressPercent} className="h-2" />
          </div>
        )}

        {milestone.recentMedia.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image className="h-4 w-4" />
              <span>{milestone.mediaCount} photos/updates</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {milestone.recentMedia.map((media) => (
                <div
                  key={media.id}
                  className="aspect-square rounded-md bg-muted flex items-center justify-center overflow-hidden"
                  data-testid={`media-preview-${media.id}`}
                >
                  {media.mediaUrl ? (
                    <img
                      src={media.mediaUrl}
                      alt={media.caption || "Progress photo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Image className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasPendingPayment && (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-600 dark:text-amber-400">
                  Payment Request Pending
                </h4>
                {pendingPayments.map((payment) => (
                  <div key={payment.id} className="mt-2 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{formatCurrency(payment.amount)}</div>
                      {payment.description && (
                        <p className="text-sm text-muted-foreground">{payment.description}</p>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => onApprovePayment(payment)}
                      data-testid={`button-approve-payment-${payment.id}`}
                    >
                      Approve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobTimeline({ jobId }: { jobId: string }) {
  const token = localStorage.getItem("clientPortalToken");
  const { toast } = useToast();
  const [selectedPayment, setSelectedPayment] = useState<MilestonePayment | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<TimelineData>({
    queryKey: ["/api/client-portal/jobs", jobId, "timeline"],
    queryFn: async () => {
      const response = await fetch(`/api/client-portal/jobs/${jobId}/timeline`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch timeline");
      return response.json();
    },
    enabled: !!token,
  });

  const approveMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await fetch(`/api/client-portal/payments/${paymentId}/approve`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
      });
      if (!response.ok) throw new Error("Failed to approve payment");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Payment approved", description: "Thank you for approving the payment." });
      setApprovalDialogOpen(false);
      setSelectedPayment(null);
      refetch();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve payment.", variant: "destructive" });
    },
  });

  const handleApprovePayment = (payment: MilestonePayment) => {
    setSelectedPayment(payment);
    setApprovalDialogOpen(true);
  };

  const confirmApprove = () => {
    if (selectedPayment) {
      approveMutation.mutate(selectedPayment.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Unable to load timeline</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please try again later or contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { job, timeline } = data;
  const completedCount = timeline.filter(m => m.status === "completed").length;
  const overallProgress = timeline.length > 0 
    ? Math.round((completedCount / timeline.length) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle data-testid="text-job-title">{job.clientName}</CardTitle>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{job.address}</span>
                </div>
              </div>
            </div>
            <Badge className={getStatusColor(job.status)}>
              {formatLabel(job.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{completedCount} of {timeline.length} milestones complete</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Project Timeline</h2>
        {timeline.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No milestones yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Milestones will appear here as your project progresses.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {timeline.map((milestone) => (
              <MilestoneCard 
                key={milestone.id} 
                milestone={milestone} 
                jobId={jobId}
                onApprovePayment={handleApprovePayment}
              />
            ))}
          </div>
        )}
      </div>

      <PaymentApprovalDialog
        payment={selectedPayment}
        isOpen={approvalDialogOpen}
        onClose={() => {
          setApprovalDialogOpen(false);
          setSelectedPayment(null);
        }}
        onApprove={confirmApprove}
        isPending={approveMutation.isPending}
      />
    </div>
  );
}

export default function ClientPortalDashboard() {
  const [, setLocation] = useLocation();
  const token = localStorage.getItem("clientPortalToken");
  const clientName = localStorage.getItem("clientPortalName") || "Client";
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLocation("/portal/login");
    }
  }, [token, setLocation]);

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/client-portal/jobs"],
    queryFn: async () => {
      const response = await fetch("/api/client-portal/jobs", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
    enabled: !!token,
  });

  const handleLogout = async () => {
    // Call backend to revoke the session
    try {
      await fetch("/api/client-portal/auth/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
    } catch {
      // Continue with logout even if API call fails
    }
    // Clear local storage
    localStorage.removeItem("clientPortalToken");
    localStorage.removeItem("clientPortalId");
    localStorage.removeItem("clientPortalEmail");
    localStorage.removeItem("clientPortalName");
    setLocation("/portal/login");
  };

  if (!token) {
    return null;
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <PortalHeader clientName={clientName} onLogout={handleLogout} />
        
        <main className="mx-auto max-w-5xl px-4 py-8">
          {selectedJobId ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedJobId(null)}
                className="mb-4"
                data-testid="button-back-to-jobs"
              >
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" />
                Back to Projects
              </Button>
              <JobTimeline jobId={selectedJobId} />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold" data-testid="text-portal-heading">Your Projects</h2>
                <p className="text-muted-foreground">View progress and updates for your active projects</p>
              </div>

              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <Skeleton className="h-6 w-3/4 mb-4" />
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : jobs && jobs.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {jobs.map((job) => (
                    <Card 
                      key={job.id} 
                      className="hover-elevate cursor-pointer transition-shadow"
                      onClick={() => setSelectedJobId(job.id)}
                      data-testid={`card-job-${job.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                              <Briefcase className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{job.clientName}</CardTitle>
                              <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{job.address}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <Badge className={getStatusColor(job.status)}>
                            {formatLabel(job.status)}
                          </Badge>
                          <span className="text-sm text-muted-foreground capitalize">
                            {job.jobType}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">No projects yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your projects will appear here once they're assigned.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}
