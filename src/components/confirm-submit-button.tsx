"use client";

import type { MouseEvent, ReactNode } from "react";

export function ConfirmSubmitButton({ children, disabled, message, title }: {
  children: ReactNode;
  disabled?: boolean;
  message: string;
  title?: string;
}) {
  function confirmSubmission(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return <button className="button button-secondary button-small" disabled={disabled} onClick={confirmSubmission} title={title} type="submit">{children}</button>;
}
