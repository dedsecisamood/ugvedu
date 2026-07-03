import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon, title, description, action, className,
}: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-6" aria-hidden />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
