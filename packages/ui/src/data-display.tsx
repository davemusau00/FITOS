import type { PropsWithChildren, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function Skeleton({ height = "1rem", width = "100%" }: { height?: string; width?: string }) {
  return <span aria-hidden="true" className="fitos-skeleton" style={{ height, width }} />;
}

export function EmptyState({ action, description, icon = "spark", title }: { action?: ReactNode; description: string; icon?: IconName; title: string }) {
  return <section className="fitos-empty-state"><span className="fitos-empty-state__icon"><Icon name={icon} size={23} /></span><h2>{title}</h2><p>{description}</p>{action ? <div className="fitos-empty-state__action">{action}</div> : null}</section>;
}

export function PageHeader({ actions, description, eyebrow, title }: { actions?: ReactNode; description?: string; eyebrow?: string; title: string }) {
  return <header className="fitos-page-header"><div>{eyebrow ? <p className="fitos-page-header__eyebrow">{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p className="fitos-page-header__description">{description}</p> : null}</div>{actions ? <div className="fitos-page-header__actions">{actions}</div> : null}</header>;
}

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({ columns, data, label, onRowClick }: { columns: Array<DataTableColumn<T>>; data: T[]; label: string; onRowClick?: (row: T) => void }) {
  return <div className="fitos-data-table-wrap"><table aria-label={label} className="fitos-data-table"><thead><tr>{columns.map((column) => <th className={column.className} key={column.id} scope="col">{column.header}</th>)}</tr></thead><tbody>{data.map((row) => <tr key={row.id} onClick={() => onRowClick?.(row)} style={onRowClick ? { cursor: "pointer" } : undefined} tabIndex={onRowClick ? 0 : undefined} onKeyDown={(event) => { if (onRowClick && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onRowClick(row); } }}>{columns.map((column) => <td className={column.className} key={column.id}>{column.cell(row)}</td>)}</tr>)}</tbody></table></div>;
}

export function Avatar({ name, size = "medium" }: { name: string; size?: "small" | "medium" | "large" }) {
  const dimensions = size === "small" ? "2rem" : size === "large" ? "4rem" : "2.75rem";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return <span aria-label={name} className="fitos-avatar" style={{ height: dimensions, width: dimensions }}>{initials}</span>;
}

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <section className={["fitos-card", className].filter(Boolean).join(" ")}>{children}</section>;
}
