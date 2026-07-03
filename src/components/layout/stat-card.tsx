/** Summary tile used for Entries / CGPA / Semesters style dashboards. */
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  accent?: "default" | "gold" | "navy";
  className?: string;
}

export function StatCard({ label, value, hint, icon, loading, accent = "default", className }: StatCardProps) {
  const accentClass =
    accent === "gold" ? "border-l-4 border-l-gold" :
    accent === "navy" ? "border-l-4 border-l-primary" : "";
  return (
    <Card className={cn("overflow-hidden", accentClass, className)}>
      <CardContent className="flex items-center gap-4 p-5">
        {icon && (
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-20" />
          ) : (
            <p className="mt-1 truncate text-2xl font-bold tabular-nums text-foreground">
              {value}
            </p>
          )}
          {hint && !loading && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
