import {
  DrawerForm,
  ProFormDependency,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Button, Col, Form, Row, Tabs } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import AssetPanel from './AssetPanel';
import InspectionPlans from './InspectionPlans';
import InspectionRecords from './InspectionRecords';
import Records from './Records';
import {
  api,
  type Context,
  errorMessage,
  links,
  mutate,
  type Options,
  valuesFor,
} from './service';

export type Editor =
  | { kind: 'create' }
  | { kind: 'view' | 'edit'; name: string };
export default function DeviceEditor({
  editor,
  options,
  onClose,
  onSaved,
}: {
  editor?: Editor;
  options?: Options;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [context, setContext] = useState<Context>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('basic');
  const changes = useRef(new Set<string>());
  const working = useRef(false);
  const { modal, message } = App.useApp();
  useEffect(() => {
    let active = true;
    form.resetFields();
    changes.current.clear();
    setContext(undefined);
    setError(undefined);
    setLoading(Boolean(editor && editor.kind !== 'create'));
    if (!editor) return;
    if (editor.kind === 'create') {
      form.setFieldsValue({ portable: false });
      return;
    }
    api<Context>('get_device', { name: editor.name })
      .then((value) => {
        if (active) {
          setContext(value);
          form.setFieldsValue({
            ...value.device,
            portable: Boolean(
              (value.device as Record<string, unknown>).portable,
            ),
          });
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
  }, [editor, form, attempt]);
  useEffect(() => {
    setTab('basic');
  }, [editor]);
  const creating = editor?.kind === 'create';
  const canSave = Boolean(
    creating
      ? options?.can_create
      : editor?.kind === 'edit' && context?.can_edit && !context.edit_blocked,
  );
  const fields = creating
    ? options?.write_fields || []
    : context?.write_fields || [];
  const visible = new Set(creating ? fields : context?.read_fields || []);
  const identity = [
    'equipment_vendor',
    'equipment_model',
    'equipment_serial',
    'equipment_identifier',
  ];
  const allowed = (field: string) =>
    canSave &&
    fields.includes(field) &&
    !(identity.includes(field) && context?.identity_locked) &&
    !(field === 'display_label' && context?.device.display_label);
  function close() {
    if (working.current) return;
    if (canSave && changes.current.size)
      modal.confirm({
        title: '放弃尚未保存的设备资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  const text = (field: string, label: string, required = false) =>
    visible.has(field) ? (
      <ProFormText
        key={field}
        name={field}
        label={label}
        disabled={!allowed(field)}
        rules={creating && required ? [{ required: true }] : undefined}
        fieldProps={{ maxLength: 140 }}
        colProps={{ xs: 24, sm: 12 }}
      />
    ) : null;
  const select = (
    field: string,
    label: string,
    company?: string,
    department?: string,
  ) =>
    visible.has(field) ? (
      <ProFormSelect
        key={`${field}:${company}:${department}`}
        name={field}
        label={label}
        disabled={!allowed(field)}
        showSearch
        debounceTime={300}
        rules={
          creating &&
          ['company', 'department', 'equipment_category'].includes(field)
            ? [{ required: true }]
            : undefined
        }
        request={({ keyWords }) =>
          links(field, keyWords || '', company, department)
        }
        colProps={{ xs: 24, sm: 12 }}
      />
    ) : null;
  const basic = (
    <>
      {creating && (
        <Col span={24}>
          <Alert
            type="info"
            title="新建设备先登记为待启用"
            description="保存后核对设备身份与合格巡检，再执行验收启用；资产关联可选。"
            showIcon
          />
        </Col>
      )}
      {context?.edit_blocked && (
        <Col span={24}>
          <Alert
            type="warning"
            title="设备有未关闭治疗任务，暂不能修改或启停。"
            showIcon
          />
        </Col>
      )}
      {context && (
        <Col span={24}>
          <Alert
            type={context.health.state === 'normal' ? 'success' : 'warning'}
            showIcon
            title={
              context.health.state === 'normal'
                ? '当前未发现设备运行限制'
                : '当前设备存在运行限制'
            }
            description={
              context.health.reasons.join('；') ||
              '实际预约仍会校验时段、占用和人员条件。'
            }
          />
        </Col>
      )}
      {text('display_label', '设备编号', true)}
      {text('resource_name', '设备名称', true)}
      {select('equipment_category', '设备类型')}
      {select('company', '所属机构')}
      {select('department', '医疗科室')}
      <ProFormDependency name={['company', 'department']}>
        {({ company, department }) =>
          select('area', '排程归属区域', company, department)
        }
      </ProFormDependency>
      {text('equipment_vendor', '设备厂家')}
      {text('equipment_model', '设备型号')}
      {text('equipment_serial', '设备序列号')}
      {text('equipment_identifier', '设备标识')}
      {select('equipment_responsible', '设备负责人')}
      {visible.has('portable') && (
        <ProFormSwitch
          name="portable"
          label="允许跨区域使用"
          disabled={!allowed('portable')}
          colProps={{ xs: 24, sm: 12 }}
        />
      )}
      {visible.has('notes') && (
        <ProFormTextArea
          name="notes"
          label="说明"
          disabled={!allowed('notes')}
          fieldProps={{ maxLength: 2000 }}
          colProps={{ span: 24 }}
        />
      )}
    </>
  );
  return (
    <DrawerForm
      form={form}
      name="equipment-device"
      grid
      title={
        creating
          ? '新增设备'
          : editor?.kind === 'edit'
            ? '编辑设备'
            : '设备详情'
      }
      open={Boolean(editor)}
      width="min(1000px, 100vw)"
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
      onValuesChange={(changed) => {
        for (const field of Object.keys(changed)) changes.current.add(field);
        if ('company' in changed || 'department' in changed) {
          form.setFieldValue('area', undefined);
          changes.current.add('area');
        }
        setError(undefined);
      }}
      submitter={
        canSave && tab === 'basic'
          ? {
              searchConfig: {
                submitText: creating ? '创建设备' : '保存',
                resetText: '取消',
              },
              render: (_, buttons) => [
                <Button key="cancel" disabled={saving} onClick={close}>
                  取消
                </Button>,
                buttons[1],
              ],
            }
          : { render: () => <Button onClick={close}>关闭</Button> }
      }
      onFinish={async (values) => {
        if (!editor || !canSave || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const payload = valuesFor(
            values,
            fields.filter(allowed),
            creating ? undefined : changes.current,
          );
          await mutate('save_device', {
            name: creating ? undefined : context?.device.name,
            modified: context?.device.modified,
            values: payload,
          });
          message.success(
            creating ? '设备已登记，请核对验收后启用' : '设备已保存',
          );
          changes.current.clear();
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
      {error && <Alert type="error" title={error} showIcon />}
      {!context && !creating && !loading && (
        <Button onClick={() => setAttempt((value) => value + 1)}>
          重新加载
        </Button>
      )}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        style={{ width: '100%' }}
        items={[
          {
            key: 'basic',
            label: '基本资料',
            children: <Row gutter={16}>{basic}</Row>,
          },
          ...(context?.read_fields.includes('asset')
            ? [
                {
                  key: 'asset',
                  label: '关联资产',
                  children: (
                    <AssetPanel
                      context={{
                        ...context,
                        can_bind: context.can_bind && editor?.kind === 'view',
                      }}
                      onSaved={() => {
                        setAttempt((value) => value + 1);
                        onSaved();
                      }}
                    />
                  ),
                },
              ]
            : []),
          ...(context?.can_read_plans
            ? [
                {
                  key: 'plans',
                  label: '巡检计划',
                  children: (
                    <InspectionPlans
                      device={context.device.name}
                      readOnly={editor?.kind !== 'view'}
                      onChanged={() => {
                        setAttempt((value) => value + 1);
                        onSaved();
                      }}
                    />
                  ),
                },
              ]
            : []),
          ...(context?.can_read_inspections
            ? [
                {
                  key: 'inspections',
                  label: '巡检记录',
                  children: (
                    <InspectionRecords
                      device={context.device.name}
                      readOnly={editor?.kind !== 'view'}
                      onChanged={() => {
                        setAttempt((value) => value + 1);
                        onSaved();
                      }}
                    />
                  ),
                },
              ]
            : []),
          ...(context?.can_read_events
            ? [
                {
                  key: 'events',
                  label: '操作记录',
                  children: <Records name={context.device.name} kind="event" />,
                },
              ]
            : []),
        ]}
      />
    </DrawerForm>
  );
}
