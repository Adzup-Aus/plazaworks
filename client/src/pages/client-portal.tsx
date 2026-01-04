import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Briefcase,
  MapPin,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Building2,
  Receipt,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";

interface PortalPCItem {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string | null;
  amountPaid: string | null;
  amountDue: string | null;
  dueDate: string | null;
}

interface PortalJob {
  id: string;
  clientName: string;
  address: string;
  jobType: string;
  status: string;
  description: string | null;
}

interface PortalData {
  job: PortalJob;
  pcItems: PortalPCItem[];
  invoices: PortalInvoice[];
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

function getInvoiceStatusColor(status: string): string {
  const colors: Record<string, string> = {
    sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    partially_paid: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
    cancelled: "bg-muted text-muted-foreground",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}

function getPCStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "in_progress":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "not_applicable":
      return <Circle className="h-5 w-5 text-gray-400" />;
    default:
      return <Circle className="h-5 w-5 text-amber-500" />;
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

function PortalContent({ token }: { token: string }) {
  const { data, isLoading, isError } = useQuery<PortalData>({
    queryKey: [`/api/portal/${token}`],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Link Not Found</h2>
          <p className="text-muted-foreground">
            This link is invalid or has expired. Please contact your service provider for a new link.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { job, pcItems, invoices } = data;
  const completedItems = pcItems.filter((item) => item.status === "completed").length;
  const totalItems = pcItems.length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-visible">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Briefcase className="h-6 w-6" />
                {job.clientName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {job.address}
              </CardDescription>
            </div>
            <Badge variant="secondary" className={`text-sm ${getStatusColor(job.status)}`}>
              {formatLabel(job.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              <Badge variant="outline">{formatLabel(job.jobType)}</Badge>
            </div>
          </div>
          {job.description && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{job.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Job Progress</span>
            <span className="text-lg font-normal text-muted-foreground">
              {completedItems}/{totalItems} completed
            </span>
          </CardTitle>
          <CardDescription>
            Track the completion status of your project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {totalItems > 0 ? (
            <div className="space-y-3">
              {pcItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-md border"
                  data-testid={`portal-pc-item-${item.id}`}
                >
                  {getPCStatusIcon(item.status)}
                  <span className={`flex-1 ${item.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                    {item.title}
                  </span>
                  <Badge variant="secondary" className={getStatusColor(item.status)}>
                    {formatLabel(item.status)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Circle className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No checklist items yet</p>
              <p className="text-sm">Check back later for progress updates</p>
            </div>
          )}
        </CardContent>
      </Card>

      {invoices && invoices.length > 0 && (
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoices
            </CardTitle>
            <CardDescription>
              View and track your invoices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`portal-invoice-${invoice.id}`}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getInvoiceStatusColor(invoice.status)}>
                        {formatLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {formatCurrency(invoice.amountPaid)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(invoice.amountDue)}
                    </TableCell>
                    <TableCell>
                      {invoice.dueDate 
                        ? format(new Date(invoice.dueDate), "dd MMM yyyy")
                        : "-"
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 p-4 rounded-md bg-muted/50 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <DollarSign className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Payment Methods</p>
                  <p className="mt-1">
                    To make a payment, please contact us directly. We accept bank transfer, cash, and cheque.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();

  return (
    <ThemeProvider defaultTheme="light" storageKey="plaza-works-portal-theme">
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Plaza Works</span>
              <Badge variant="outline" className="text-xs">Client Portal</Badge>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 max-w-3xl">
          {token ? (
            <PortalContent token={token} />
          ) : (
            <Card className="max-w-md mx-auto">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-semibold mb-2">Invalid Link</h2>
                <p className="text-muted-foreground">
                  This link appears to be incomplete. Please check your link and try again.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          <p>Powered by Plaza Works Job Management System</p>
        </footer>
      </div>
    </ThemeProvider>
  );
}
