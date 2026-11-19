import { useRef, type KeyboardEvent } from 'react';

interface Props {
  label: string;
  onChange: (html: string) => void;
  initialHtml?: string;
}

const TOOLS: { cmd: string; arg?: string; label: string; glyph: string; key?: string }[] = [
  { cmd: 'bold', label: 'Bold', glyph: 'B', key: 'b' },
  { cmd: 'italic', label: 'Italic', glyph: 'I', key: 'i' },
  { cmd: 'formatBlock', arg: 'h2', label: 'Heading', glyph: 'H' },
  { cmd: 'formatBlock', arg: 'blockquote', label: 'Quotation', glyph: '“' },
  { cmd: 'insertUnorderedList', label: 'List', glyph: '•' },
  { cmd: 'formatBlock', arg: 'p', label: 'Plain paragraph', glyph: '¶' },
];

/** A small rich-text editor on parchment. Pasting always arrives as plain text. */
export function Editor({ label, onChange, initialHtml = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      run(tool.cmd, tool.arg);
    }
  };

  return (
    <div className="editor">
      <div className="editor__toolbar" role="toolbar" aria-label="Formatting">
        <svg className="editor__inkwell" viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
          <path className="editor__quill" d="M30 2 C 22 10 19 18 18 27 L 20 27 C 22 19 26 11 33 4 Z" />
          <ellipse cx="22" cy="40" rx="15" ry="3.5" className="editor__inkwell-base" />
          <path d="M10 38 L12 27 Q22 23 32 27 L34 38 Z" className="editor__inkwell-glass" />
          <ellipse cx="22" cy="27" rx="7" ry="2.2" className="editor__inkwell-ink" />
        </svg>
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            className={`editor__tool editor__tool--${t.label.toLowerCase().replace(/\s/g, '-')}`}
            title={t.key ? `${t.label} (Ctrl/⌘+${t.key.toUpperCase()})` : t.label}
            aria-label={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd, t.arg)}
          >
            {t.glyph}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="editor__page parchment"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder="My dearest…"
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        onKeyDown={onKeyDown}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />
    </div>
  );
}
