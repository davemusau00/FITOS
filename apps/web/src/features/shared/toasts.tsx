import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { Icon, type IconName } from "@fitos/ui";

export type ToastTone = "success" | "warning" | "error" | "info";

export type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
  duration?: number;
};

type ToastContextValue = {
  toast: (options: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastTone, IconName> = {
  success: "check",
  warning: "warning",
  error: "warning",
  info: "spark"
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ duration = 4500, message, title, tone }: Omit<ToastItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, title, message, tone, duration };
      setToasts((prev) => [...prev.slice(-4), newToast]);
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string) => toast({ title, message, tone: "success" }),
    [toast]
  );
  const warning = useCallback(
    (title: string, message?: string) => toast({ title, message, tone: "warning" }),
    [toast]
  );
  const error = useCallback(
    (title: string, message?: string) => toast({ title, message, tone: "error" }),
    [toast]
  );
  const info = useCallback(
    (title: string, message?: string) => toast({ title, message, tone: "info" }),
    [toast]
  );

  const value = useMemo(
    () => ({ toast, success, warning, error, info, dismiss }),
    [toast, success, warning, error, info, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-container">
        {toasts.map((item) => (
          <div className={`toast toast--${item.tone}`} key={item.id} role="status">
            <div className="toast__icon">
              <Icon name={icons[item.tone]} size={18} />
            </div>
            <div className="toast__body">
              <strong className="toast__title">{item.title}</strong>
              {item.message ? <p className="toast__message">{item.message}</p> : null}
            </div>
            <button
              aria-label="Dismiss notification"
              className="toast__close"
              onClick={() => dismiss(item.id)}
              type="button"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
