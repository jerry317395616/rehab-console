import { PlusOutlined } from '@ant-design/icons';
import {
  DrawerForm,
  ProFormDependency,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Grid } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from './creationErrors';
import {
  type CreateUserValues,
  type CreationOptions,
  createUser,
  getCreationOptions,
} from './service';

export default function CreateUserDrawer({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [form] = Form.useForm<CreateUserValues>();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<CreationOptions>();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    getCreationOptions()
      .then((data) => {
        if (active) setOptions(data);
      })
      .catch((reason) => {
        if (active) setLoadFailed(true);
        if (statusOf(reason) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function openForm() {
    setLoading(true);
    try {
      const data = await getCreationOptions();
      setOptions(data);
      setLoadFailed(false);
      if (!data.can_create) {
        message.warning('当前账号没有添加用户的权限。');
        return;
      }
      form.resetFields();
      setError(undefined);
      setOpen(true);
    } catch (reason) {
      setLoadFailed(true);
      message.error(creationError(reason).message);
      if (statusOf(reason) === 401)
        window.dispatchEvent(new Event('rehab:session-expired'));
    } finally {
      setLoading(false);
    }
  }

  if (!loading && !loadFailed && !options?.can_create) return null;
  return (
    <>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        loading={loading}
        onClick={openForm}
      >
        {loadFailed ? '重试加载添加权限' : '添加用户'}
      </Button>
      <DrawerForm<CreateUserValues>
        key={screens.md ? 'desktop' : 'mobile'}
        name="create-user"
        title="添加用户"
        width={screens.md ? 560 : '100%'}
        form={form}
        open={open}
        preserve={false}
        autoFocusFirstInput
        initialValues={{
          enabled: true,
          credential_mode: 'password',
          roles: [],
        }}
        onOpenChange={(value) => {
          if (!value && savingRef.current) return;
          setOpen(value);
          if (!value) {
            form.resetFields();
            setError(undefined);
          }
        }}
        drawerProps={{
          placement: 'right',
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
        }}
        submitter={{
          searchConfig: { submitText: '保存', resetText: '取消' },
          resetButtonProps: { disabled: saving },
        }}
        onValuesChange={(changed) => {
          setError(undefined);
          if ('credential_mode' in changed)
            form.setFieldsValue({
              password: undefined,
              password_confirm: undefined,
            });
        }}
        onFinish={async (values) => {
          if (savingRef.current) return false;
          savingRef.current = true;
          setSaving(true);
          setError(undefined);
          try {
            const result = await createUser(values);
            message.success(
              result.can_login_console
                ? '用户已创建，可按分配的权限登录工作台。'
                : result.enabled
                  ? '用户已创建，配置桌面角色后可登录工作台。'
                  : '用户已创建，当前处于停用状态。',
            );
            onCreated();
            return true;
          } catch (reason) {
            const failure = creationError(reason);
            form.setFields(failure.fieldErrors);
            setError(failure.message);
            if (statusOf(reason) === 401)
              window.dispatchEvent(new Event('rehab:session-expired'));
            return false;
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        }}
      >
        {error && <Alert type="error" title={error} showIcon />}
        <ProFormText
          name="email"
          label="邮箱"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
          fieldProps={{ autoComplete: 'off', maxLength: 140 }}
        />
        <ProFormText
          name="first_name"
          label="姓名"
          rules={[{ required: true, whitespace: true, message: '请输入姓名' }]}
          fieldProps={{ autoComplete: 'off', maxLength: 140 }}
        />
        <ProFormText
          name="last_name"
          label="姓氏（可选）"
          fieldProps={{ autoComplete: 'off', maxLength: 140 }}
        />
        <ProFormText
          name="username"
          label="用户名"
          extra="留空时由系统自动生成。"
          fieldProps={{ autoComplete: 'off', maxLength: 140 }}
        />
        <ProFormSwitch name="enabled" label="启用账号" />
        {options?.can_assign_roles ? (
          <ProFormSelect
            name="roles"
            label="角色"
            mode="multiple"
            showSearch
            options={options.roles.map((role) => ({
              value: role.name,
              label: role.label,
            }))}
            fieldProps={{ optionFilterProp: 'label' }}
            placeholder="选择该用户需要的角色"
          />
        ) : (
          <Alert
            type="info"
            showIcon
            title="角色需由有权限的管理员配置"
            description="当前账号可以添加基础用户。未分配桌面角色的新用户无法登录工作台。"
          />
        )}
        {options?.can_assign_roles && (
          <ProFormDependency name={['roles', 'enabled']}>
            {({ roles, enabled }) => (
              <Alert
                type="info"
                showIcon
                title={
                  !enabled
                    ? '停用账号暂时无法登录。'
                    : options.roles.some(
                          (role) =>
                            roles?.includes(role.name) && role.desk_access,
                        )
                      ? '系统用户：登录后按角色权限显示应用。'
                      : '网站用户：分配桌面角色后可登录工作台。'
                }
              />
            )}
          </ProFormDependency>
        )}
        <ProFormSelect
          name="credential_mode"
          label="登录方式"
          allowClear={false}
          options={[
            { value: 'password', label: '设置初始密码' },
            {
              value: 'invitation',
              label: '发送邀请邮件',
              disabled: !options?.email_invitation_available,
            },
          ]}
          extra={
            !options?.email_invitation_available
              ? '当前无法发送邀请邮件，请设置初始密码。'
              : undefined
          }
        />
        <ProFormDependency name={['credential_mode']}>
          {({ credential_mode }) =>
            credential_mode === 'password' && (
              <>
                <ProFormText.Password
                  name="password"
                  label="初始密码"
                  rules={[{ required: true, message: '请输入初始密码' }]}
                  fieldProps={{ autoComplete: 'new-password', maxLength: 512 }}
                />
                <ProFormText.Password
                  name="password_confirm"
                  label="确认密码"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: '请再次输入初始密码' },
                    ({ getFieldValue }) => ({
                      validator: (_, value) =>
                        !value || getFieldValue('password') === value
                          ? Promise.resolve()
                          : Promise.reject(new Error('两次输入的密码不一致')),
                    }),
                  ]}
                  fieldProps={{ autoComplete: 'new-password', maxLength: 512 }}
                />
              </>
            )
          }
        </ProFormDependency>
      </DrawerForm>
    </>
  );
}
