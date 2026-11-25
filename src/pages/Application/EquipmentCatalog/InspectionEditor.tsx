import {
  DrawerForm,
  ProDescriptions,
  ProFormDateTimePicker,
  ProFormRadio,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  errorMessage,
  inspectionApi,
  inspectionSave,
  type PlanContext,
} from './inspectionService';

export default function InspectionEditor({
  name,
  onClose,
  onSaved,
}: {
  name?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const values = Form.useWatch('answers', form);
  const [context, setContext] = useState<PlanContext>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const working = useRef(false);
  const dirty = useRef(false);
  const requestId = useRef('');
  const submitted = useRef<Record<string, unknown> | undefined>(undefined);
  const { message, modal } = App.useApp();
  useEffect(() => {
    let active = true;
    form.resetFields();
    setContext(undefined);
    setError(undefined);
    dirty.current = false;
    submitted.current = undefined;
    setUncertain(false);
    requestId.current = crypto.randomUUID();
    if (name)
      inspectionApi<PlanContext>('get_plan', { name })
        .then((value) => {
          if (active) setContext(value);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        });
    return () => {
      active = false;
    };
  }, [name, form, attempt]);
  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的巡检内容？',
        okText: '放弃',
        cancelText: '继续录入',
        onOk: onClose,
      });
    else onClose();
  }
  return (
    <DrawerForm
      name="equipment-inspect"
      form={form}
      title="执行设备巡检"
      open={Boolean(name)}
      width="min(900px, 100vw)"
      loading={!context && !error}
      drawerProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onValuesChange={() => {
        dirty.current = true;
        setError(undefined);
      }}
      submitter={{
        searchConfig: { submitText: '保存巡检记录' },
        submitButtonProps: { disabled: !context?.can_inspect },
        render: (_, buttons) => [
          <Button key="cancel" onClick={close} disabled={saving}>
            取消
          </Button>,
          buttons[1],
        ],
      }}
      onFinish={async (input) => {
        if (!context?.can_inspect || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const data = {
            plan: name,
            modified: context.plan.modified,
            answers: input.answers,
            notes: input.notes || '',
            performed_at: input.performed_at || null,
            request_id: requestId.current,
          };
          if (
            submitted.current &&
            JSON.stringify(data) !== JSON.stringify(submitted.current)
          )
            throw new Error(
              '上次保存结果尚未核实，请先按原内容重试，避免生成重复记录。',
            );
          submitted.current = data;
          const result = await inspectionSave<{
            name: string;
            result: string;
            hold_created: boolean;
          }>('inspect', data);
          if (result.result === 'Failed')
            message.warning('巡检不合格，已生成异常停用记录，请整改后复检');
          else
            message.success('合格巡检已保存；设备启用和异常解除仍需分别办理');
          dirty.current = false;
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          const response = (reason as { response?: { status?: number } })
            ?.response;
          if (response?.status && response.status < 500) {
            submitted.current = undefined;
            setUncertain(false);
          } else setUncertain(true);
          setError(
            reason instanceof Error && !response
              ? reason.message
              : errorMessage(reason),
          );
          return false;
        } finally {
          working.current = false;
          setSaving(false);
        }
      }}
    >
      {uncertain && (
        <Alert
          type="warning"
          title="保存结果尚未核实，请保持原内容重试"
          description="系统会使用同一请求编号核对已保存结果，避免重复生成巡检记录。"
          showIcon
        />
      )}
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          action={
            !context ? (
              <Button onClick={() => setAttempt((value) => value + 1)}>
                重新加载
              </Button>
            ) : undefined
          }
        />
      )}
      {context && (
        <>
          <ProDescriptions
            column={1}
            dataSource={context.plan}
            columns={[
              { title: '计划', dataIndex: 'plan_title' },
              { title: '设备', dataIndex: 'resource' },
              { title: '责任人', dataIndex: 'assigned_to' },
              { title: '巡检依据', dataIndex: 'reference' },
            ]}
          />
          {!context.can_inspect && (
            <Alert
              type="warning"
              title="该计划已停用，或当前账号不是责任人且没有管理权限。"
              showIcon
            />
          )}
          <Alert
            type="info"
            title="逐项检查后填写，最终结论由系统计算"
            description="不合格或不适用必须填写说明，不能全部选择不适用。保存后记录归档，后续复检生成新记录。"
            showIcon
          />
          <ProFormDateTimePicker
            disabled={saving || uncertain}
            name="performed_at"
            label={`实际巡检时间（${context.timezone}，留空使用保存时刻）`}
          />
          {context.schema.map((item, index) => (
            <React.Fragment key={item.key}>
              <Typography.Paragraph strong>
                {index + 1}. {item.label}
              </Typography.Paragraph>
              <ProFormRadio.Group
                name={['answers', item.key, 'result']}
                label="检查结果"
                options={[
                  { label: '合格', value: 'Pass' },
                  { label: '不合格', value: 'Fail' },
                  { label: '不适用', value: 'NA' },
                ]}
                rules={[{ required: true, message: '请选择检查结果' }]}
                disabled={!context.can_inspect || saving || uncertain}
              />
              <ProFormTextArea
                name={['answers', item.key, 'note']}
                label="检查说明"
                rules={
                  values?.[item.key]?.result &&
                  values[item.key].result !== 'Pass'
                    ? [{ required: true, whitespace: true }]
                    : undefined
                }
                fieldProps={{ maxLength: 1000 }}
                disabled={!context.can_inspect || saving || uncertain}
              />
            </React.Fragment>
          ))}
          <ProFormTextArea
            name="notes"
            label="整体备注"
            fieldProps={{ maxLength: 2000 }}
            disabled={!context.can_inspect || saving || uncertain}
          />
        </>
      )}
    </DrawerForm>
  );
}
