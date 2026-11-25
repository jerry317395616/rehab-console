import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, App, Button, Collapse, Form, Grid } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';
import {
  createRole,
  getRoleContext,
  getRoleOptions,
  previewRoleChange,
  type RoleContext,
  type RoleField,
  type RoleOptions,
  type RoleValues,
  roleValues,
  saveRole,
} from './service';

export type RoleEditor = { kind: 'create' } | { kind: 'edit'; role: string };

export default function RoleEditorDrawer({
  editor,
  onClose,
  onSaved,
}: {
  editor?: RoleEditor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<RoleValues>();
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<RoleOptions>();
  const [context, setContext] = useState<RoleContext>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setOptions(undefined);
    setContext(undefined);
    setError(undefined);
    if (!editor) return;
    setLoading(true);
    const request =
      editor.kind === 'create' ? getRoleOptions() : getRoleContext(editor.role);
    request
      .then((result) => {
        if (!active) return;
        form.resetFields();
        if ('role' in result) {
          setContext(result);
          form.setFieldsValue({
            role_name: result.role.name,
            disabled: result.role.disabled,
            desk_access: Boolean(result.role.desk_access),
            home_page: result.role.home_page || '',
            restrict_to_domain: result.role.restrict_to_domain || undefined,
            two_factor_auth: Boolean(result.role.two_factor_auth),
          });
        } else {
          setOptions(result);
          form.setFieldsValue({
            role_name: '',
            disabled: 0,
            desk_access: true,
            two_factor_auth: false,
          });
        }
      })
      .catch((reason) => {
        if (active)
          setError(creationError(reason, '暂时无法读取角色管理信息。').message);
        if (statusOf(reason) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editor, attempt, form]);
  const fields = options?.create_fields || context?.write_fields || [];
  const canSave = Boolean(options?.can_create || context?.can_edit);
  const allowed = (field: RoleField) => canSave && fields.includes(field);
  const domainOptions = [
    ...new Set([
      ...(options?.domains || context?.domains || []),
      ...(context?.role.restrict_to_domain
        ? [context.role.restrict_to_domain]
        : []),
    ]),
  ];
  function close() {
    if (!savingRef.current) onClose();
  }
  return (
    <DrawerForm<RoleValues>
      key={screens.md ? 'desktop' : 'mobile'}
      name="role-editor"
      title={editor?.kind === 'create' ? '新增角色' : '编辑角色'}
      open={Boolean(editor)}
      form={form}
      width={screens.md ? 600 : '100%'}
      loading={loading}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      drawerProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      submitter={
        canSave
          ? {
              searchConfig: { submitText: '保存', resetText: '取消' },
              resetButtonProps: { disabled: saving },
            }
          : { render: () => <Button onClick={close}>关闭</Button> }
      }
      onValuesChange={() => setError(undefined)}
      onFinish={async (values) => {
        if (!editor || !canSave || savingRef.current) return false;
        savingRef.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const changes = roleValues(values, fields, editor.kind === 'create');
          if (editor.kind === 'create') await createRole(changes);
          else if (context) {
            const change = {
              role: editor.role,
              modified: context.role.modified,
              values: changes,
            };
            const preview = await previewRoleChange(change);
            if (
              preview.reasons.length &&
              !(await modal.confirm({
                title: '确认角色修改影响',
                content: (
                  <div>
                    {preview.reasons.map((reason) => (
                      <p key={reason}>{reason}</p>
                    ))}
                    <p>
                      可见用户：{preview.visible_users || 0}；可见角色配置：
                      {preview.visible_profiles || 0}。
                    </p>
                    {preview.restricted && <p>另有当前账号无法查看的关联。</p>}
                    {preview.other_associations && (
                      <p>还涉及报表、页面或其他记录中的角色关联。</p>
                    )}
                  </div>
                ),
                okText: '确认保存',
                cancelText: '取消',
              }))
            )
              return false;
            await saveRole(change, preview.token);
          } else return false;
          message.success(
            editor.kind === 'create'
              ? '角色已创建，可另行配置业务权限。'
              : '角色已更新。',
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
      <Form.Item key="feedback" hidden={!error}>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={
              <Button
                size="small"
                disabled={saving}
                onClick={() => setAttempt((value) => value + 1)}
              >
                重新加载
              </Button>
            }
          />
        )}
      </Form.Item>
      {(options || context) && (
        <React.Fragment key="role-fields">
          {!canSave && (
            <Alert type="info" showIcon title="当前账号不能编辑此角色。" />
          )}
          {context?.self_protected && (
            <Alert
              type="info"
              showIcon
              title="当前账号正在使用此角色，停用、取消桌面访问、改变限制领域和重命名受保护。"
            />
          )}
          <ProFormText
            name="role_name"
            label="角色名称"
            disabled={editor?.kind !== 'create' || !allowed('role_name')}
            rules={[
              { required: true, whitespace: true, message: '请输入角色名称' },
              { max: 140, message: '角色名称不能超过 140 个字符' },
            ]}
            fieldProps={{ maxLength: 140, autoComplete: 'off' }}
            extra={
              editor?.kind === 'edit'
                ? '修改名称请使用列表中的“重命名”操作。'
                : '新角色初始为空权限，业务授权另行设置。'
            }
          />
          <ProFormSelect
            name="disabled"
            label="角色状态"
            allowClear={false}
            disabled={
              !allowed('disabled') ||
              Boolean(context?.self_protected && !context.role.disabled)
            }
            options={[
              { value: 0, label: '启用' },
              { value: 1, label: '停用' },
            ]}
          />
          <ProFormSwitch
            name="desk_access"
            label="允许桌面访问"
            disabled={
              !allowed('desk_access') ||
              Boolean(context?.self_protected && context.role.desk_access)
            }
            extra="具体应用和菜单仍按业务权限显示。"
          />
          <Collapse
            items={[
              {
                key: 'advanced',
                label: '高级设置',
                children: (
                  <>
                    <ProFormText
                      name="home_page"
                      label="默认首页"
                      disabled={!allowed('home_page')}
                      fieldProps={{
                        maxLength: 140,
                        placeholder: '例如 /console，留空使用站点默认设置',
                      }}
                    />
                    <ProFormSelect
                      name="restrict_to_domain"
                      label="限制领域"
                      disabled={
                        !allowed('restrict_to_domain') ||
                        context?.self_protected ||
                        !domainOptions.length
                      }
                      options={domainOptions.map((name) => ({
                        label: name,
                        value: name,
                      }))}
                      placeholder="未限制"
                    />
                    <ProFormSwitch
                      name="two_factor_auth"
                      label="要求两步验证"
                      disabled={!allowed('two_factor_auth')}
                      extra="最终按站点两步验证设置生效。"
                    />
                  </>
                ),
              },
            ]}
          />
        </React.Fragment>
      )}
    </DrawerForm>
  );
}
