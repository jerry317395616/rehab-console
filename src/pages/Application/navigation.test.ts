import { describe, expect, it } from 'vitest';
import type {
  ApplicationModule,
  NavigationItem,
  NavigationSection,
} from '@/services/rehab/apps';
import {
  canCollapse,
  defaultSections,
  moduleNavigation,
  navigationEntries,
  selectedEntry,
} from './navigation';

const leaf = (key: string, id = key): NavigationItem => ({
  type: 'item',
  key,
  id,
  title: key,
  icon: null,
});
const section = (
  key: string,
  children: NavigationItem[],
  settings: Partial<NavigationSection> = {},
): NavigationSection => ({
  type: 'section',
  key,
  title: key,
  icon: 'lock',
  indent: true,
  collapsible: true,
  show_arrow: false,
  keep_closed: true,
  children,
  ...settings,
});
const module: ApplicationModule = {
  name: 'Users',
  title: '用户',
  items: [{ id: 'user', title: 'User' }],
  navigation: [
    leaf('home'),
    section('permissions', [leaf('first', 'user')]),
    leaf('second', 'user'),
  ],
};

describe('native sidebar navigation', () => {
  it('keeps grouped and direct entries in rendered order with their parent path', () => {
    expect(
      navigationEntries(module).map(({ item, parents }) => [
        item.key,
        parents.map((parent) => parent.key),
      ]),
    ).toEqual([
      ['home', []],
      ['first', ['permissions']],
      ['second', []],
    ]);
  });
  it('selects the requested occurrence without changing its shared route identity', () => {
    expect(selectedEntry(module, 'user', 'second')?.item.key).toBe('second');
    expect(selectedEntry(module, 'user', 'unknown')?.parents[0].key).toBe(
      'permissions',
    );
    expect(selectedEntry(module, 'forged', 'second')).toBeUndefined();
  });
  it('respects native collapse and initial closed flags', () => {
    const staticHeading = section('static', [leaf('a')], {
      indent: false,
      collapsible: false,
      keep_closed: false,
    });
    const arrow = section('arrow', [leaf('b')], {
      collapsible: false,
      show_arrow: true,
      keep_closed: false,
    });
    const opened = section('opened', [leaf('c')], { keep_closed: false });
    expect(canCollapse(staticHeading)).toBe(false);
    expect(canCollapse(arrow)).toBe(true);
    expect(
      defaultSections([
        {
          ...module,
          navigation: [
            staticHeading,
            arrow,
            opened,
            section('closed', [leaf('d')]),
          ],
        },
      ]),
    ).toEqual(['arrow', 'opened']);
  });
  it('allows cached flat responses during an interface rollout', () => {
    expect(moduleNavigation({ ...module, navigation: undefined })).toEqual([
      { type: 'item', key: 'user', id: 'user', title: 'User', icon: null },
    ]);
  });
});
