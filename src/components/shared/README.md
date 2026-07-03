# components/shared

Composed, app-specific components built from `@/components/ui` primitives.
Examples that will live here: `AppSidebar`, `GradeBadge`, `PageHeader`, `RoleGate`.

Rules:
- No hardcoded colors — use design tokens from `src/styles.css` (e.g. `bg-navy`, `text-gold`, `bg-grade-a`).
- Keep components small and single-purpose.
- Feature-specific components belong under a feature folder, not here.
