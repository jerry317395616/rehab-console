import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockHistory } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockHistory: {
    location: { pathname: '/console/session', search: '', hash: '' },
    replace: vi.fn(),
  },
}));
vi.mock('@umijs/max', () => ({ history: mockHistory, useModel: vi.fn() }));
vi.mock('@/services/rehab/auth', () => ({
  getSession: mockGetSession,
  statusOf: (error: any) => error.response?.status,
}));
vi.mock('@/components/RightContent/AvatarDropdown', () => ({
  AvatarDropdown: () => null,
}));
vi.mock('@/components/DesktopSearch', () => ({ default: () => null }));
vi.mock('./requestErrorConfig', () => ({ errorConfig: {} }));
vi.mock('../config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

import { getInitialState } from './app';

describe('console authentication bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHistory.location = {
      pathname: '/console/session',
      search: '',
      hash: '',
    };
  });
  it('restores a real session on refresh', async () => {
    const user = { userid: 'physician@test', roles: ['Rehab Physician'] };
    mockGetSession.mockResolvedValue(user);
    expect((await getInitialState()).currentUser).toEqual(user);
    expect(mockHistory.replace).not.toHaveBeenCalled();
  });
  it('returns to the requested console page after login', async () => {
    mockHistory.location.search = '?tab=roles';
    mockGetSession.mockRejectedValue({ response: { status: 401 } });
    expect((await getInitialState()).currentUser).toBeUndefined();
    expect(mockHistory.replace).toHaveBeenCalledWith(
      '/user/login?redirect=%2Fconsole%2Fsession%3Ftab%3Droles',
    );
  });
  it('probes the session on the login page to reuse an existing Desk login', async () => {
    mockHistory.location.pathname = '/console/user/login';
    mockGetSession.mockResolvedValue({ userid: 'physician@test' });
    await getInitialState();
    expect(mockHistory.replace).toHaveBeenCalledWith('/apps');
  });
  it('stays on login for a guest', async () => {
    mockHistory.location.pathname = '/console/user/login';
    mockGetSession.mockRejectedValue({ response: { status: 401 } });
    await getInitialState();
    expect(mockHistory.replace).not.toHaveBeenCalled();
  });
  it.each([403, 500])(
    'keeps HTTP %s separate from session expiry',
    async (status) => {
      mockGetSession.mockRejectedValue({ response: { status } });
      expect((await getInitialState()).authFailure?.status).toBe(
        String(status),
      );
      expect(mockHistory.replace).not.toHaveBeenCalled();
    },
  );
  it('shows retry for network failure without logging the user out', async () => {
    mockGetSession.mockRejectedValue(new Error('network'));
    expect((await getInitialState()).authFailure?.status).toBe('500');
    expect(mockHistory.replace).not.toHaveBeenCalled();
  });
});
