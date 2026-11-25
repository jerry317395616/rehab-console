import {
  DrawerForm,
  EditableProTable,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Result } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import {
  type FixedSlot,
  type BookingSettings as Settings,
  settingsGet,
  weekdays,
} from './bookingService';
import { errorMessage, type Link, type Treatment } from './service';
import { taskPost } from './taskService';

export default function BookingSettings({
  therapy,
  onClose,
}: {
  therapy: Treatment;
  onClose: () => void;
}) {
  const [form] = Form.useForm();
  const [context, setContext] = useState<Settings>();
  const [error, setError] = useState<string>();
  const [rows, setRows] = useState<FixedSlot[]>([]);
  const [editing, setEditing] = useState<React.Key[]>([]);
  const { message, modal } = App.useApp();
  const dirty = useRef(false);
  useEffect(() => {
    let active = true;
    settingsGet<Settings>('get_settings', { therapy_type: therapy.name })
      .then((value) => {
        if (!active) return;
        setContext(value);
        setRows(value.rehab_fixed_slots.map((r) => ({ ...r, _key: r.name })));
        form.setFieldsValue({
          ...value,
          rehab_fixed_slots_only: Boolean(value.rehab_fixed_slots_only),
          rehab_group_enabled: Boolean(value.rehab_group_enabled),
        });
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [therapy.name, form]);
  function close() {
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的预约规则？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  return (
    <DrawerForm
      title={`${therapy.rehab_display_label || therapy.name} · 预约规则`}
      open
      width="min(1200px, 100vw)"
      form={form}
      loading={!context && !error}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      drawerProps={{ destroyOnHidden: true }}
      disabled={!context?.can_edit}
      submitter={context?.can_edit ? undefined : false}
      onValuesChange={() => {
        dirty.current = true;
      }}
      onFinish={async (values) => {
        if (!context) return false;
        if (editing.length) {
          message.warning('请先保存正在编辑的时段行');
          return false;
        }
        try {
          await taskPost('booking_settings', 'save_settings', {
            therapy_type: therapy.name,
            expected_modified: context.modified,
            data: {
              rehab_fixed_slots_only: Boolean(values.rehab_fixed_slots_only),
              rehab_group_enabled: Boolean(values.rehab_group_enabled),
              rehab_group_capacity: values.rehab_group_capacity,
              rehab_group_equipment_mode: values.rehab_group_equipment_mode,
              rehab_fixed_slots: rows.map((row) => ({
                name: row.name,
                enabled: Boolean(row.enabled),
                company: row.company,
                department: row.department,
                weekday: row.weekday,
                assigned_to: row.assigned_to,
                room: row.room,
                starts_at: /^\d{2}:\d{2}/.test(row.starts_at)
                  ? row.starts_at
                  : dayjs(row.starts_at).format('HH:mm:ss'),
                ends_at: /^\d{2}:\d{2}/.test(row.ends_at)
                  ? row.ends_at
                  : dayjs(row.ends_at).format('HH:mm:ss'),
                valid_from: dayjs(row.valid_from).format('YYYY-MM-DD'),
                valid_to: dayjs(row.valid_to).format('YYYY-MM-DD'),
              })),
            },
          });
          dirty.current = false;
          message.success('预约规则已保存');
          onClose();
          return true;
        } catch (reason) {
          message.error(errorMessage(reason));
          return false;
        }
      }}
    >
      {error ? (
        <Result status="403" title={error} />
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            title="规则用于后续预约；已有任务保留原排程及资源快照。"
          />
          <ProFormSwitch
            name="rehab_fixed_slots_only"
            label="仅按固定时段预约"
          />
          <ProFormSwitch name="rehab_group_enabled" label="允许团体治疗" />
          <ProFormDigit
            name="rehab_group_capacity"
            label="团体人数上限"
            min={1}
            max={50}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="rehab_group_equipment_mode"
            label="团体设备使用方式"
            rules={[{ required: true }]}
            options={[
              { value: 'PerPatient', label: '每位患者分别占用所选设备' },
              { value: 'Shared', label: '整场共用所选设备' },
            ]}
          />
          <EditableProTable<FixedSlot>
            rowKey="_key"
            headerTitle="固定预约时段"
            value={rows}
            scroll={{ x: 1580 }}
            onChange={(next) => {
              setRows([...next]);
              dirty.current = true;
            }}
            recordCreatorProps={
              context?.can_edit
                ? {
                    record: () =>
                      ({
                        _key: crypto.randomUUID(),
                        enabled: true,
                        weekday: 0,
                      }) as FixedSlot,
                  }
                : false
            }
            editable={{
              type: 'multiple',
              editableKeys: editing,
              onChange: setEditing,
            }}
            columns={[
              {
                title: '启用',
                dataIndex: 'enabled',
                valueType: 'switch',
                width: 70,
              },
              ...(
                ['company', 'department', 'assigned_to', 'room'] as const
              ).map((field) => ({
                title: {
                  company: '机构',
                  department: '医疗科室',
                  assigned_to: '默认主治疗师',
                  room: '默认场地',
                }[field],
                dataIndex: field,
                valueType: 'select' as const,
                width: 180,
                fieldProps: { showSearch: true, filterOption: false },
                request: ({ keyWords }: { keyWords?: string }) =>
                  settingsGet<Link[]>('search_options', {
                    field,
                    keyword: keyWords || '',
                  }),
                formItemProps: {
                  rules: [
                    { required: field === 'company' || field === 'department' },
                  ],
                },
              })),
              {
                title: '星期',
                dataIndex: 'weekday',
                valueType: 'select',
                valueEnum: weekdays,
                fieldProps: {
                  options: Object.entries(weekdays).map(([value, label]) => ({
                    value: Number(value),
                    label,
                  })),
                },
                width: 100,
                formItemProps: { rules: [{ required: true }] },
              },
              {
                title: '开始时间',
                dataIndex: 'starts_at',
                valueType: 'time',
                width: 130,
                formItemProps: { rules: [{ required: true }] },
              },
              {
                title: '结束时间',
                dataIndex: 'ends_at',
                valueType: 'time',
                width: 130,
                formItemProps: { rules: [{ required: true }] },
              },
              {
                title: '生效日期',
                dataIndex: 'valid_from',
                valueType: 'date',
                width: 150,
                formItemProps: { rules: [{ required: true }] },
              },
              {
                title: '失效日期',
                dataIndex: 'valid_to',
                valueType: 'date',
                width: 150,
                formItemProps: { rules: [{ required: true }] },
              },
              {
                title: '操作',
                valueType: 'option',
                width: 120,
                render: (_, row, __, action) =>
                  context?.can_edit
                    ? [
                        <Button
                          key="edit"
                          type="link"
                          onClick={() =>
                            action?.startEditable?.(row._key || '')
                          }
                        >
                          编辑
                        </Button>,
                      ]
                    : [],
              },
            ]}
          />
        </>
      )}
    </DrawerForm>
  );
}
