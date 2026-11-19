import { describe, expect, it } from 'vitest';
import { newestFirst } from '../../src/web/components/TimeMachine';
import type { OutboxMessage } from '../../src/web/lib/api';

const msg = (id: number, sentAt: number, name: string): OutboxMessage => ({
  id,
  kind: 'witness-ask',
  to: { name, email: `${name.toLowerCase()}@example.com` },
  subject: 'Witness asked',
  text: '',
  sentAt,
});

describe('the outbox order', () => {
  it('shows the newest moment first and keeps send order within one moment', () => {
    const sorted = newestFirst([msg(1, 100_000, 'Mara'), msg(2, 200_000, 'Silas'), msg(3, 200_000, 'Ada')]);
    expect(sorted.map((m) => m.to.name)).toEqual(['Silas', 'Ada', 'Mara']);
  });

  it('treats mail sent milliseconds apart as one moment', () => {
    const day = 86_400_000;
    const sorted = newestFirst([msg(1, 0, 'Mara'), msg(2, 30 * day, 'Silas'), msg(3, 30 * day + 3, 'Ada'), msg(4, 37 * day, 'June')]);
    expect(sorted.map((m) => m.to.name)).toEqual(['June', 'Silas', 'Ada', 'Mara']);
  });

  it('does not change the list it was given', () => {
    const list = [msg(1, 100_000, 'Mara'), msg(2, 200_000, 'Silas')];
    newestFirst(list);
    expect(list.map((m) => m.id)).toEqual([1, 2]);
  });
});
