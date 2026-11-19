/**
 * In-theme form validation. Forms opt out of the browser's validation bubbles (noValidate)
 * and call `checkFields` on submit; each invalid field gets a message under it, aria-invalid,
 * and focus moves to the first one.
 */
import { useCallback, useState, type FormEvent } from 'react';

export type FieldErrors = Record<string, string>;

export interface FieldMessages {
  missing?: string;
  type?: string;
  range?: string;
}

export function messageFor(validity: ValidityState, m: FieldMessages = {}): string | null {
  if (validity.valid) return null;
  if (validity.valueMissing) return m.missing ?? 'This one is needed.';
  if (validity.typeMismatch) return m.type ?? 'That does not look right. Check the format.';
  if (validity.rangeUnderflow || validity.rangeOverflow || validity.badInput) return m.range ?? 'That number is out of range.';
  return 'Check this field.';
}

export function checkFields(form: HTMLFormElement, messages: Record<string, FieldMessages>): FieldErrors {
  const errors: FieldErrors = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.id || el.disabled) continue;
    const msg = messageFor(el.validity, messages[el.id]);
    if (msg) errors[el.id] = msg;
  }
  return errors;
}

/** Holds per-field errors for one form and wires the aria attributes. */
export function useFieldErrors(messages: Record<string, FieldMessages>) {
  const [errors, setErrors] = useState<FieldErrors>({});

  /** Returns true when the form is valid; otherwise shows the messages and focuses the first bad field. */
  const validate = useCallback(
    (e: FormEvent<HTMLFormElement>): boolean => {
      const found = checkFields(e.currentTarget, messages);
      setErrors(found);
      const first = Object.keys(found)[0];
      if (first) {
        (e.currentTarget.querySelector(`#${CSS.escape(first)}`) as HTMLElement | null)?.focus();
        return false;
      }
      return true;
    },
    [messages],
  );

  /** Clears a field's message as soon as the person edits it. */
  const onInput = useCallback((e: FormEvent<HTMLFormElement>) => {
    const id = (e.target as HTMLElement).id;
    if (!id) return;
    setErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /** aria-invalid and aria-describedby for a field, keeping any hint it already has. */
  const aria = (id: string, hintId?: string) => {
    const ids = [hintId, errors[id] ? `${id}-error` : undefined].filter(Boolean).join(' ');
    return {
      'aria-invalid': errors[id] ? (true as const) : undefined,
      'aria-describedby': ids || undefined,
    };
  };

  return { errors, validate, onInput, aria };
}
