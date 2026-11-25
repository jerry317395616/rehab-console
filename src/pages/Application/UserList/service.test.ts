import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  createUser,
  getCreationOptions,
  getRoleAccess,
  getUserRoles,
  getUsers,
  saveUserRoles,
} from './service';

describe('permission checked user list transport', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });
  it('sends pagination, zero-valued status and the requested server sort', async () => {
    const result = {
      data: [{ name: 'one@example.test' }],
      total: 31,
      success: true,
    };
    mockRequest.mockResolvedValue({ message: result });
    expect(
      await getUsers(
        {
          current: 2,
          pageSize: 10,
          keyword: ' test ',
          enabled: 0,
          user_type: 'System User',
        },
        { full_name: 'ascend' },
      ),
    ).toBe(result);
    expect(mockRequest).toHaveBeenCalledWith(
      '/api/method/ione_core.console_users.get_users',
      {
        method: 'GET',
        skipErrorHandler: true,
        params: {
          current: 2,
          page_size: 10,
          keyword: 'test',
          enabled: 0,
          user_type: 'System User',
          sort_field: 'full_name',
          sort_order: 'ascend',
        },
      },
    );
  });
  it('clears empty filters and restores deterministic default sorting', async () => {
    mockRequest.mockResolvedValue({
      message: { data: [], total: 0, success: true },
    });
    await getUsers(
      { keyword: ' ', enabled: '', user_type: '' },
      { full_name: null },
    );
    expect(mockRequest.mock.calls[0][1].params).toEqual({
      current: 1,
      page_size: 20,
      keyword: undefined,
      enabled: undefined,
      user_type: undefined,
      sort_field: 'modified',
      sort_order: 'descend',
    });
  });
  it('does not disguise permission failures as an empty successful list', async () => {
    const error = Object.assign(new Error('forbidden'), {
      response: { status: 403 },
    });
    mockRequest.mockRejectedValue(error);
    await expect(getUsers({})).rejects.toThrow('forbidden');
  });
});

describe('native user creation transport', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });
  it('reads the current actor capabilities without requesting another user identity', async () => {
    const options = { can_create: true, can_assign_roles: false, roles: [] };
    mockRequest.mockResolvedValue({ message: options });
    expect(await getCreationOptions()).toBe(options);
    expect(mockRequest.mock.calls[0][1]).toEqual({
      method: 'GET',
      skipErrorHandler: true,
    });
  });
  it('posts only create fields and preserves the exact initial password', async () => {
    mockRequest.mockResolvedValue({ message: { name: 'new@example.test' } });
    await createUser({
      email: ' new@example.test ',
      first_name: ' Test ',
      enabled: true,
      credential_mode: 'password',
      password: 'exact test password ',
      password_confirm: 'exact test password ',
    });
    expect(mockRequest.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      skipErrorHandler: true,
      data: {
        data: {
          email: 'new@example.test',
          first_name: 'Test',
          password: 'exact test password ',
          password_confirm: 'exact test password ',
          roles: [],
        },
      },
    });
  });
  it('does not send a stale password with an invitation', async () => {
    mockRequest.mockResolvedValue({ message: {} });
    await createUser({
      email: 'new@example.test',
      first_name: 'Test',
      enabled: true,
      credential_mode: 'invitation',
      password: 'stale secret',
      password_confirm: 'stale secret',
    });
    expect(mockRequest.mock.calls[0][1].data.data).not.toHaveProperty(
      'password',
    );
    expect(mockRequest.mock.calls[0][1].data.data).not.toHaveProperty(
      'password_confirm',
    );
  });
});

describe('native user role transport', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('reads session capabilities and the selected user separately', async () => {
    const context = { can_view: true, can_edit: false };
    mockRequest.mockResolvedValue({ message: context });
    expect(await getRoleAccess()).toBe(context);
    expect(mockRequest.mock.calls[0]).toEqual([
      '/api/method/ione_core.console_user_roles.get_role_access',
      { method: 'GET', skipErrorHandler: true },
    ]);
    expect(await getUserRoles('target@example.test')).toBe(context);
    expect(mockRequest.mock.calls[1][1]).toEqual({
      method: 'GET',
      params: { user: 'target@example.test' },
      skipErrorHandler: true,
    });
  });

  it.each(['direct', 'profiles'] as const)(
    'sends the version and only the active %s role source',
    async (mode) => {
      mockRequest.mockResolvedValue({
        message: { name: 'target@example.test' },
      });
      await saveUserRoles(
        'target@example.test',
        '2026-11-09 12:00:00.123456',
        { mode, roles: ['Desk Role'], role_profiles: ['Clinical Team'] },
        true,
      );
      expect(mockRequest.mock.calls[0]).toEqual([
        '/api/method/ione_core.console_user_roles.save_user_roles',
        {
          method: 'POST',
          skipErrorHandler: true,
          data: {
            data: {
              user: 'target@example.test',
              modified: '2026-11-09 12:00:00.123456',
              mode,
              roles: mode === 'direct' ? ['Desk Role'] : [],
              role_profiles: mode === 'profiles' ? ['Clinical Team'] : [],
              confirm_loss_of_desk_access: true,
            },
          },
        },
      ]);
    },
  );
});
