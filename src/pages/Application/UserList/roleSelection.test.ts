import { describe, expect, it, vi } from 'vitest';

vi.mock('@umijs/max', () => ({ request: vi.fn() }));

import { losesDeskAccess, selectedRoles } from './roleSelection';
import type { UserRoleContext } from './service';

const context: UserRoleContext = {
  user: {
    name: 'one',
    email: 'one@test',
    full_name: 'One',
    modified: 'v1',
    enabled: true,
    user_type: 'System User',
  },
  mode: 'direct',
  roles: ['Desk'],
  role_profiles: [],
  can_edit: true,
  can_use_profiles: true,
  protected: false,
  automatic_roles: [],
  role_options: [
    { name: 'Desk', label: 'Desk', desk_access: true },
    { name: 'Portal', label: 'Portal', desk_access: false },
  ],
  profile_options: [
    { name: 'A', roles: ['Desk', 'Portal'], available: true },
    { name: 'B', roles: ['Desk'], available: true },
  ],
};
describe('role assignment draft', () => {
  it('unions selected profile roles and keeps native role identity', () => {
    expect(
      selectedRoles(
        { mode: 'profiles', roles: ['ignored'], role_profiles: ['A', 'B'] },
        context,
      ),
    ).toEqual(['Desk', 'Portal']);
  });
  it('preserves existing expanded roles when detaching an inaccessible profile', () => {
    expect(
      selectedRoles(
        { mode: 'profiles', roles: [], role_profiles: ['unknown'] },
        context,
      ),
    ).toEqual(['Desk']);
  });
  it('requires a warning only when a system user loses every desk role', () => {
    expect(
      losesDeskAccess(
        { mode: 'direct', roles: ['Portal'], role_profiles: [] },
        context,
      ),
    ).toBe(true);
    expect(
      losesDeskAccess(
        { mode: 'profiles', roles: [], role_profiles: ['B'] },
        context,
      ),
    ).toBe(false);
    expect(
      losesDeskAccess(
        { mode: 'direct', roles: [], role_profiles: [] },
        { ...context, user: { ...context.user, user_type: 'Website User' } },
      ),
    ).toBe(false);
  });
});
