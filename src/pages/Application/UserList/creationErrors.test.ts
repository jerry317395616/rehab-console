import { describe, expect, it, vi } from 'vitest';

vi.mock('@umijs/max', () => ({ request: vi.fn() }));

import { creationError } from './creationErrors';

describe('creation validation feedback', () => {
  it('maps only known fields and renders native markup as plain text', () => {
    const parsed = creationError({
      response: {
        status: 417,
        data: {
          field_errors: { email: '邮箱已存在', flags: 'ignored' },
          _server_messages: JSON.stringify([
            JSON.stringify({ message: '<b>邮箱</b>已存在' }),
          ]),
        },
      },
    });
    expect(parsed.fieldErrors).toEqual([
      { name: 'email', errors: ['邮箱已存在'] },
    ]);
    expect(parsed.message).toBe('邮箱已存在');
  });
  it('handles transport errors and permission changes without parsing HTML into the UI', () => {
    expect(
      creationError({
        response: { status: 403, data: { _server_messages: 'invalid' } },
      }).message,
    ).toContain('权限');
    expect(creationError({ response: { status: 401 } }).message).toContain(
      '登录已失效',
    );
    expect(creationError(new Error('network')).fieldErrors).toEqual([]);
  });
});
