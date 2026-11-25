import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import { App } from 'antd';
import React, { useState } from 'react';
import { authErrorMessage, logout, statusOf } from '@/services/rehab/auth';
import { LOGIN_ROUTE } from '@/services/rehab/session';
import HeaderDropdown from '../HeaderDropdown';

export function AvatarDropdown({ children }: { children?: React.ReactNode }) {
  const { setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const exit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch (error) {
      if (statusOf(error) !== 401) {
        message.error(authErrorMessage(error));
        setBusy(false);
        return;
      }
    }
    await setInitialState((state) => ({
      ...state,
      currentUser: undefined,
      authFailure: undefined,
    }));
    history.replace(LOGIN_ROUTE);
    setBusy(false);
  };
  return (
    <HeaderDropdown
      placement="bottomRight"
      trigger={['hover', 'click']}
      menu={{
        items: [
          { key: 'account', icon: <UserOutlined />, label: '当前账号' },
          { type: 'divider' },
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: busy ? '正在退出…' : '退出登录',
            disabled: busy,
          },
        ],
        onClick: ({ key }) => {
          if (key === 'account') history.push('/session');
          if (key === 'logout') void exit();
        },
      }}
    >
      {children}
    </HeaderDropdown>
  );
}
