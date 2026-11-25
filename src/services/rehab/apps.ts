import { request } from '@umijs/max';

export type DesktopApp = {
  name: string;
  title: string;
  logo?: string | null;
  route?: string | null;
};

export type ApplicationMenuItem = { id: string; title: string; target?: { type: string; name: string } };
export type NavigationItem = ApplicationMenuItem & { type: 'item'; key: string; icon: string | null };
export type NavigationDivider = { type: 'divider'; key: string };
export type NavigationSection = {
  type: 'section'; key: string; title: string; icon: string | null;
  indent: boolean; collapsible: boolean; show_arrow: boolean; keep_closed: boolean;
  children: (NavigationItem | NavigationDivider)[];
};
export type NavigationNode = NavigationItem | NavigationDivider | NavigationSection;
export type ApplicationModule = { name: string; title: string; items: ApplicationMenuItem[]; navigation?: NavigationNode[] };
export type ApplicationContext = {
  app: Pick<DesktopApp, 'name' | 'title' | 'logo'>;
  supported: boolean;
  modules: ApplicationModule[];
};

export async function getApplication(appName: string): Promise<ApplicationContext> {
  const response = await request<{ message: ApplicationContext }>(
    '/api/method/rehab.frontend_auth.get_application',
    { method: 'GET', params: { app_name: appName }, skipErrorHandler: true },
  );
  return response.message;
}

export function applicationRoute(name: string): string | undefined {
  return /^[a-zA-Z0-9_-]+$/.test(name) ? `/apps/${name}` : undefined;
}

export function moduleRoute(appName: string, moduleName: string): string {
  return `${applicationRoute(appName)}/${encodeURIComponent(moduleName)}`;
}

export function menuItemRoute(appName: string, moduleName: string, itemId: string): string {
  return `${moduleRoute(appName, moduleName)}/${encodeURIComponent(itemId)}`;
}

export function navigationRoute(appName: string, moduleName: string, item: NavigationItem): string {
  return `${menuItemRoute(appName, moduleName, item.id)}?node=${encodeURIComponent(item.key)}`;
}

export async function getApplications(): Promise<DesktopApp[]> {
  const response = await request<{ message: DesktopApp[] }>(
    '/api/method/rehab.frontend_auth.get_apps',
    { method: 'GET', skipErrorHandler: true },
  );
  return response.message;
}

export function safeApplicationPath(value?: string | null): string | undefined {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]|%2f|%5c/i.test(value)) return undefined;
  const url = new URL(value, 'https://application.invalid');
  if (url.origin !== 'https://application.invalid') return undefined;
  return url.pathname + url.search + url.hash;
}

export function filterApplications(apps: DesktopApp[], query: string) {
  const text = query.trim().toLocaleLowerCase();
  return apps.filter(app => (app.title || app.name).toLocaleLowerCase().includes(text));
}
