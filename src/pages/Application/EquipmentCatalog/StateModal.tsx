import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Form } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  api,
  type Context,
  type Device,
  errorMessage,
  mutate,
} from './service';

export default function StateModal({
  device,
  onClose,
  onSaved,
}: {
  device?: Device;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [context, setContext] = useState<Context>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    form.resetFields();
    setContext(undefined);
    setError(undefined);
    if (device)
      api<Context>('get_device', { name: device.name })
        .then((value) => {
          if (active) setContext(value);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        });
    return () => {
      active = false;
    };
  }, [device, form]);
  const activating = !context?.device.enabled;
  const canAct = Boolean(
    context?.can_change_state &&
      !context.edit_blocked &&
      (!activating || context.can_read_inspections),
  );
  return (
    <ModalForm
      form={form}
      title={activating ? '验收启用设备' : '停用设备'}
      open={Boolean(device)}
      width={580}
      loading={!context && !error}
      modalProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      onOpenChange={(open) => {
        if (!open && !working.current) onClose();
      }}
      submitter={{ submitButtonProps: { disabled: !canAct } }}
      onFinish={async (values) => {
        if (!context || !canAct || working.current) return false;
        working.current = true;
        setSaving(true);
        try {
          await mutate('change_state', {
            name: context.device.name,
            modified: context.device.modified,
            enabled: activating ? 1 : 0,
            ...values,
          });
          message.success(activating ? '设备已验收启用' : '设备已停用');
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(errorMessage(reason));
          return false;
        } finally {
          working.current = false;
          setSaving(false);
        }
      }}
    >
      <Alert
        type="warning"
        showIcon
        title={
          activating
            ? '启用前核对同一设备的真实合格巡检'
            : '停用影响后续设备使用'
        }
        description="已有未关闭任务、进行中的执行或采集时不能操作；设备故障、到期巡检、资产维修和保养限制继续生效。"
      />
      {error && <Alert type="error" title={error} showIcon />}
      {context && !canAct && (
        <Alert
          type="warning"
          title={
            context.edit_blocked
              ? '请先处理未关闭治疗任务'
              : '当前账号缺少设备启停或验收来源读取权限'
          }
          showIcon
        />
      )}
      {activating && context?.can_read_inspections && (
        <ProFormSelect
          name="inspection"
          label="合格巡检记录"
          rules={[{ required: true }]}
          request={() =>
            api('search_inspections', { name: context.device.name })
          }
        />
      )}
      <ProFormTextArea
        name="reason"
        label="操作原因"
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 1000 }}
      />
      <ProFormText
        name="confirm_code"
        label={`输入设备编号确认：${context?.device.display_label || ''}`}
        rules={[
          { required: true },
          {
            validator: (_, value) =>
              value === context?.device.display_label
                ? Promise.resolve()
                : Promise.reject(new Error('设备编号不一致')),
          },
        ]}
      />
    </ModalForm>
  );
}
