import { describe, expect, it } from 'vitest';
import access from './access';

describe('server-provided console capabilities', () => {
  it('allows the capability supplied by the session API', () => {
    expect(
      access({ currentUser: { capabilities: { can_admin: true } } }).canAdmin,
    ).toBe(true);
  });
  it('does not treat the template admin string as a permission', () => {
    expect(access({ currentUser: { access: 'admin' } }).canAdmin).toBe(false);
  });
  it('denies missing and revoked capabilities', () => {
    expect(access(undefined).canAdmin).toBe(false);
    expect(
      access({ currentUser: { capabilities: { can_admin: false } } }).canAdmin,
    ).toBe(false);
  });
});
