import type { FieldErrors } from '../lib/validate';

/** The in-theme message under an invalid field. Its id matches the field's aria-describedby. */
export function FieldError({ id, errors }: { id: string; errors: FieldErrors }) {
  const message = errors[id];
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="field-error">
      {message}
    </p>
  );
}
