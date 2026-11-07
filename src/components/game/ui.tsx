import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-2">
      {title && (
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground">{title}</h3>
          {right}
        </div>
      )}
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function Tile({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cn("anim-fade-up rounded-2xl border border-border bg-card p-3", className)}>{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-display text-base font-semibold",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{children}</p>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
