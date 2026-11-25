import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  createRole,
  deleteRole,
  getRole,
  getRoleContext,
  getRoleOptions,
  getRoles,
  previewRoleChange,
  renameRole,
  roleValues,
  saveRole,
} from './service';

describe('permission checked role browsing', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('sends pagination, zero-valued filters, search and the requested sort', async () => {
    const data = { data: [], total: 0, success: true };
    mockRequest.mockResolvedValue({ message: data });
    expect(
      await getRoles(
        {
          current: 2,
          pageSize: 10,
          keyword: ' 系统管理员 ',
          disabled: 0,
          desk_access: '0',
        },
        { modified: 'descend' },
      ),
    ).toBe(data);
    expect(mockRequest).toHaveBeenCalledWith(
      '/api/method/ione_core.console_role_management.get_roles',
      {
        method: 'GET',
        params: {
          current: 2,
          page_size: 10,
          keyword: '系统管理员',
          disabled: 0,
          desk_access: '0',
          sort_field: 'modified',
          sort_order: 'descend',
        },
        skipErrorHandler: true,
      },
    );
  });

  it('restores default sorting and omits cleared filters', async () => {
    mockRequest.mockResolvedValue({ message: {} });
    await getRoles(
      { keyword: ' ', disabled: '', desk_access: '' },
      { modified: null },
    );
    expect(mockRequest.mock.calls[0][1].params).toEqual({
      current: 1,
      page_size: 20,
      keyword: undefined,
      disabled: undefined,
      desk_access: undefined,
      sort_field: 'role_name',
      sort_order: 'ascend',
    });
  });

  it('uses the exact role identifier when opening read-only details', async () => {
    const detail = { name: '康复系统管理员', label: '康复系统管理员' };
    mockRequest.mockResolvedValue({ message: detail });
    expect(await getRole('康复系统管理员')).toBe(detail);
    expect(mockRequest.mock.calls[0]).toEqual([
      '/api/method/ione_core.console_roles.get_role',
      {
        method: 'GET',
        params: { role: '康复系统管理员' },
        skipErrorHandler: true,
      },
    ]);
  });

  it('preserves permission failures instead of disguising them as empty data', async () => {
    mockRequest.mockRejectedValue(new Error('forbidden'));
    await expect(getRoles({})).rejects.toThrow('forbidden');
    await expect(getRole('System Manager')).rejects.toThrow('forbidden');
  });
});

describe('role management transport', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ message: {} });
  });

  it('projects only writable fields and never changes existing identifiers through save', () => {
    const values = {
      role_name: ' New Role ',
      disabled: 0 as const,
      desk_access: false,
      two_factor_auth: false,
      home_page: ' /console ',
    };
    expect(
      roleValues(
        values,
        ['role_name', 'disabled', 'desk_access', 'home_page'],
        true,
      ),
    ).toEqual({
      role_name: 'New Role',
      disabled: 0,
      desk_access: false,
      home_page: '/console',
    });
    expect(roleValues(values, ['role_name', 'home_page'], false)).toEqual({
      home_page: '/console',
    });
  });

  it('keeps unmounted advanced fields unchanged and supports explicit clearing', () => {
    const values = {
      role_name: 'Role',
      disabled: 0 as const,
      desk_access: true,
      two_factor_auth: false,
    };
    expect(
      roleValues(values, ['home_page', 'restrict_to_domain'], false),
    ).toEqual({});
    expect(
      roleValues(
        { ...values, home_page: '', restrict_to_domain: undefined },
        ['home_page', 'restrict_to_domain'],
        false,
      ),
    ).toEqual({ home_page: null, restrict_to_domain: null });
  });

  it('reads capabilities and record-specific actions using the current session', async () => {
    await getRoleOptions();
    await getRoleContext('Role');
    expect(mockRequest.mock.calls[0][1]).toEqual({
      method: 'GET',
      skipErrorHandler: true,
    });
    expect(mockRequest.mock.calls[1][1]).toEqual({
      method: 'GET',
      params: { role: 'Role' },
      skipErrorHandler: true,
    });
  });

  it('binds preview and save to the same record version and values', async () => {
    const change = {
      role: 'Role',
      modified: 'version',
      values: { desk_access: false },
    };
    await previewRoleChange(change);
    await saveRole(change, 'opaque-confirmation');
    expect(mockRequest.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      data: { data: change },
    });
    expect(mockRequest.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      data: { data: { ...change, confirmation_token: 'opaque-confirmation' } },
    });
  });

  it('creates without assigning users or permission rules', async () => {
    await createRole({ role_name: 'Role', disabled: 0 });
    expect(mockRequest.mock.calls[0][1]).toEqual({
      method: 'POST',
      data: { data: { values: { role_name: 'Role', disabled: 0 } } },
      skipErrorHandler: true,
    });
  });

  it('renames separately and preserves exact deletion confirmation', async () => {
    await renameRole('Old Role', 'stamp', ' New Role ');
    await deleteRole('Old Role', 'stamp', ' Old Role ');
    expect(mockRequest.mock.calls[0][1].data.data).toEqual({
      role: 'Old Role',
      modified: 'stamp',
      new_name: 'New Role',
      confirm_name: 'Old Role',
    });
    expect(mockRequest.mock.calls[1][1].data.data).toEqual({
      role: 'Old Role',
      modified: 'stamp',
      confirm_name: ' Old Role ',
    });
  });
});
