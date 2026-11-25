import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Result } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import CreateUserDrawer from './CreateUserDrawer';
import {
  getRoleAccess,
  getUsers,
  type RoleAccess,
  type UserRow,
  type UserSearch,
} from './service';
import UserRolesDrawer from './UserRolesDrawer';

const columns: ProColumns<UserRow>[] = [
  {
    title: '关键词',
    dataIndex: 'keyword',
    hideInTable: true,
    fieldProps: {
      placeholder: '姓名、用户名或邮箱',
      maxLength: 120,
      allowClear: true,
    },
  },
  {
    title: '姓名',
    dataIndex: 'full_name',
    search: false,
    sorter: true,
    ellipsis: true,
    width: 160,
  },
  {
    title: '用户名',
    dataIndex: 'username',
    search: false,
    sorter: true,
    ellipsis: true,
    width: 160,
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    search: false,
    sorter: true,
    ellipsis: true,
    copyable: true,
    width: 240,
  },
  {
    title: '状态',
    dataIndex: 'enabled',
    valueType: 'select',
    width: 100,
    valueEnum: {
      1: { text: '启用', status: 'Success' },
      0: { text: '停用', status: 'Default' },
    },
  },
  {
    title: '用户类型',
    dataIndex: 'user_type',
    valueType: 'select',
    width: 130,
    valueEnum: {
      'System User': { text: '系统用户' },
      'Website User': { text: '网站用户' },
    },
  },
  {
    title: '更新时间',
    dataIndex: 'modified',
    valueType: 'dateTime',
    search: false,
    sorter: true,
    defaultSortOrder: 'descend',
    width: 180,
  },
];

export default function UserList() {
  const actionRef = useRef<ActionType>(undefined);
  const [failure, setFailure] = useState<'403' | '500'>();
  const [roleAccess, setRoleAccess] = useState<RoleAccess>();
  const [roleUser, setRoleUser] = useState<string>();
  const refreshRoleAccess = useCallback(() => {
    getRoleAccess()
      .then(setRoleAccess)
      .catch(() => setRoleAccess(undefined));
  }, []);
  useEffect(refreshRoleAccess, [refreshRoleAccess]);
  if (failure) {
    return (
      <Result
        status={failure}
        title={
          failure === '403'
            ? '当前账号没有读取用户列表的权限'
            : '暂时无法读取用户列表'
        }
        extra={<Button onClick={() => setFailure(undefined)}>重新加载</Button>}
      />
    );
  }
  return (
    <>
      <ProTable<UserRow, UserSearch>
        actionRef={actionRef}
        toolBarRender={() => [
          <CreateUserDrawer
            key="create-user"
            onCreated={() => {
              void actionRef.current?.reload();
            }}
          />,
        ]}
        rowKey="name"
        columns={
          roleAccess?.can_view
            ? [
                ...columns,
                {
                  title: '操作',
                  key: 'role_actions',
                  valueType: 'option',
                  width: 140,
                  fixed: 'right',
                  render: (_, row) =>
                    !roleAccess.is_administrator &&
                    ['Administrator', 'Guest'].includes(row.name) ? null : (
                      <Button type="link" onClick={() => setRoleUser(row.name)}>
                        {roleAccess.can_edit &&
                        !['Administrator', 'Guest'].includes(row.name)
                          ? '角色与权限'
                          : '查看角色'}
                      </Button>
                    ),
                },
              ]
            : columns
        }
        request={getUsers}
        headerTitle="用户列表"
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{
          defaultPageSize: 20,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
        }}
        scroll={{ x: roleAccess?.can_view ? 1110 : 970 }}
        dateFormatter="string"
        onRequestError={(error) => {
          const status = statusOf(error);
          setFailure(status === 401 || status === 403 ? '403' : '500');
          if (status === 401)
            window.dispatchEvent(new Event('rehab:session-expired'));
        }}
      />
      <UserRolesDrawer
        user={roleUser}
        onClose={() => setRoleUser(undefined)}
        onSaved={() => {
          void actionRef.current?.reload();
          refreshRoleAccess();
        }}
      />
    </>
  );
}
