import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, useModel } from '@umijs/max';
import { Button, Result } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useEffect } from 'react';
import DesktopSearch from '@/components/DesktopSearch';
import { AvatarDropdown } from '@/components/RightContent/AvatarDropdown';
import { getSession, type RehabUser, statusOf } from '@/services/rehab/auth';
import {
  LOGIN_ROUTE,
  localRoute,
  loginRoute,
  safeReturnPath,
  setCsrfToken,
} from '@/services/rehab/session';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

dayjs.extend(relativeTime);

export type AuthFailure = { status: '403' | '500'; message: string };

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: RehabUser;
  authFailure?: AuthFailure;
  fetchUserInfo?: () => Promise<RehabUser>;
}> {
  const settings = defaultSettings as Partial<LayoutSettings>;
  const fetchUserInfo = getSession;
  const { pathname, search, hash } = history.location;
  try {
    const currentUser = await fetchUserInfo();
    if (localRoute(pathname) === LOGIN_ROUTE) {
      history.replace(
        localRoute(safeReturnPath(new URLSearchParams(search).get('redirect'))),
      );
    }
    return { settings, currentUser, fetchUserInfo };
  } catch (error) {
    if (statusOf(error) === 401) {
      setCsrfToken('');
      if (localRoute(pathname) !== LOGIN_ROUTE)
        history.replace(loginRoute(pathname + search + hash));
      return { settings, fetchUserInfo };
    }
    const forbidden = statusOf(error) === 403;
    return {
      settings,
      fetchUserInfo,
      authFailure: {
        status: forbidden ? '403' : '500',
        message: forbidden
          ? '当前账号无法访问应用桌面，请联系管理员。'
          : '暂时无法连接服务器，请检查网络后重试。',
      },
    };
  }
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => ({
  ...initialState?.settings,
  title: '工作台',
  layout: 'top',
  menuRender: false,
  onMenuHeaderClick: () => history.push('/apps'),
  headerContentRender: () => <DesktopSearch />,
  avatarProps: {
    src: initialState?.currentUser?.avatar,
    title: initialState?.currentUser?.name,
    render: (_, children) => <AvatarDropdown>{children}</AvatarDropdown>,
  },
  onPageChange: () => {
    const { pathname, search, hash } = history.location;
    if (
      !initialState?.currentUser &&
      !initialState?.authFailure &&
      localRoute(pathname) !== LOGIN_ROUTE
    ) {
      history.replace(loginRoute(pathname + search + hash));
    }
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { initialState, setInitialState } = useModel('@@initialState');
  useEffect(() => {
    const expired = () => {
      setCsrfToken('');
      setInitialState((state) => ({
        ...state,
        currentUser: undefined,
        authFailure: undefined,
      }));
      const { pathname, search, hash } = history.location;
      if (localRoute(pathname) !== LOGIN_ROUTE)
        history.replace(loginRoute(pathname + search + hash));
    };
    window.addEventListener('rehab:session-expired', expired);
    return () => window.removeEventListener('rehab:session-expired', expired);
  }, [setInitialState]);
  if (initialState?.authFailure) {
    return (
      <Result
        status={initialState.authFailure.status}
        title={initialState.authFailure.message}
        extra={[
          <Button
            key="retry"
            type="primary"
            onClick={() => window.location.reload()}
          >
            重试
          </Button>,
        ]}
      />
    );
  }
  return children;
}

export const request: RequestConfig = {
  baseURL: '',
  withCredentials: true,
  timeout: 20000,
  ...errorConfig,
};
// The model providers wrap innerProvider, so the gate can read initialState.
export function innerProvider(container: React.ReactNode) {
  return <AuthGate>{container}</AuthGate>;
}
