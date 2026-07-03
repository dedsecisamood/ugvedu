/**
 * Course Materials page.
 *
 * - Course picker sourced from the student's currently ENROLLED offerings.
 * - Optional deep-link via ?courseOfferingId= (e.g. from the Classes page).
 * - Materials are grouped by upload month for scannability (schema has no
 *   week/module field yet; when it does, replace the grouper).
 * - Download uses server-issued short-lived signed URLs (upload endpoint
 *   is staff-only and RLS-enforced).
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FileText, Download, FolderOpen } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { ListItemSkeleton } from "@/components/state/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getMyClasses } from "@/lib/classes.functions";
import { listCourseMaterials, getMaterialDownloadUrl } from "@/lib/materials.functions";

const classesQuery = queryOptions({
  queryKey: ["classes", "self", "current", "for-materials"],
  queryFn: () => getMyClasses(),
});

const searchSchema = z.object({
  courseOfferingId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/course-materials")({
  component: CourseMaterialsPage,
  head: () => ({ meta: [{ title: `Course Materials — ${APP_NAME}` }] }),
  validateSearch: (raw) => searchSchema.parse(raw),
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Academics" title="Course Materials" />
      <ErrorState description={error.message} />
    </div>
  ),
});

type Material = {
  id: string;
  title: string;
  description: string | null;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

function CourseMaterialsPage() {
  const { data: classes } = useSuspenseQuery(classesQuery);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const initialOffering =
    search.courseOfferingId ??
    (classes.classes.length > 0 ? classes.classes[0].offeringId : undefined);

  const [selected, setSelected] = useState<string | undefined>(initialOffering);
  const active = selected;
  const activeClass = classes.classes.find((c) => c.offeringId === active);

  const listFn = useServerFn(listCourseMaterials);
  const materialsQ = useQuery({
    queryKey: ["course-materials", active],
    queryFn: () =>
      listFn({
        data: { courseOfferingId: active as string, pageSize: 100, cursor: null },
      }),
    enabled: !!active,
  });

  const grouped = useMemo(() => {
    const rows = (materialsQ.data?.data ?? []) as unknown as Material[];
    const map = new Map<string, Material[]>();
    for (const m of rows) {
      const d = new Date(m.created_at);
      const key = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const bucket = map.get(key) ?? [];
      bucket.push(m);
      map.set(key, bucket);
    }
    return Array.from(map.entries());
  }, [materialsQ.data]);

  if (classes.classes.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader crumb="Academics" title="Course Materials" />
        <EmptyState
          title="No enrolled classes"
          description="You need to be enrolled in a course this semester to view its materials."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Academics"
        title="Course Materials"
        subtitle={activeClass ? `${activeClass.code} — ${activeClass.title}` : "Select a course"}
        actions={
          <Select
            value={active ?? ""}
            onValueChange={(v) => {
              setSelected(v);
              navigate({ search: { courseOfferingId: v } });
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {classes.classes.map((c) => (
                <SelectItem key={c.offeringId} value={c.offeringId}>
                  <span className="font-mono text-xs mr-2">{c.code}</span>
                  <span className="truncate">{c.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {materialsQ.isPending && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      )}

      {materialsQ.isError && (
        <ErrorState
          description={(materialsQ.error as Error).message}
          onRetry={() => materialsQ.refetch()}
        />
      )}

      {materialsQ.isSuccess && grouped.length === 0 && (
        <EmptyState
          icon={<FolderOpen className="size-6" aria-hidden />}
          title="No materials uploaded yet"
          description="When your instructor uploads slides, PDFs, or other resources, they'll appear here."
        />
      )}

      {materialsQ.isSuccess && grouped.length > 0 && (
        <div className="space-y-6">
          {grouped.map(([label, items]) => (
            <section key={label}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </h2>
              <div className="space-y-2">
                {items.map((m) => <MaterialRow key={m.id} m={m} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function MaterialRow({ m }: { m: Material }) {
  const dlFn = useServerFn(getMaterialDownloadUrl);
  const [busy, setBusy] = useState(false);

  const onDownload = async () => {
    setBusy(true);
    try {
      const res = await dlFn({ data: { materialId: m.id } });
      window.open(res.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <FileText className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{m.title}</p>
            {m.description && (
              <p className="truncate text-xs text-muted-foreground">{m.description}</p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                {m.mime_type.split("/")[1]?.toUpperCase() ?? m.mime_type}
              </Badge>
              <span>{humanBytes(m.file_size_bytes)}</span>
              <span>· {new Date(m.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onDownload} disabled={busy}>
          <Download className="mr-1.5 size-4" aria-hidden />
          {busy ? "Preparing…" : "Download"}
        </Button>
      </CardContent>
    </Card>
  );
}
