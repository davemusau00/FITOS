import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId
} from "react";
import { Icon, type IconName } from "./icons";
import { cn } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "small" | "medium";
  loading?: boolean;
  fullWidth?: boolean;
  icon?: IconName;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    fullWidth,
    icon,
    loading,
    size = "medium",
    type = "button",
    variant = "primary",
    ...props
  },
  ref
) {
  return (
    <button
      className={cn(
        "fitos-button",
        `fitos-button--${variant}`,
        size === "small" && "fitos-button--small",
        fullWidth && "fitos-button--full",
        className
      )}
      disabled={disabled || loading}
      ref={ref}
      type={type}
      {...props}
    >
      {loading ? (
        <Icon aria-label="Loading" className="fitos-spinner" name="spark" size={16} />
      ) : icon ? (
        <Icon name={icon} size={16} />
      ) : null}
      {children}
    </button>
  );
});

export type IconButtonProps = Omit<ButtonProps, "children"> & { label: string };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, icon, label, ...props },
  ref
) {
  return (
    <Button
      aria-label={label}
      className={cn("fitos-icon-button", className)}
      icon={icon}
      ref={ref}
      {...props}
    >
      <span className="fitos-sr-only">{label}</span>
    </Button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input className={cn("fitos-control", className)} ref={ref} {...props} />;
  }
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return <textarea className={cn("fitos-control", className)} ref={ref} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select className={cn("fitos-control", className)} ref={ref} {...props}>
        {children}
      </select>
    );
  }
);

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className, type: _type, ...props }, ref) {
    return (
      <input className={cn("fitos-checkbox", className)} ref={ref} type="checkbox" {...props} />
    );
  }
);

export type FormFieldProps = PropsWithChildren<{
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
}>;

export function FormField({ children, error, hint, htmlFor, label, optional }: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  return (
    <div className="fitos-control-group">
      <label className="fitos-label" htmlFor={id}>
        {label} {optional ? <span className="fitos-optional">(optional)</span> : null}
      </label>
      {children}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <p className="fitos-help">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldError({ children }: PropsWithChildren) {
  return (
    <p className="fitos-field-error" role="alert">
      {children}
    </p>
  );
}

export type AlertTone = "info" | "success" | "warning" | "danger";
export function Alert({
  children,
  title,
  tone = "info"
}: PropsWithChildren<{ title?: string; tone?: AlertTone }>) {
  const icon: Record<AlertTone, IconName> = {
    danger: "warning",
    info: "spark",
    success: "check",
    warning: "warning"
  };
  return (
    <div
      className={cn("fitos-alert", `fitos-alert--${tone}`)}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon name={icon[tone]} size={19} />
      <div className="fitos-alert__content">
        {title ? <strong className="fitos-alert__title">{title}</strong> : null}
        <div className="fitos-alert__message">{children}</div>
      </div>
    </div>
  );
}

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
export function Badge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: BadgeTone }>) {
  return <span className={cn("fitos-badge", `fitos-badge--${tone}`)}>{children}</span>;
}

const statusTones: Record<string, BadgeTone> = {
  active: "success",
  attended: "success",
  confirmed: "success",
  succeeded: "success",
  checked_in: "success",
  pending: "warning",
  paused: "warning",
  scheduled: "info",
  inactive: "neutral",
  archived: "neutral",
  cancelled: "danger",
  suspended: "danger",
  expired: "danger",
  failed: "danger",
  no_show: "danger"
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <Badge tone={statusTones[status.toLowerCase()] ?? "neutral"}>{label}</Badge>;
}

export function SearchBar({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("fitos-search", className)}>
      <Icon className="fitos-search__icon" name="search" size={18} />
      <Input type="search" {...props} />
    </div>
  );
}
