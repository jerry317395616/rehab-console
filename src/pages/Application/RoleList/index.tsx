import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { Button, Dropdown, Result, Tag, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import RolePermissions from '../RolePermissions';
import RoleActionModal, { type RoleAction } from './RoleActionModal';
import RoleDetailsDrawer from './RoleDetailsDrawer';
import RoleEditorDrawer, { type RoleEditor } from './RoleEditorDrawer';
import {
  getRoleOptions,
  getRoles,
  type ManagedRoleRow,
  type RoleOptions,
  type RoleSearch,
} from './service';

export default function RoleList() {
  const location = useLocation();
  const permissionRole = new URLSearchParams(location.search).get(
    'permission_role',
  );
  function showPermissions(name?: string) {
    const query = new URLSearchParams(location.search);
    if (name) query.set('permission_role', name);
    else query.delete('permission_role');
    history.push({
      pathname: location.pathname,
      search: query.toString() ? `?${query}` : '',
    });
  }
  const [failure, setFailure] = useState<'403' | '500'>();
  const [role, setRole] = useState<string>();
  const [editor, setEditor] = useState<RoleEditor>();
  const [action, setAction] = useState<RoleAction>();
  const [options, setOptions] = useState<RoleOptions>();
  const actionRef = useRef<ActionType>(undefined);
  const refreshOptions = useCallback(() => {
    getRoleOptions()
      .then(setOptions)
      .catch(() => setOptions(undefined));
  }, []);
  useEffect(refreshOptions, [refreshOptions]);
  function saved() {
    void actionRef.current?.reload();
    refreshOptions();
  }
  const columns: ProColumns<ManagedRoleRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: '角色名称或原始标识',
        maxLength: 120,
        allowClear: true,
      },
    },
    {
      title: '角色名称',
      dataIndex: 'role_name',
      search: false,
      sorter: true,
      defaultSortOrder: 'ascend',
      width: 240,
      render: (_, row) => (
        <div>
          <div>{row.label}</div>
          {row.label !== row.name && (
            <Typography.Text type="secondary">{row.name}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      valueType: 'select',
      width: 100,
      valueEnum: {
        0: { text: '启用', status: 'Success' },
        1: { text: '停用', status: 'Default' },
      },
    },
    {
      title: '桌面访问',
      dataIndex: 'desk_access',
      valueType: 'select',
      width: 110,
      valueEnum: { 1: { text: '允许' }, 0: { text: '不允许' } },
    },
    {
      title: '保护规则',
      dataIndex: 'is_reserved',
      search: false,
      width: 110,
      render: (_, row) => (row.is_reserved ? <Tag>系统保留</Tag> : '普通角色'),
    },
    {
      title: '更新时间',
      dataIndex: 'modified',
      valueType: 'dateTime',
      search: false,
      sorter: true,
      width: 180,
    },
    {
      title: '操作',
      key: 'role_actions',
      valueType: 'option',
      width: 300,
      fixed: 'right',
      render: (_, row) => {
        const items = [
          ...(row.can_rename ? [{ key: 'rename', label: '重命名' }] : []),
          ...(row.can_delete
            ? [{ key: 'delete', label: '删除', danger: true }]
            : []),
        ];
        return [
          <Button key="view" type="link" onClick={() => setRole(row.name)}>
            查看
          </Button>,
          row.can_edit ? (
            <Button
              key="edit"
              type="link"
              onClick={() => setEditor({ kind: 'edit', role: row.name })}
            >
              编辑
            </Button>
          ) : null,
          options?.can_configure_permissions ? (
            <Button
              key="permissions"
              type="link"
              onClick={() => showPermissions(row.name)}
            >
              业务权限
            </Button>
          ) : null,
          items.length ? (
            <Dropdown
              key="more"
              menu={{
                items,
                onClick: ({ key }) =>
                  setAction({
                    kind: key as 'rename' | 'delete',
                    role: row.name,
                  }),
              }}
              trigger={['click']}
            >
              <Button type="link">更多</Button>
            </Dropdown>
          ) : null,
        ];
      },
    },
  ];
  if (permissionRole)
    return (
      <RolePermissions
        key={permissionRole}
        role={permissionRole}
        onClose={() => showPermissions()}
      />
    );
  if (failure)
    return (
      <Result
        status={failure}
        title={
          failure === '403'
            ? '当前账号没有读取角色列表的权限'
            : '暂时无法读取角色列表'
        }
        extra={<Button onClick={() => setFailure(undefined)}>重新加载</Button>}
      />
    );
  return (
    <>
      <ProTable<ManagedRoleRow, RoleSearch>
        actionRef={actionRef}
        rowKey="name"
        columns={columns}
        request={getRoles}
        headerTitle="角色列表"
        toolBarRender={() =>
          options?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({ kind: 'create' })}
                >
                  新增角色
                </Button>,
              ]
            : []
        }
        form={{ name: 'role-list-search' }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{
          defaultPageSize: 20,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
        }}
        scroll={{ x: 950 }}
        dateFormatter="string"
        onRequestError={(error) => {
          const status = statusOf(error);
          setFailure(status === 401 || status === 403 ? '403' : '500');
          if (status === 401)
            window.dispatchEvent(new Event('rehab:session-expired'));
        }}
      />
      <RoleDetailsDrawer role={role} onClose={() => setRole(undefined)} />
      <RoleEditorDrawer
        editor={editor}
        onClose={() => setEditor(undefined)}
        onSaved={saved}
      />
      <RoleActionModal
        action={action}
        onClose={() => setAction(undefined)}
        onSaved={saved}
      />
    </>
  );
}
