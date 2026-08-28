import type { PropsWithChildren, ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Badge, type BadgeTone } from "./primitives";
import { cn } from "./utils";

export type Density = "executive" | "operational" | "touch" | "record" | "consumer";

export function WorkspacePage({
  children,
  className,
  density = "operational"
}: PropsWithChildren<{ className?: string; density?: Density }>) {
  return (
    <div className={cn("fitos-workspace-page", `fitos-workspace-page--${density}`, className)}>
      {children}
    </div>
  );
}

export function StatCard({
  detail,
  icon,
  label,
  tone = "neutral",
  value
}: {
  detail?: ReactNode;
  icon?: IconName;
  label: string;
  tone?: BadgeTone;
  value: ReactNode;
}) {
  return (
    <article className={cn("fitos-stat-card", `fitos-stat-card--${tone}`)}>
      <div className="fitos-stat-card__label">
        {icon ? <Icon name={icon} size={16} /> : null}
        <span>{label}</span>
      </div>
      <strong className="fitos-stat-card__value">{value}</strong>
      {detail ? <div className="fitos-stat-card__detail">{detail}</div> : null}
    </article>
  );
}

export function FilterBar({ children, resultCount }: PropsWithChildren<{ resultCount?: number }>) {
  return (
    <section aria-label="Filters" className="fitos-filter-bar">
      <div className="fitos-filter-bar__controls">{children}</div>
      {typeof resultCount === "number" ? (
        <span className="fitos-filter-bar__count" aria-live="polite">
          {resultCount.toLocaleString()} result{resultCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </section>
  );
}

export type TabItem = { id: string; label: string; count?: number };
export function Tabs({
  activeId,
  items,
  label = "Sections",
  onChange
}: {
  activeId: string;
  items: TabItem[];
  label?: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav aria-label={label} className="fitos-tabs">
      {items.map((item) => (
        <button
          aria-current={activeId === item.id ? "page" : undefined}
          className={cn("fitos-tab", activeId === item.id && "is-active")}
          key={item.id}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.label}
          {typeof item.count === "number" ? <Badge>{item.count}</Badge> : null}
        </button>
      ))}
    </nav>
  );
}

export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="fitos-detail-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressBar({ label, max, value }: { label: string; max: number; value: number }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="fitos-progress">
      <div className="fitos-progress__label">
        <span>{label}</span>
        <strong>
          {value.toLocaleString()} / {max.toLocaleString()}
        </strong>
      </div>
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
        className="fitos-progress__track"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function Timeline({
  empty,
  items
}: {
  empty?: ReactNode;
  items: Array<{
    id: string;
    title: ReactNode;
    meta?: ReactNode;
    body?: ReactNode;
    tone?: BadgeTone;
  }>;
}) {
  if (!items.length) return <>{empty ?? null}</>;
  return (
    <ol className="fitos-timeline">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn("fitos-timeline__item", `fitos-timeline__item--${item.tone ?? "neutral"}`)}
        >
          <span className="fitos-timeline__marker" />
          <div>
            <strong>{item.title}</strong>
            {item.meta ? <div className="fitos-timeline__meta">{item.meta}</div> : null}
            {item.body ? <div className="fitos-timeline__body">{item.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export type AttentionItem = {
  id: string;
  title: ReactNode;
  detail?: ReactNode;
  tone?: BadgeTone;
  action?: ReactNode;
};

export function AttentionCentre({
  items,
  empty = "Nothing needs attention right now."
}: {
  items: AttentionItem[];
  empty?: ReactNode;
}) {
  return (
    <section aria-label="Attention centre" className="fitos-attention-centre">
      <div className="fitos-attention-centre__heading">
        <div>
          <span className="fitos-eyebrow">Attention centre</span>
          <h2>Next actions</h2>
        </div>
        <Badge tone={items.length ? "warning" : "success"}>{items.length}</Badge>
      </div>
      {items.length ? (
        <ul className="fitos-attention-centre__list">
          {items.map((item) => (
            <li
              className={cn(
                "fitos-attention-item",
                `fitos-attention-item--${item.tone ?? "neutral"}`
              )}
              key={item.id}
            >
              <span className="fitos-attention-item__marker" />
              <div className="fitos-attention-item__content">
                <strong>{item.title}</strong>
                {item.detail ? <span>{item.detail}</span> : null}
              </div>
              {item.action ? (
                <div className="fitos-attention-item__action">{item.action}</div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fitos-attention-centre__empty">{empty}</p>
      )}
    </section>
  );
}
