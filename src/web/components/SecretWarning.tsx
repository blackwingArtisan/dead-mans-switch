import type { SecretFinding } from '../../core/runbook';

/**
 * Tells the author, in words, that the draft looks like it holds a password or a code. It is always in the page
 * (so a polite announcement fires when it fills) and it never blocks sealing.
 */
export function SecretWarning({ findings }: { findings: SecretFinding[] }) {
  return (
    <div role="status" aria-live="polite" data-testid="secret-warning-region">
      {findings.length > 0 && (
        <div className="warning secret-warning" data-testid="secret-warning">
          <p>
            <strong>Careful: this may hold a password or a code.</strong> Write where it is kept, never the secret itself. You can still seal the letter.
          </p>
          <ul>
            {findings.map((f) => (
              <li key={`${f.line}-${f.kind}`}>
                Line {f.line} looks like {f.kind === 'labelled' ? 'a labelled password or code' : f.kind === 'code-groups' ? 'a recovery code' : 'a long random string'} (“{f.preview}”).
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
