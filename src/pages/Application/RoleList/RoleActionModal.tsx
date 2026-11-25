import { Alert, App, Button, Form, Input, Modal, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';
import {
  deleteRole,
  getRoleContext,
  type RoleContext,
  renameRole,
} from './service';

export type RoleAction = { kind: 'rename' | 'delete'; role: string };

export default function RoleActionModal({
  action,
  onClose,
  onSaved,
}: {
  action?: RoleAction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<{ new_name: string; confirm_name: string }>();
  const { message } = App.useApp();
  const [data, setData] = useState<RoleContext>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    if (!action) return;
    setLoading(true);
    getRoleContext(action.role)
      .then((result) => {
        if (active) {
          setData(result);
          form.resetFields();
        }
      })
      .catch((reason) => {
        if (active)
          setError(creationError(reason, '暂时无法读取角色状态。').message);
        if (statusOf(reason) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [action, attempt, form]);
  const deleting = action?.kind === 'delete';
  const permitted = deleting
    ? data?.can_delete && !data.delete_blocked
    : data?.can_rename;
  const close = () => {
    if (!savingRef.current) onClose();
  };
  return (
    <Modal
      title={deleting ? '删除角色' : '重命名角色'}
      open={Boolean(action)}
      destroyOnHidden
      onCancel={close}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={deleting ? '删除角色' : '确认重命名'}
      cancelText="取消"
      okButtonProps={{ danger: deleting, disabled: loading || !permitted }}
      cancelButtonProps={{ disabled: saving }}
      closable={!saving}
      keyboard={!saving}
      mask={{ closable: !saving }}
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
              onClick={() => setAttempt((value) => value + 1)}
            >
              重新加载
            </Button>
          }
        />
      )}
      {data && !permitted && (
        <Alert
          type="warning"
          showIcon
          title={
            data.delete_blocked && deleting
              ? '该角色仍被用户、角色配置、权限规则或其他记录引用，请先解除关联。'
              : '当前账号不能对此角色执行该操作。'
          }
        />
      )}
      <Form
        form={form}
        name="role-action"
        layout="vertical"
        disabled={loading || saving || !permitted}
        onFinish={async (values) => {
          if (!action || !data || !permitted || savingRef.current) return;
          savingRef.current = true;
          setSaving(true);
          setError(undefined);
          try {
            if (action.kind === 'delete') {
              await deleteRole(
                action.role,
                data.role.modified,
                values.confirm_name,
              );
              message.success('角色已删除。');
            } else {
              const result = await renameRole(
                action.role,
                data.role.modified,
                values.new_name,
              );
              message.success(`角色已重命名为“${result.name}”。`);
            }
            onSaved();
            onClose();
          } catch (reason) {
            setError(creationError(reason, '操作失败，请稍后重试。').message);
            if (statusOf(reason) === 401)
              window.dispatchEvent(new Event('rehab:session-expired'));
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        }}
      >
        <Form.Item label="当前角色标识">
          <Typography.Text>{action?.role}</Typography.Text>
        </Form.Item>
        {deleting ? (
          <Form.Item
            name="confirm_name"
            label="输入完整角色标识以确认删除"
            rules={[
              {
                validator: (_, value) =>
                  value === action?.role
                    ? Promise.resolve()
                    : Promise.reject(new Error('角色标识不一致')),
              },
            ]}
          >
            <Input autoComplete="off" maxLength={140} />
          </Form.Item>
        ) : (
          <Form.Item
            name="new_name"
            label="新角色名称"
            extra="系统将同步用户、角色配置及权限规则中的关联。"
            rules={[
              { required: true, whitespace: true, message: '请输入新名称' },
              { max: 140, message: '角色名称不能超过 140 个字符' },
              {
                validator: (_, value) =>
                  value?.trim() !== action?.role
                    ? Promise.resolve()
                    : Promise.reject(new Error('新旧名称不能相同')),
              },
            ]}
          >
            <Input autoComplete="off" maxLength={140} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
