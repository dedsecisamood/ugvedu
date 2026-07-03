/**
 * Notices page.
 * - Pinned notices float to the top of every filter.
 * - Unread rendered with an accent dot + bolder title; read = muted.
 * - Filter tabs: All / My Department / University-wide.
 * - Opening a notice (Accordion trigger) marks it as read (idempotent upsert).
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pin, Building2, GraduationCap, Globe2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { listMyNotices, markNoticeRead, type NoticeRow } from "@/lib/notices.functions";

const noticesQuery = queryOptions({
  queryKey: ["notices", "self"],
  queryFn: () => listMyNotices(),
});

export const Route = createFileRoute("/_authenticated/notices")({
  component: NoticesPage,
  head: () => ({ meta: [{ title: `Notices — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(noticesQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader crumb="Notices" title="Notices" />
      <ErrorState description={error.message} />
    </div>
  ),
});

type Scope = "all" | "department" | "university";

function scopeOf(n: NoticeRow): "department" | "university" | "semester" {
  if (n.target_department_id) return "department";
  if (n.target_semester_id) return "semester";
  return "university";
}

function NoticesPage() {
  const { data } = useSuspenseQuery(noticesQuery);
  const [tab, setTab] = useState<Scope>("all");
  const qc = useQueryClient();
  const markFn = useServerFn(markNoticeRead);

  const mark = useMutation({
    mutationFn: (noticeId: string) => markFn({ data: { noticeId } }),
    onMutate: async (noticeId) => {
      await qc.cancelQueries(noticesQuery);
      const prev = qc.getQueryData<{ notices: NoticeRow[] }>(noticesQuery.queryKey);
      if (prev) {
        qc.setQueryData(noticesQuery.queryKey, {
          notices: prev.notices.map((n) => (n.id === noticeId ? { ...n, is_read: true } : n)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(noticesQuery.queryKey, ctx.prev);
    },
  });

  const filtered = useMemo(() => {
    const all = data.notices;
    if (tab === "all") return all;
    if (tab === "department") return all.filter((n) => n.target_department_id !== null);
    return all.filter(
      (n) => n.target_department_id === null && n.target_semester_id === null,
    );
  }, [data.notices, tab]);

  const unreadCount = data.notices.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        crumb="Communications"
        title="Notices"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread ${unreadCount === 1 ? "notice" : "notices"}`
            : "You're all caught up."
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Scope)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="department">My Department</TabsTrigger>
          <TabsTrigger value="university">University-wide</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <EmptyState
              title="No notices here"
              description="When new notices are published for you, they'll appear here."
            />
          ) : (
            <NoticeList notices={filtered} onOpen={(id) => !mark.isPending && mark.mutate(id)} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoticeList({
  notices,
  onOpen,
}: {
  notices: NoticeRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Accordion
        type="multiple"
        onValueChange={(open) => {
          // Fire mark-read as new items are expanded.
          if (open.length > 0) {
            const last = open[open.length - 1];
            const target = notices.find((n) => n.id === last);
            if (target && !target.is_read) onOpen(last);
          }
        }}
      >
        {notices.map((n) => {
          const scope = scopeOf(n);
          const Icon =
            scope === "university" ? Globe2 : scope === "department" ? Building2 : GraduationCap;
          return (
            <AccordionItem
              key={n.id}
              value={n.id}
              className={cn(
                "mb-3 overflow-hidden rounded-lg border border-border bg-card transition-colors last:mb-0",
                !n.is_read && "border-primary/40 bg-primary/[0.03]",
              )}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  {!n.is_read ? (
                    <span
                      aria-label="Unread"
                      className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    />
                  ) : (
                    <span aria-hidden className="mt-2 size-2 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.is_pinned && (
                        <Badge variant="default" className="gap-1">
                          <Pin className="size-3" aria-hidden />
                          Pinned
                        </Badge>
                      )}
                      <Badge variant="secondary" className="gap-1">
                        <Icon className="size-3" aria-hidden />
                        {scope === "university"
                          ? "University-wide"
                          : scope === "department"
                            ? n.department_name ?? "Department"
                            : "Semester"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {n.published_at ? new Date(n.published_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <h3
                      className={cn(
                        "mt-1 truncate text-sm text-foreground",
                        !n.is_read ? "font-semibold" : "font-medium text-muted-foreground",
                      )}
                    >
                      {n.title}
                    </h3>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Card className="border-0 bg-transparent shadow-none">
                  <CardContent className="whitespace-pre-wrap p-0 text-sm leading-relaxed text-foreground">
                    {n.body}
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
