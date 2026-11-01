import React, { useEffect, useRef } from "react";
export default function ConfirmDialog({
  title,
  onCancel,
  onConfirm,
}: {
  title: string;
  onCancel(): void;
  onConfirm(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previous = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = previous.current;
    dialog?.showModal();
    dialog?.querySelector("button")?.focus();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="panel modal"
      aria-labelledby="confirm-title"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(ref.current!.querySelectorAll("button"));
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
      <h2 id="confirm-title">{title}</h2>
      <p>
        No Jira changes will be made. This affects only the current in-memory
        demo.
      </p>
      <button onClick={onCancel}>Cancel</button>
      <button className="primary" onClick={onConfirm}>
        Confirm
      </button>
    </dialog>
  );
}
