import { describe, expect, it, vi } from 'vitest';
vi.mock('@umijs/max', () => ({ request: vi.fn() }));
import { applicationRoute, filterApplications, menuItemRoute, moduleRoute, navigationRoute, safeApplicationPath } from './apps';

const apps = [
  { name: 'hrms', title: 'Frappe HR', route: '/desk/hr-setup' },
  { name: 'rehab', title: '康复系统', route: '/desk/rehab-home' },
];

describe('registered application navigation', () => {
  it('uses new frontend routes for every application, independently of native entry paths', () => {
    expect(applicationRoute('frappe')).toBe('/apps/frappe');
    expect(applicationRoute('hrms')).toBe('/apps/hrms');
    expect(applicationRoute('app_with-dashes')).toBe('/apps/app_with-dashes');
    expect(moduleRoute('frappe', 'System')).toBe('/apps/frappe/System');
    expect(moduleRoute('frappe', '自定义 模块')).toBe('/apps/frappe/%E8%87%AA%E5%AE%9A%E4%B9%89%20%E6%A8%A1%E5%9D%97');
  });
  it.each(['', '..', '../desk', '//outside.test', 'https://outside.test'])('rejects invalid application identity %s', name => {
    expect(applicationRoute(name)).toBeUndefined();
  });
  it('keeps menu identities inside their application and module route', () => {
    expect(menuItemRoute('frappe', 'Users', 'abc123')).toBe('/apps/frappe/Users/abc123');
    expect(menuItemRoute('frappe', 'Custom Module', 'DocType|User')).toBe('/apps/frappe/Custom%20Module/DocType%7CUser');
  });
  it('preserves the stable item path while distinguishing its sidebar occurrence', () => {
    expect(navigationRoute('frappe', 'Users', { id: 'user-id', key: 'shell/key', title: 'User', type: 'item', icon: null })).toBe('/apps/frappe/Users/user-id?node=shell%2Fkey');
  });
  it('preserves same-origin app entry paths including queries and fragments', () => {
    expect(safeApplicationPath('/desk/hr-setup?view=team#people')).toBe('/desk/hr-setup?view=team#people');
  });
  it.each([undefined, null, '', 'javascript:alert(1)', 'https://outside.test/apps', '//outside.test',
    '/\\outside.test', '/%2f%2foutside.test', '/desk\n'])('rejects unsafe or missing entry %s', value => {
    expect(safeApplicationPath(value)).toBeUndefined();
  });
  it('searches only the applications supplied for the current user', () => {
    expect(filterApplications(apps, ' FRAPPE ')).toEqual([apps[0]]);
    expect(filterApplications(apps, '康复')).toEqual([apps[1]]);
    expect(filterApplications(apps, 'ERPNext')).toEqual([]);
    expect(filterApplications([], '')).toEqual([]);
    expect(apps).toHaveLength(2);
  });
});
