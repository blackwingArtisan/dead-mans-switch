import { useState } from 'react';
import { ACCOUNT_KINDS, addSection, removeSection, RUNBOOK_WARNING, type AccountKind, type RunbookSection } from '../../core/runbook';

interface Props {
  sections: RunbookSection[];
  onChange: (sections: RunbookSection[]) => void;
}

/** The founder runbook form: one fieldset per account kind. What it writes is an ordinary letter body. */
export function RunbookBuilder({ sections, onChange }: Props) {
  const absent = ACCOUNT_KINDS.filter((k) => !sections.some((s) => s.kind === k.id));
  const [toAdd, setToAdd] = useState<AccountKind | ''>('');
  const set = (kind: AccountKind, field: 'where' | 'who' | 'due', value: string) =>
    onChange(sections.map((s) => (s.kind === kind ? { ...s, [field]: value } : s)));

  return (
    <div className="runbook" data-testid="runbook">
      <p className="warning runbook__warning" data-testid="runbook-warning">
        {RUNBOOK_WARNING}
      </p>
      {sections.map((s) => {
        const info = ACCOUNT_KINDS.find((k) => k.id === s.kind)!;
        return (
          <fieldset key={s.kind} className="runbook__section" data-testid={`runbook-${s.kind}`}>
            <legend>{info.title}</legend>
            <div className="field">
              <label htmlFor={`rb-${s.kind}-where`}>Where the login and recovery codes live</label>
              <input id={`rb-${s.kind}-where`} value={s.where} placeholder={info.placeholder} onChange={(e) => set(s.kind, 'where', e.target.value)} />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor={`rb-${s.kind}-who`}>Who to call</label>
                <input id={`rb-${s.kind}-who`} value={s.who} placeholder="A name and a number" onChange={(e) => set(s.kind, 'who', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor={`rb-${s.kind}-due`}>Renews or is due</label>
                <input id={`rb-${s.kind}-due`} value={s.due} placeholder="For example, every March" onChange={(e) => set(s.kind, 'due', e.target.value)} />
              </div>
            </div>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(removeSection(sections, s.kind))}>
              Remove this section<span className="sr-only">: {info.title}</span>
            </button>
          </fieldset>
        );
      })}
      {absent.length > 0 && (
        <div className="runbook__add">
          <label htmlFor="rb-add">Add a section</label>
          <select id="rb-add" value={toAdd} onChange={(e) => setToAdd(e.target.value as AccountKind | '')}>
            <option value="">Choose an account</option>
            {absent.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={!toAdd}
            onClick={() => {
              if (toAdd) onChange(addSection(sections, toAdd));
              setToAdd('');
            }}
          >
            Add the section
          </button>
        </div>
      )}
    </div>
  );
}
