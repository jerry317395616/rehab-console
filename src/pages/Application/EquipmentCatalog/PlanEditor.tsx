import {
  DrawerForm,
  EditableProTable,
  type ProColumns,
  ProFormDatePicker,
  ProFormDependency,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  deviceOptions,
  errorMessage,
  type InspectionOptions,
  inspectionApi,
  inspectionSave,
  type PlanContext,
} from './inspectionService';

export type PlanEditorState = {
  mode: 'new' | 'copy' | 'replace';
  name?: string;
  device?: string;
};
type Row = { key: string; label: string };
export default function PlanEditor({
  editor,
  options,
  onClose,
  onSaved,
}: {
  editor?: PlanEditorState;
  options?: InspectionOptions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [source, setSource] = useState<PlanContext>();
  const [rows, setRows] = useState<Row[]>([]);
  const [keys, setKeys] = useState<React.Key[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const working = useRef(false);
  const dirty = useRef(false);
  const { message, modal } = App.useApp();
  useEffect(() => {
    let active = true;
    form.resetFields();
    setSource(undefined);
    setError(undefined);
    dirty.current = false;
    setRows([]);
    setKeys([]);
    setLoading(Boolean(editor?.name));
    if (!editor) return;
    const setChecklist = (items: { label: string }[]) => {
      const values = items.map((row) => ({
        key: crypto.randomUUID(),
        label: row.label,
      }));
      setRows(values);
      setKeys(values.map((row) => row.key));
    };
    form.setFieldsValue({
      device: editor.device,
      interval_days: 7,
      assigned_to: options?.user,
      first_due: options?.now.slice(0, 10),
    });
    if (!editor.name) {
      setChecklist(options?.default_checklist || []);
      return;
    }
    inspectionApi<PlanContext>('get_plan', { name: editor.name })
      .then((value) => {
        if (active) {
          setSource(value);
          form.setFieldsValue({
            ...value.plan,
            device: editor.device || value.plan.resource,
            first_due: value.now.slice(0, 10),
          });
          setChecklist(value.schema);
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editor, form, options, attempt]);
  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的巡检计划？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  const columns: ProColumns<Row>[] = [
    { title: '序号', valueType: 'index', width: 60, editable: false },
    {
      title: '检查项目',
      dataIndex: 'label',
      formItemProps: { rules: [{ required: true, message: '请填写检查项目' }] },
      fieldProps: { maxLength: 160 },
    },
    { title: '操作', valueType: 'option', width: 70, render: () => null },
  ];
  return (
    <DrawerForm
      name="inspection-plan"
      form={form}
      title={
        editor?.mode === 'replace'
          ? '调整巡检计划版本'
          : editor?.mode === 'copy'
            ? '复制新建巡检计划'
            : '新建巡检计划'
      }
      open={Boolean(editor)}
      width="min(900px, 100vw)"
      loading={loading}
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
        searchConfig: {
          submitText:
            editor?.mode === 'replace'
              ? '保存新版本并停用原计划'
              : '保存并启用计划',
        },
        submitButtonProps: {
          disabled: loading || Boolean(editor?.name && !source),
        },
        render: (_, buttons) => [
          <Button key="cancel" disabled={saving} onClick={close}>
            取消
          </Button>,
          buttons[1],
        ],
      }}
      onFinish={async (values) => {
        if (!editor || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          if (!rows.length || rows.some((row) => !row.label?.trim()))
            throw new Error('请完整填写至少一项检查项目');
          const labels = rows.map((row) => row.label.trim());
          if (new Set(labels).size !== labels.length)
            throw new Error('检查项目不能重复');
          await inspectionSave('create_plan', {
            device: values.device,
            plan_title: values.plan_title,
            first_due: values.first_due,
            interval_days: values.interval_days,
            assigned_to: values.assigned_to,
            reference: values.reference,
            checklist: labels.map((label) => ({ label })),
            ...(editor.mode === 'replace'
              ? {
                  replace: editor.name,
                  modified: source?.plan.modified,
                  reason: values.reason,
                }
              : {}),
          });
          message.success('巡检计划已保存');
          dirty.current = false;
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(
            reason instanceof Error && !('response' in reason)
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
      <Alert
        type="info"
        showIcon
        title="计划保存后形成固定版本"
        description={
          editor?.mode === 'replace'
            ? '核对后创建新计划，并在同一事务中停用原计划。到期未检或存在未处理巡检异常时不能换版。'
            : '待启用设备也可建立巡检计划。保存后调整检查项、周期或责任人须形成新计划。'
        }
      />
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          action={
            editor?.name && !source ? (
              <Button onClick={() => setAttempt((value) => value + 1)}>
                重新加载
              </Button>
            ) : undefined
          }
        />
      )}
      <ProFormSelect
        name="device"
        label="设备"
        showSearch
        debounceTime={300}
        disabled={Boolean(editor?.device || editor?.mode === 'replace')}
        rules={[{ required: true }]}
        request={({ keyWords }) => deviceOptions(keyWords || '')}
        fieldProps={{
          onChange: () => form.setFieldValue('assigned_to', undefined),
        }}
      />
      <ProFormText
        name="plan_title"
        label="计划名称"
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 120 }}
      />
      <ProFormDatePicker
        name="first_due"
        label="首次应检日期"
        rules={[{ required: true }]}
      />
      <ProFormDigit
        name="interval_days"
        label="巡检间隔（天）"
        rules={[{ required: true }]}
        min={1}
        max={366}
        fieldProps={{ precision: 0 }}
      />
      <ProFormDependency name={['device']}>
        {({ device }) => (
          <ProFormSelect
            key={device || 'none'}
            name="assigned_to"
            label="巡检责任人"
            fieldProps={{ showSearch: { filterOption: false } }}
            disabled={!device}
            showSearch
            debounceTime={300}
            rules={[{ required: true }]}
            request={({ keyWords }) =>
              device
                ? inspectionApi('search_assignees', {
                    device,
                    keyword: keyWords || '',
                  })
                : Promise.resolve([])
            }
          />
        )}
      </ProFormDependency>
      <ProFormTextArea
        name="reference"
        label="院内巡检规范依据"
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 2000 }}
      />
      <Form.Item label="检查项目" required>
        <EditableProTable<Row>
          rowKey="key"
          columns={columns}
          value={rows}
          onChange={(value) => {
            setRows([...value]);
            dirty.current = true;
          }}
          search={false}
          options={false}
          pagination={false}
          maxLength={50}
          recordCreatorProps={{
            position: 'bottom',
            creatorButtonText: '添加检查项目',
            record: () => ({ key: crypto.randomUUID(), label: '' }),
          }}
          editable={{
            type: 'multiple',
            editableKeys: keys,
            onChange: setKeys,
            onValuesChange: (_, values) => {
              setRows(values);
              dirty.current = true;
            },
            actionRender: (_, __, dom) => [dom.delete],
          }}
        />
      </Form.Item>
      {editor?.mode === 'replace' && (
        <ProFormTextArea
          name="reason"
          label="替换原因"
          rules={[{ required: true }]}
          fieldProps={{ maxLength: 2000 }}
        />
      )}
    </DrawerForm>
  );
}
