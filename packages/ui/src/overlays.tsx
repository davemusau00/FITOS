import { useEffect, useId, useRef, type PropsWithChildren, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./primitives";

type OverlayProps = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
}>;

function useDismissibleOverlay(
  isOpen: boolean,
  onClose: () => void,
  initialFocus?: React.RefObject<HTMLElement | null>
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    window.setTimeout(() => initialFocus?.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
      // Restore after the closing state has committed. Parent mutations can
      // re-render the trigger during unmount, which otherwise steals focus.
      window.setTimeout(() => {
        if (previous?.isConnected) previous.focus();
      }, 0);
    };
  }, [initialFocus, isOpen]);
}

export function Modal({ children, description, footer, isOpen, onClose, title }: OverlayProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useDismissibleOverlay(isOpen, onClose, closeRef);
  if (!isOpen) return null;
  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fitos-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section className="fitos-modal">
        <header className="fitos-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p className="fitos-modal__description">{description}</p> : null}
          </div>
          <IconButton
            icon="close"
            label="Close dialog"
            onClick={onClose}
            ref={closeRef}
            size="small"
            variant="ghost"
          />
        </header>
        <div className="fitos-modal__body">{children}</div>
        {footer ? <footer className="fitos-modal__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  );
}

export function AlertDialog({
  confirmLabel = "Confirm",
  children,
  description,
  isOpen,
  onClose,
  onConfirm,
  title
}: OverlayProps & { confirmLabel?: string; onConfirm: () => void }) {
  return (
    <Modal
      description={description}
      footer={
        <>
          <button className="fitos-button fitos-button--ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="fitos-button fitos-button--danger" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      {children}
    </Modal>
  );
}

export function Drawer({ children, description, footer, isOpen, onClose, title }: OverlayProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useDismissibleOverlay(isOpen, onClose, closeRef);
  if (!isOpen) return null;
  return createPortal(
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fitos-overlay fitos-drawer-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <aside className="fitos-drawer">
        <header className="fitos-modal__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p className="fitos-modal__description">{description}</p> : null}
          </div>
          <IconButton
            icon="close"
            label="Close panel"
            onClick={onClose}
            ref={closeRef}
            size="small"
            variant="ghost"
          />
        </header>
        <div className="fitos-modal__body">{children}</div>
        {footer ? <footer className="fitos-modal__footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body
  );
}
