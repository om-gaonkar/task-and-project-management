import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  /** Must equal the id of the control passed as children. */
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/**
 * Label, control, hint and error message. The hint and error get stable ids
 * (`${htmlFor}-hint`, `${htmlFor}-error`) so the control can reference them with aria-describedby.
 */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
