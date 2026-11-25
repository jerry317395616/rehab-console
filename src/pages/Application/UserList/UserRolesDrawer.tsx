import {
  DrawerForm,
  ProFormDependency,
  ProFormSelect,
} from '@ant-design/pro-components';
import { Alert, App, Button, Descriptions, Form, Grid, Tag } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from './creationErrors';
import { losesDeskAccess, selectedRoles } from './roleSelection';
import {
  getUserRoles,
  type RoleSelection,
  saveUserRoles,
  type UserRoleContext,
} from './service';

export default function UserRolesDrawer({
  user,
  onClose,
  onSaved,
}: {
  user?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<RoleSelection>();
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [data, setData] = useState<UserRoleContext>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    form.resetFields();
    if (!user) return;
    setLoading(true);
    getUserRoles(user)
      .then((result) => {
        if (!active) return;
        setData(result);
        form.setFieldsValue({
          mode: result.mode,
          roles: result.roles,
          role_profiles: result.role_profiles,
        });
      })
      .catch((reason) => {
        if (active)
          setError(creationError(reason, '暂时无法读取角色信息。').message);
        if (statusOf(reason) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, reload, form]);
  function close() {
    if (!savingRef.current) {
      form.resetFields();
      onClose();
    }
  }
  return (
    <DrawerForm<RoleSelection>
      key={screens.md ? 'desktop' : 'mobile'}
      name="user-roles"
      title={data?.can_edit ? '角色与权限' : '查看角色'}
      form={form}
      open={Boolean(user)}
      width={screens.md ? 600 : '100%'}
      preserve={false}
      loading={loading}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      drawerProps={{
        placement: 'right',
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      submitter={
        data?.can_edit
          ? {
              searchConfig: { submitText: '保存', resetText: '取消' },
              resetButtonProps: { disabled: saving },
            }
          : { render: () => <Button onClick={close}>关闭</Button> }
      }
      onValuesChange={(changed, values) => {
        setError(undefined);
        if (changed.mode === 'direct' && data)
          form.setFieldsValue({
            roles: selectedRoles({ ...values, mode: 'profiles' }, data),
            role_profiles: [],
          });
        if (changed.mode === 'profiles')
          form.setFieldsValue({ role_profiles: [] });
      }}
      onFinish={async (values) => {
        if (!data?.can_edit || !user || savingRef.current) return false;
        savingRef.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const loss = losesDeskAccess(values, data);
          if (
            loss &&
            !(await modal.confirm({
              title: '移除桌面访问权限',
              content: '保存后该用户将变为网站用户，无法登录工作台。是否继续？',
              okText: '确认保存',
              cancelText: '取消',
            }))
          )
            return false;
          const result = await saveUserRoles(
            user,
            data.user.modified,
            values,
            loss,
          );
          message.success(
            result.can_login_console
              ? '角色已更新，用户刷新页面后即可按新权限使用。'
              : '角色已更新，该用户当前无法登录工作台。',
          );
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(creationError(reason, '保存失败，请稍后重试。').message);
          if (statusOf(reason) === 401)
            window.dispatchEvent(new Event('rehab:session-expired'));
          return false;
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      }}
    >
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button
              size="small"
              disabled={saving}
              onClick={() => setReload((value) => value + 1)}
            >
              重新加载
            </Button>
          }
        />
      )}
      {data && (
        <>
          <Form.Item label="账号信息">
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: 'name',
                  label: '姓名',
                  children: data.user.full_name || data.user.name,
                },
                {
                  key: 'email',
                  label: '邮箱',
                  children: data.user.email || data.user.name,
                },
                {
                  key: 'enabled',
                  label: '账号状态',
                  children: data.user.enabled ? '启用' : '停用',
                },
                {
                  key: 'type',
                  label: '当前类型',
                  children:
                    data.user.user_type === 'System User'
                      ? '系统用户'
                      : data.user.user_type === 'Website User'
                        ? '网站用户'
                        : data.user.user_type,
                },
              ]}
            />
          </Form.Item>
          {!data.can_edit && (
            <Alert
              type="info"
              showIcon
              title={
                data.protected
                  ? '内置账号的角色在此仅供查看。'
                  : '当前账号只能查看此用户的角色。'
              }
            />
          )}
          {data.can_edit ? (
            <>
              <ProFormSelect
                name="mode"
                label="角色来源"
                allowClear={false}
                options={[
                  { value: 'direct', label: '直接分配角色' },
                  {
                    value: 'profiles',
                    label: '使用角色配置',
                    disabled: !data.can_use_profiles,
                  },
                ]}
              />
              <ProFormDependency name={['mode']}>
                {({ mode }) =>
                  mode === 'profiles' ? (
                    <ProFormSelect
                      name="role_profiles"
                      label="角色配置"
                      mode="multiple"
                      showSearch
                      rules={[{ required: true, message: '请选择角色配置' }]}
                      options={data.profile_options.map((profile) => ({
                        value: profile.name,
                        label: profile.name,
                        disabled: !profile.available,
                      }))}
                      fieldProps={{ optionFilterProp: 'label' }}
                      extra="角色由所选配置汇总，不能手工增减。"
                    />
                  ) : (
                    <ProFormSelect
                      name="roles"
                      label="直接分配角色"
                      mode="multiple"
                      showSearch
                      options={data.role_options.map((role) => ({
                        value: role.name,
                        label: role.label,
                      }))}
                      fieldProps={{ optionFilterProp: 'label' }}
                    />
                  )
                }
              </ProFormDependency>
              <ProFormDependency name={['mode', 'roles', 'role_profiles']}>
                {(values) => (
                  <Form.Item label="保存后生效的角色">
                    {selectedRoles(values as RoleSelection, data).length
                      ? selectedRoles(values as RoleSelection, data).map(
                          (role) => (
                            <Tag key={role}>
                              {data.role_options.find(
                                (option) => option.name === role,
                              )?.label || role}
                            </Tag>
                          ),
                        )
                      : '未选择角色'}
                    {losesDeskAccess(values as RoleSelection, data) && (
                      <Alert
                        type="warning"
                        showIcon
                        title="移除全部桌面角色后，该用户将无法登录工作台。"
                      />
                    )}
                  </Form.Item>
                )}
              </ProFormDependency>
            </>
          ) : (
            <>
              <Form.Item label="角色来源">
                {data.mode === 'profiles'
                  ? `角色配置：${data.role_profiles.join('、') || '由配置维护'}`
                  : '直接分配角色'}
              </Form.Item>
              <Form.Item label="已分配角色">
                {data.roles.map((role) => (
                  <Tag key={role}>{role}</Tag>
                ))}
              </Form.Item>
            </>
          )}
          <Form.Item label="自动角色">
            {data.automatic_roles.map((role) => (
              <Tag key={role}>{role}</Tag>
            ))}
          </Form.Item>
        </>
      )}
    </DrawerForm>
  );
}
