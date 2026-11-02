import React, { useEffect, useRef } from "react";
import Icon, { type IconName } from "./Icon";

/**
 * Modal confirmation for Jira-affecting steps. Native <dialog> provides the modal
 * boundary; focus starts on Cancel (the safe choice) and returns to the trigger.
 */
export default function DecisionDialog({
  title,
  icon,
  tone,
  children,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  icon: IconName;
  tone: "accent" | "danger";
  children: React.ReactNode;
  confirmLabel: string;
  onCancel(): void;
  onConfirm(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previous = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = previous.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    dialog?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
    return () => {
      dialog?.close?.();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ax-dialog ax-dialog--${tone}`}
      aria-labelledby="dialog-title"
      aria-describedby="dialog-body"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            "button, [href], [tabindex='0']",
          ),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="ax-dialog__head">
        <span className="ax-dialog__icon" aria-hidden="true">
          <Icon name={icon} size={20} />
        </span>
        <h2 id="dialog-title">{title}</h2>
      </div>
      <div className="ax-dialog__body" id="dialog-body">
        {children}
      </div>
      <div className="ax-dialog__actions">
        <button className="ax-btn" data-cancel onClick={onCancel}>
          Cancel
        </button>
        <button
          className={`ax-btn ${tone === "danger" ? "ax-btn--danger" : "ax-btn--primary"}`}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
