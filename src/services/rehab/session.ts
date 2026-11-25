export const CONSOLE_BASE = '/console';
export const LOGIN_ROUTE = '/user/login';
export const HOME_PATH = `${CONSOLE_BASE}/apps`;
let csrfToken = '';
export const getCsrfToken = () => csrfToken;
export const setCsrfToken = (value: string) => { csrfToken = value; };

export function safeReturnPath(value: string | null): string {
  if (!value || /[\\\u0000-\u001f]|%2f|%5c/i.test(value)) return HOME_PATH;
  try {
    const url = new URL(value, 'https://rehab.invalid');
    if (!value.startsWith(`${CONSOLE_BASE}/`) || url.origin !== 'https://rehab.invalid' ||
        !url.pathname.startsWith(`${CONSOLE_BASE}/`) || url.pathname.startsWith(`${CONSOLE_BASE}/user/`)) return HOME_PATH;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return HOME_PATH; }
}
export function localRoute(path: string) {
  return path.startsWith(`${CONSOLE_BASE}/`) ? path.slice(CONSOLE_BASE.length) : path;
}
export function loginRoute(path: string) {
  return `${LOGIN_ROUTE}?redirect=${encodeURIComponent(safeReturnPath(path))}`;
}
