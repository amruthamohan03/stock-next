/**
 * A labelled divider that breaks a long form into readable groups.
 *
 * A form with fifteen-plus fields in one flat grid reads as a wall of boxes —
 * this gives each group a quiet heading and a rule, without nesting panels
 * inside the card (which prints badly and looks heavy on screen).
 */
export function FormSection({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  /** Optional one-liner explaining what belongs in this group. */
  hint?: string;
  children: React.ReactNode;
  /** Grid classes for the fields; defaults to the app's 4-column form grid. */
  className?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="flex shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accent-fg before:block before:h-3 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-accent before:to-accent-2">
          {title}
        </h3>
        {hint && <span className="shrink-0 text-xs text-faint">{hint}</span>}
        <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
      </div>
      <div className={className ?? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"}>
        {children}
      </div>
    </section>
  );
}
