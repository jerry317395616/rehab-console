import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormTimePicker,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import BookingChange from './BookingChange';
import {
  type BatchPreview,
  type BookingSettings,
  bookingGet,
  bookingPost,
  settingsGet,
  weekdays,
} from './bookingService';
import OrderPlanFields from './OrderPlanFields';
import { errorMessage, type Treatment } from './service';
import type { Planning } from './taskService';

type SeriesRow = {
  name: string;
  patient_name: string;
  rehab_order: string;
  total: number;
  starts_at: string;
  ends_at: string;
};

export default function BatchBookings({
  therapy,
  canPlan,
}: {
  therapy: Treatment;
  canPlan: boolean;
}) {
  const action = useRef<ActionType>(undefined);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState<BookingSettings>();
  const [planning, setPlanning] = useState<Planning>();
  const [preview, setPreview] = useState<BatchPreview>();
  const [changing, setChanging] = useState<{
    name: string;
    action: 'Reschedule' | 'Cancel';
  }>();
  const [form] = Form.useForm();
  const slot = Form.useWatch('slot', form);
  const requestId = useRef('');
  const dirty = useRef(false);
  const { message, modal } = App.useApp();
  function close() {
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的批量预约？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setCreating(false),
      });
    else setCreating(false);
  }
  return (
    <>
      <ProTable<SeriesRow>
        rowKey="name"
        actionRef={action}
        search={false}
        scroll={{ x: 900 }}
        columns={[
          { title: '患者', dataIndex: 'patient_name' },
          { title: '医嘱', dataIndex: 'rehab_order', ellipsis: true },
          { title: '本批任务数', dataIndex: 'total' },
          { title: '首次开始', dataIndex: 'starts_at', valueType: 'dateTime' },
          { title: '最后结束', dataIndex: 'ends_at', valueType: 'dateTime' },
          {
            title: '操作',
            valueType: 'option',
            render: (_, row) =>
              canPlan
                ? [
                    <Button
                      key="move"
                      type="link"
                      onClick={() =>
                        setChanging({ name: row.name, action: 'Reschedule' })
                      }
                    >
                      批量改约
                    </Button>,
                    <Button
                      key="cancel"
                      type="link"
                      danger
                      onClick={() =>
                        setChanging({ name: row.name, action: 'Cancel' })
                      }
                    >
                      批量取消
                    </Button>,
                  ]
                : [],
          },
        ]}
        request={(params) =>
          bookingGet('get_series', {
            therapy_type: therapy.name,
            current: params.current,
            page_size: params.pageSize,
          })
        }
        toolBarRender={() =>
          canPlan
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={async () => {
                    try {
                      setSettings(
                        await settingsGet<BookingSettings>('get_settings', {
                          therapy_type: therapy.name,
                        }),
                      );
                      form.resetFields();
                      form.setFieldsValue({
                        count: 10,
                        weekdays: [0, 2, 4],
                        skip_conflicts: false,
                      });
                      setPlanning(undefined);
                      setPreview(undefined);
                      requestId.current = crypto.randomUUID();
                      dirty.current = false;
                      setCreating(true);
                    } catch (reason) {
                      message.error(errorMessage(reason));
                    }
                  }}
                >
                  新增批量预约
                </Button>,
              ]
            : []
        }
      />
      <DrawerForm
        title="单患者批量预约"
        form={form}
        open={creating}
        width="min(1000px, 100vw)"
        drawerProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        onValuesChange={() => {
          dirty.current = true;
          setPreview(undefined);
          requestId.current = crypto.randomUUID();
        }}
        submitter={{
          searchConfig: { submitText: preview ? '确认创建预约' : '预览预约' },
          submitButtonProps: {
            disabled: Boolean(preview && !preview.can_confirm),
          },
        }}
        onFinish={async (values) => {
          const data = {
            plan: Object.fromEntries(
              [
                'rehab_order',
                'assigned_to',
                'collaborators',
                'equipment_list',
                'room',
                'therapy_team',
                'risk_acknowledged',
              ].map((key) => [key, values[key]]),
            ),
            start_date: dayjs(values.start_date).format('YYYY-MM-DD'),
            end_date: dayjs(values.end_date).format('YYYY-MM-DD'),
            weekdays: values.weekdays,
            starts_at: values.starts_at,
            ends_at: values.ends_at,
            count: values.count,
            slot: values.slot || null,
            skip_conflicts: Boolean(values.skip_conflicts),
          };
          try {
            if (!preview) {
              setPreview(
                await bookingPost<BatchPreview>('preview_batch', { data }),
              );
              return false;
            }
            const result = await bookingPost<{
              created: number;
              skipped: unknown[];
            }>('confirm_batch', {
              data,
              preview_token: preview.preview_token,
              request_id: requestId.current,
            });
            message.success(
              `已创建 ${result.created} 次预约，跳过 ${result.skipped.length} 项`,
            );
            dirty.current = false;
            setCreating(false);
            action.current?.reload();
            return true;
          } catch (reason) {
            setPreview(undefined);
            message.error(errorMessage(reason));
            return false;
          }
        }}
      >
        <Alert
          type="info"
          showIcon
          title="默认全部通过后统一保存。确认时会再次检查每次预约，发生冲突时整批不保存。"
        />
        <OrderPlanFields
          therapy={therapy}
          form={form}
          onPlanning={setPlanning}
        />
        <ProFormSelect
          name="slot"
          label="使用固定时段（可选）"
          options={settings?.rehab_fixed_slots
            .filter(
              (r) =>
                r.enabled &&
                r.company === planning?.order.company &&
                r.department === planning?.order.clinical_department,
            )
            .map((r) => ({
              value: r.name,
              label: `${weekdays[r.weekday as keyof typeof weekdays]} ${r.starts_at}—${r.ends_at}（${r.valid_from}至${r.valid_to}）`,
            }))}
          fieldProps={{
            onChange: (value) => {
              const row = settings?.rehab_fixed_slots.find(
                (r) => r.name === value,
              );
              if (row)
                form.setFieldsValue({
                  weekdays: [row.weekday],
                  starts_at: row.starts_at,
                  ends_at: row.ends_at,
                  ...(row.assigned_to ? { assigned_to: row.assigned_to } : {}),
                  ...(row.room ? { room: row.room } : {}),
                });
            },
          }}
        />
        <Space wrap align="start">
          <ProFormDatePicker
            name="start_date"
            label="起始日期"
            rules={[{ required: true }]}
          />
          <ProFormDatePicker
            name="end_date"
            label="截止日期"
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="count"
            label="安排次数"
            min={1}
            max={50}
            rules={[{ required: true }]}
          />
        </Space>
        <ProFormSelect
          name="weekdays"
          label="重复星期"
          mode="multiple"
          disabled={Boolean(slot)}
          rules={[{ required: true }]}
          options={Object.entries(weekdays).map(([value, label]) => ({
            value: Number(value),
            label,
          }))}
        />
        <Space wrap>
          <ProFormTimePicker
            name="starts_at"
            label="开始时间（站点时间）"
            disabled={Boolean(slot)}
            fieldProps={{ format: 'HH:mm', showSecond: false }}
            rules={[{ required: true }]}
          />
          <ProFormTimePicker
            name="ends_at"
            label="结束时间（站点时间）"
            disabled={Boolean(slot)}
            fieldProps={{ format: 'HH:mm', showSecond: false }}
            rules={[{ required: true }]}
          />
        </Space>
        <ProFormSwitch
          name="skip_conflicts"
          label="跳过冲突项，只创建预览中可用的预约"
        />
        {preview && (
          <>
            <Alert
              type={preview.can_confirm ? 'success' : 'warning'}
              showIcon
              title={`医嘱剩余可安排 ${preview.remaining} 次；本次可用 ${preview.available} 项。${preview.can_confirm ? '请核对明细后确认。' : '请调整条件，或明确启用跳过冲突项后重新预览。'}`}
            />
            <ProTable
              rowKey="index"
              search={false}
              options={false}
              pagination={false}
              dataSource={preview.rows}
              scroll={{ x: 700 }}
              columns={[
                {
                  title: '开始',
                  dataIndex: 'starts_at',
                  valueType: 'dateTime',
                },
                { title: '结束', dataIndex: 'ends_at', valueType: 'dateTime' },
                {
                  title: '校验结果',
                  dataIndex: 'available',
                  render: (_, row) => (
                    <Tag color={row.available ? 'success' : 'error'}>
                      {row.available ? '可用' : '冲突'}
                    </Tag>
                  ),
                },
                { title: '说明', dataIndex: 'reason' },
              ]}
            />
          </>
        )}
      </DrawerForm>
      {changing && (
        <BookingChange
          kind="Series"
          reference={changing.name}
          action={changing.action}
          onClose={() => setChanging(undefined)}
          onSaved={() => {
            setChanging(undefined);
            action.current?.reload();
          }}
        />
      )}
    </>
  );
}
