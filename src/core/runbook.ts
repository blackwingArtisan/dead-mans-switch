/**
 * The founder runbook: a letter template, built only from tags the sanitiser allows, and a check
 * for likely secrets. Pure and browser-safe; nothing here logs, stores or sends text.
 */

export type AccountKind = 'cloud' | 'registrar' | 'payments' | 'bank' | 'password-manager';

export interface AccountKindInfo {
  id: AccountKind;
  title: string;
  /** Example text for the "where" field: a place, never a secret. */
  placeholder: string;
}

export const ACCOUNT_KINDS: readonly AccountKindInfo[] = [
  { id: 'cloud', title: 'Cloud root account', placeholder: 'The sealed envelope in the office safe' },
  { id: 'registrar', title: 'Domain registrar', placeholder: 'The company password manager, entry “Registrar”' },
  { id: 'payments', title: 'Payments and contractor payouts', placeholder: 'The payments dashboard; the schedule is pinned in the finance channel' },
  { id: 'bank', title: 'Bank', placeholder: 'The branch where the account was opened' },
  { id: 'password-manager', title: 'The password manager itself', placeholder: 'Its emergency kit, in the same envelope' },
];

export interface RunbookSection {
  kind: AccountKind;
  /** Where the login and the recovery codes live. A place, never the codes. */
  where: string;
  /** Who to call. */
  who: string;
  /** The renewal or due date, in words. */
  due: string;
}

export const RUNBOOK_WARNING =
  'Never paste a password or recovery code into this letter. Write only where to find it: which safe, which password-manager entry, which drawer.';

export const blankSection = (kind: AccountKind): RunbookSection => ({ kind, where: '', who: '', due: '' });

export const newRunbook = (): RunbookSection[] => ACCOUNT_KINDS.map((k) => blankSection(k.id));

export function addSection(sections: RunbookSection[], kind: AccountKind): RunbookSection[] {
  return sections.some((s) => s.kind === kind) ? sections : [...sections, blankSection(kind)];
}

export function removeSection(sections: RunbookSection[], kind: AccountKind): RunbookSection[] {
  return sections.filter((s) => s.kind !== kind);
}

export function runbookIsBlank(sections: RunbookSection[]): boolean {
  return sections.every((s) => !s.where.trim() && !s.who.trim() && !s.due.trim());
}

const FIELD_LABELS: [keyof Pick<RunbookSection, 'where' | 'who' | 'due'>, string][] = [
  ['where', 'Where the login and recovery codes live'],
  ['who', 'Who to call'],
  ['due', 'Renews or is due'],
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** The letter body for these sections. Tags: h2, ul, li, strong. No attributes. */
export function runbookHtml(sections: RunbookSection[]): string {
  return sections
    .map((s) => {
      const title = ACCOUNT_KINDS.find((k) => k.id === s.kind)?.title ?? s.kind;
      const items = FIELD_LABELS.filter(([f]) => s[f].trim()).map(
        ([f, label]) => `<li><strong>${label}:</strong> ${escapeHtml(s[f].trim())}</li>`,
      );
      return `<h2>${escapeHtml(title)}</h2>${items.length ? `<ul>${items.join('')}</ul>` : ''}`;
    })
    .join('');
}

export interface SecretFinding {
  /** 1-based line of the draft. */
  line: number;
  kind: 'labelled' | 'long-string' | 'code-groups';
  /** First three characters of the match, then an ellipsis. Never the whole secret. */
  preview: string;
}

const LABELLED = /\b(?:password|passcode|passwd|pin|secret|recovery code|backup code|api key|token)s?\s*[:=]\s*(\S+)/i;
const LONG_RUN = /[A-Za-z0-9_\-+/=]{20,}/g;
const CODE_GROUPS = /\b(?:[A-Za-z0-9]{4,6}-){2,}[A-Za-z0-9]{4,6}\b/;

const mask = (s: string) => `${[...s].slice(0, 3).join('')}…`;

/** Looks for text that resembles a password or code. Takes plain text; returns at most one finding per line. */
export function findLikelySecrets(text: string): SecretFinding[] {
  const found: SecretFinding[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const labelled = LABELLED.exec(raw);
    if (labelled) return void found.push({ line, kind: 'labelled', preview: mask(labelled[1]!) });
    for (const m of raw.matchAll(LONG_RUN)) {
      const run = m[0];
      const before = raw.slice(0, m.index);
      if (/https?:\/\/\S*$/i.test(before) || /^https?:/i.test(run)) continue;
      if (/\S*@\S*$/.test(before) || raw.slice(m.index! + run.length).startsWith('@')) continue;
      if (/[A-Za-z]/.test(run) && /\d/.test(run)) return void found.push({ line, kind: 'long-string', preview: mask(run) });
    }
    const groups = CODE_GROUPS.exec(raw);
    if (groups && /\d/.test(groups[0])) found.push({ line, kind: 'code-groups', preview: mask(groups[0]) });
  });
  return found;
}

/** Plain text of letter HTML, one line per block, for the secret check. Not for display. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h2|h3|div|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
