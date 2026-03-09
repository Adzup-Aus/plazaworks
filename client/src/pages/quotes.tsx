import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, FileText, Send, Check, X, ArrowRight, MoreHorizontal, Trash2, History } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Quote } from "@shared/schema";
import { PermissionGate } from "@/components/permission-gate";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

function QuoteRevisionsList({
  quoteId,
  currentQuoteId,
  isOpen,
}: {
  quoteId: string;
  currentQuoteId: string;
  isOpen: boolean;
}) {
  const { data: revisions, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", quoteId, "revisions"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${quoteId}/revisions`);
      if (!res.ok) throw new Error("Failed to load revisions");
      return res.json();
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;
  if (isLoading) {
    return (
      <div className="py-2 text-sm text-muted-foreground">Loading revisions…</div>
    );
  }
  if (!revisions?.length) {
    return (
      <div className="py-2 text-sm text-muted-foreground">No revisions</div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground mb-1">Revisions</p>
      {revisions.map((rev) => (
        <Link
          key={rev.id}
          href={`/quotes/${rev.id}`}
          className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
        >
          <span>
            Revision {rev.version ?? rev.revisionNumber ?? 1}
            {rev.id === currentQuoteId && (
              <span className="ml-1 text-muted-foreground">(current)</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">{rev.status}</span>
        </Link>
      ))}
    </div>
  );
}

export default function Quotes() {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openRevisionsQuoteId, setOpenRevisionsQuoteId] = useState<string | null>(null);

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quotes/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote sent to client" });
    },
    onError: () => {
      toast({ title: "Failed to send quote", variant: "destructive" });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quotes/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote accepted" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quotes/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote rejected" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quotes/${id}/convert-to-job`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Quote converted to job" });
    },
    onError: () => {
      toast({ title: "Quote must be accepted first", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage quotes for clients
          </p>
        </div>
        <PermissionGate permission="create_quotes">
          <Link href="/quotes/new">
            <Button data-testid="button-new-quote">
              <Plus className="mr-2 h-4 w-4" />
              New Quote
            </Button>
          </Link>
        </PermissionGate>
      </div>

      {quotes?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No quotes yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first quote to get started
            </p>
            <PermissionGate permission="create_quotes">
              <Link href="/quotes/new">
                <Button className="mt-4" data-testid="button-create-first-quote">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Quote
                </Button>
              </Link>
            </PermissionGate>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quotes?.map((quote) => (
            <Card key={quote.id} className="flex flex-col" data-testid={`card-quote-${quote.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-medium">
                      {quote.quoteNumber}
                    </CardTitle>
                    {(quote.version ?? quote.revisionNumber ?? 1) > 1 && (
                      <Badge variant="secondary" className="text-xs">
                        Rev {quote.version ?? quote.revisionNumber ?? 1}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{quote.clientName}</p>
                </div>
                <Badge className={statusColors[quote.status] || ""}>
                  {quote.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <div className="flex-1 space-y-1 text-sm">
                  {quote.jobType && (
                    <p className="text-muted-foreground">{quote.jobType}</p>
                  )}
                  {quote.total && (
                    <p className="font-medium">
                      ${parseFloat(quote.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {quote.validUntil && (
                    <p className="text-xs text-muted-foreground">
                      Valid until {format(new Date(quote.validUntil), "dd MMM yyyy")}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 pt-2">
                  <Link href={`/quotes/${quote.id}`}>
                    <Button variant="outline" size="sm" data-testid={`button-view-quote-${quote.id}`}>
                      View
                    </Button>
                  </Link>
                  <Popover
                    open={openRevisionsQuoteId === quote.id}
                    onOpenChange={(open) => setOpenRevisionsQuoteId(open ? quote.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        data-testid={`button-revisions-quote-${quote.id}`}
                      >
                        <History className="mr-1 h-4 w-4" />
                        Revisions
                        {(quote.version ?? quote.revisionNumber ?? 1) > 1 && (
                          <span className="ml-1">({quote.version ?? quote.revisionNumber})</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64">
                      <QuoteRevisionsList
                        quoteId={quote.id}
                        currentQuoteId={quote.id}
                        isOpen={openRevisionsQuoteId === quote.id}
                      />
                    </PopoverContent>
                  </Popover>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-quote-actions-${quote.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {quote.status === "draft" && (
                        <DropdownMenuItem
                          onClick={() => sendMutation.mutate(quote.id)}
                          data-testid={`action-send-quote-${quote.id}`}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send to Client
                        </DropdownMenuItem>
                      )}
                      {quote.status === "sent" && (
                        <>
                          <DropdownMenuItem
                            onClick={() => acceptMutation.mutate(quote.id)}
                            data-testid={`action-accept-quote-${quote.id}`}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Mark Accepted
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => rejectMutation.mutate(quote.id)}
                            data-testid={`action-reject-quote-${quote.id}`}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Mark Rejected
                          </DropdownMenuItem>
                        </>
                      )}
                      {quote.status === "accepted" && !quote.convertedToJobId && (
                        <DropdownMenuItem
                          onClick={() => convertMutation.mutate(quote.id)}
                          data-testid={`action-convert-quote-${quote.id}`}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Convert to Job
                        </DropdownMenuItem>
                      )}
                      <PermissionGate permission="delete_quotes">
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(quote.id)}
                            data-testid={`action-delete-quote-${quote.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      </PermissionGate>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
