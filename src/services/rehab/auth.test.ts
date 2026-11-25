import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCsrfToken, setCsrfToken } from './session';
const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));
import { getSession, login, logout } from './auth';

describe('Frappe session transport', () => {
  beforeEach(() => { mockRequest.mockReset(); setCsrfToken(''); });
  it('projects the native message envelope and keeps the CSRF token out of user state', async () => {
    mockRequest.mockResolvedValue({ message: { userid: 'doctor@test', roles: ['Rehab Physician'], csrf_token: 'test-csrf' } });
    expect(await getSession()).toEqual({ userid: 'doctor@test', roles: ['Rehab Physician'] });
    expect(getCsrfToken()).toBe('test-csrf');
  });
  it('passes login credentials only to the native password endpoint', async () => {
    await login({ usr: 'doctor@test', pwd: 'test-only' });
    expect(mockRequest).toHaveBeenCalledWith('/api/method/login', expect.objectContaining({ method: 'POST', data: { usr: 'doctor@test', pwd: 'test-only' } }));
  });
  it('does not discard local authentication when server logout fails', async () => {
    setCsrfToken('active');
    mockRequest.mockRejectedValue(new Error('network'));
    await expect(logout()).rejects.toThrow('network');
    expect(getCsrfToken()).toBe('active');
  });
  it('clears authentication after successful server logout', async () => {
    setCsrfToken('active'); mockRequest.mockResolvedValue({});
    await logout(); expect(getCsrfToken()).toBe('');
  });
});
