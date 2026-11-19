/**
 * The sealed export: what an author can download at any time, and what the operator promises to send
 * every author if the service ever closes. It holds each unopened letter exactly as the vault holds it
 * (ciphertext, IV and the vault half B), so a keepsake-custody letter still needs the recipient's
 * keepsake half A to open. `offline-open.html` opens one with nothing else: no server, no network.
 */
import type { Custody } from './types';

export const EXPORT_FORMAT = 'dms-export-v1';

export interface ExportedLetter {
  id: string;
  recipientName: string;
  custody: Custody;
  sealedAt: number;
  releasedAt: number | null;
  ciphertext: string;
  iv: string;
  vaultHalf: string;
  keepsakeTag: string;
  /** Only for vault custody, where the vault already holds both halves. */
  keepsakeHalf?: string;
}

export interface SealedExport {
  format: typeof EXPORT_FORMAT;
  exportedAt: number;
  authorName: string;
  letters: ExportedLetter[];
}
