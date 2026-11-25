import { Alert, Button, Descriptions, Drawer, Grid, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { getRole, type RoleDetail } from './service';

export default function RoleDetailsDrawer({
  role,
  onClose,
}: {
  role?: string;
  onClose: () => void;
}) {
  const screens = Grid.useBreakpoint();
  const [data, setData] = useState<RoleDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    setLoading(Boolean(role));
    if (!role) return;
    getRole(role)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        const status = statusOf(reason);
        if (active)
          setError(
            status === 403
              ? '当前账号没有查看此角色的权限。'
              : status === 404
                ? '该角色已不存在，请刷新列表。'
                : status === 401
                  ? '登录状态已失效，请重新登录。'
                  : '暂时无法读取角色详情，请重试。',
          );
        if (status === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role, attempt]);
  return (
    <Drawer
      title="角色详情"
      open={Boolean(role)}
      size={screens.md ? 600 : '100%'}
      loading={loading}
      destroyOnHidden
      onClose={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button
              size="small"
              onClick={() => setAttempt((value) => value + 1)}
            >
              重新加载
            </Button>
          }
        />
      )}
      {data && (
        <Descriptions
          column={1}
          size="small"
          title={data.label}
          items={[
            { key: 'name', label: '角色标识', children: data.name },
            {
              key: 'disabled',
              label: '状态',
              children: (
                <Tag color={data.disabled ? undefined : 'success'}>
                  {data.disabled ? '停用' : '启用'}
                </Tag>
              ),
            },
            {
              key: 'desk_access',
              label: '桌面访问',
              children: data.desk_access ? '允许' : '不允许',
            },
            {
              key: 'reserved',
              label: '保护规则',
              children: data.is_reserved ? '系统保留' : '普通角色',
            },
            {
              key: 'domain',
              label: '限制领域',
              children:
                data.restrict_to_domain === undefined
                  ? '无权限查看'
                  : data.restrict_to_domain || '未限制',
            },
            {
              key: 'home_page',
              label: '默认首页',
              children:
                data.home_page === undefined
                  ? '无权限查看'
                  : data.home_page || '未设置',
            },
            {
              key: 'two_factor_auth',
              label: '两步验证要求',
              children:
                data.two_factor_auth === undefined
                  ? '无权限查看'
                  : data.two_factor_auth
                    ? '要求'
                    : '不要求',
            },
            { key: 'modified', label: '更新时间', children: data.modified },
          ]}
        />
      )}
    </Drawer>
  );
}
