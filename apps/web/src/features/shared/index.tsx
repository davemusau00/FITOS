import { Skeleton, Alert } from "@fitos/ui";
import { ApiClientError } from "../../lib/api/client";

export function PageLoading() {
  return (
    <div className="page-loading">
      <Skeleton height="2.75rem" width="16rem" />
      <Skeleton height="16rem" />
      <Skeleton height="16rem" />
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const message =
    error instanceof ApiClientError ? error.message : "Something went wrong. Try again.";
  const requestId = error instanceof ApiClientError ? error.requestId : undefined;
  return (
    <Alert title="Unable to complete that action" tone="danger">
      <span>
        {message}
        {requestId ? ` Reference: ${requestId}` : ""}
      </span>
      {onRetry ? (
        <button
          className="fitos-button fitos-button--secondary fitos-button--small error-notice__retry"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      ) : null}
    </Alert>
  );
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatCurrency(
  amountMinor: string | null | undefined,
  currency: string | null | undefined
) {
  if (!amountMinor || !currency) return "—";
  const amount = parseInt(amountMinor, 10) / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

export { ToastProvider, useToast, type ToastTone, type ToastItem } from "./toasts";
