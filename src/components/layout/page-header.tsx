/** Standard page header: crumb chip, H1 title, subtitle, optional actions slot. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  crumb?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ crumb, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-6", className)}>
      <div className="min-w-0">
        {crumb && (
          <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {crumb}
          </span>
        )}
        <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}
