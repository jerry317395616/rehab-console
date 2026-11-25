import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  equalRules,
  getPermissionCatalog,
  getPermissionContext,
  type PermissionRule,
  permissionDelta,
  previewPermissions,
  savePermissions,
} from './service';

const rule = (
  rights: Record<string, 0 | 1>,
  level = 0,
  owner: 0 | 1 = 0,
): PermissionRule => ({ permlevel: level, if_owner: owner, rights });

describe('native role permission transport and review', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });
  it('requests the selected role catalog without accepting client capability flags', async () => {
    mockRequest.mockResolvedValue({ message: { objects: [] } });
    expect(await getPermissionCatalog('康复治疗师')).toEqual({ objects: [] });
    expect(mockRequest).toHaveBeenCalledWith(
      '/api/method/ione_core.console_role_permissions.get_catalog',
      { method: 'GET', params: { role: '康复治疗师' }, skipErrorHandler: true },
    );
  });
  it('requests field rules for the exact role and DocType', async () => {
    mockRequest.mockResolvedValue({ message: { version: 'v1' } });
    expect(await getPermissionContext('Therapist', 'Patient')).toEqual({
      version: 'v1',
    });
    expect(mockRequest.mock.calls[0][1].params).toEqual({
      role: 'Therapist',
      doctype: 'Patient',
    });
  });
  it('previews and saves the same versioned change with a confirmation token', async () => {
    mockRequest.mockResolvedValue({ message: {} });
    const changes = [
      { doctype: 'Patient', version: 'v1', rules: [rule({ read: 1 })] },
    ];
    await previewPermissions('Therapist', changes);
    await savePermissions('Therapist', changes, 'opaque');
    expect(mockRequest.mock.calls[0][1].data).toEqual({
      data: { role: 'Therapist', changes },
    });
    expect(mockRequest.mock.calls[1][1]).toEqual({
      method: 'POST',
      data: { data: { role: 'Therapist', changes, token: 'opaque' } },
      skipErrorHandler: true,
    });
  });
  it('compares rules without relying on object key or row order', () => {
    expect(
      equalRules(
        [rule({ read: 1, write: 0 }), rule({ read: 1 }, 1)],
        [rule({ read: 1 }, 1), rule({ write: 0, read: 1 })],
      ),
    ).toBe(true);
    expect(equalRules([rule({ read: 1 })], [rule({ read: 1 }, 0, 1)])).toBe(
      false,
    );
  });
  it('previews additions, removals and field rights independently', () => {
    expect(
      permissionDelta(
        [rule({ read: 1, write: 0 }), rule({ read: 1 }, 0, 1)],
        [rule({ read: 1, write: 1 }), rule({ read: 1, write: 1 }, 1)],
      ),
    ).toEqual([
      '级别 0 · 不按创建者限制：授予修改',
      '级别 0 · 仅本人创建：撤销查看',
      '级别 1 · 不按创建者限制：授予查看、授予修改',
    ]);
  });
  it('does not report unchanged rights as added or revoked', () => {
    expect(
      permissionDelta(
        [rule({ read: 1, write: 0 })],
        [rule({ write: 0, read: 1 })],
      ),
    ).toEqual([]);
  });
  it('propagates stale-version and permission errors for the retained edit view', async () => {
    const error = Object.assign(new Error('stale permission version'), {
      response: { status: 417 },
    });
    mockRequest.mockRejectedValue(error);
    await expect(savePermissions('Therapist', [], 'old')).rejects.toThrow(
      'stale permission version',
    );
  });
});
