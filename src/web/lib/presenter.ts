/**
 * Presenter mode for demo recordings: `?presenter=1` hides the demo chrome (the demo guide and the
 * outbox badge, and fades the Time machine button until it is hovered or focused), so a take shows
 * only the product. It lasts for the browser tab; `?presenter=0` turns it off.
 */
const KEY = 'dms.presenter';

export function initPresenter(search = window.location.search): boolean {
  const flag = new URLSearchParams(search).get('presenter');
  let on = false;
  try {
    if (flag === '1') window.sessionStorage.setItem(KEY, '1');
    if (flag === '0') window.sessionStorage.removeItem(KEY);
    on = window.sessionStorage.getItem(KEY) === '1';
  } catch {
    // Storage can be blocked; fall back to the query string alone.
    on = flag === '1';
  }
  if (on) document.documentElement.dataset.presenter = '';
  else delete document.documentElement.dataset.presenter;
  return on;
}
