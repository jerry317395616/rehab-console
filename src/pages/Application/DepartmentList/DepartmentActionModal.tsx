import { Alert, App, Button, Form, Input, Modal, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';
import {
  type DepartmentContext,
  deleteDepartment,
  getDepartment,
  renameDepartment,
} from './service';

export type DepartmentAction = {
  kind: 'rename' | 'delete';
  department: string;
};
export default function DepartmentActionModal({
  action,
  onClose,
  onSaved,
}: {
  action?: DepartmentAction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<{ new_name: string; confirm_name: string }>();
  const { message } = App.useApp();
  const [context, setContext] = useState<DepartmentContext>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const working = useRef(false);
  useEffect(() => {
    let active = true;
    setContext(undefined);
    setError(undefined);
    form.resetFields();
    if (!action) return;
    setLoading(true);
    getDepartment(action.department)
      .then((value) => {
        if (active) setContext(value);
      })
      .catch((reason) => {
        if (active)
          setError(creationError(reason, '无法读取部门状态。').message);
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
    ? context?.can_delete && !context.delete_blocked
    : context?.can_rename;
  return (
    <Modal
      title={deleting ? '删除部门' : '重命名部门'}
      open={Boolean(action)}
      destroyOnHidden
      onCancel={() => {
        if (!working.current) onClose();
      }}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={deleting ? '删除部门' : '确认重命名'}
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
      {context && !permitted && (
        <Alert
          type="warning"
          showIcon
          title={
            deleting && context.delete_blocked
              ? '部门存在下级或仍被其他记录引用，请先处理关联。'
              : '当前账号不能对此部门执行该操作。'
          }
        />
      )}
      <Form
        form={form}
        name="department-action"
        layout="vertical"
        disabled={loading || saving || !permitted}
        onFinish={async (values) => {
          if (!action || !context || !permitted || working.current) return;
          working.current = true;
          setSaving(true);
          setError(undefined);
          try {
            if (deleting) {
              await deleteDepartment(
                action.department,
                context.department.modified,
                values.confirm_name,
              );
              void message.success('部门已删除。');
            } else {
              const result = await renameDepartment(
                action.department,
                context.department.modified,
                values.new_name.trim(),
                values.confirm_name,
              );
              void message.success(`部门已重命名为“${result.name}”。`);
            }
            onSaved();
            onClose();
          } catch (reason) {
            setError(creationError(reason, '操作失败，请重试。').message);
            if (statusOf(reason) === 401)
              window.dispatchEvent(new Event('rehab:session-expired'));
          } finally {
            working.current = false;
            setSaving(false);
          }
        }}
      >
        <Form.Item label="当前部门编号">
          <Typography.Text>{action?.department}</Typography.Text>
        </Form.Item>
        {!deleting && (
          <Form.Item
            name="new_name"
            label="新部门名称"
            extra="系统按公司简称生成编号，并同步原生关联记录。"
            rules={[
              { required: true, whitespace: true, message: '请输入新名称' },
              {
                validator: (_, value) =>
                  value?.trim() !== context?.department.department_name
                    ? Promise.resolve()
                    : Promise.reject(new Error('新旧名称不能相同')),
              },
            ]}
          >
            <Input autoComplete="off" maxLength={140} />
          </Form.Item>
        )}
        <Form.Item
          name="confirm_name"
          label={`输入完整部门编号以确认${deleting ? '删除' : '重命名'}`}
          rules={[
            {
              validator: (_, value) =>
                value === action?.department
                  ? Promise.resolve()
                  : Promise.reject(new Error('部门编号不一致')),
            },
          ]}
        >
          <Input autoComplete="off" maxLength={140} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
