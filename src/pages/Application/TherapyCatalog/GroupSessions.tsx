import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ModalForm,
  ProDescriptions,
  ProFormCheckbox,
  ProFormDatePicker,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Form, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useRef, useState } from 'react';
import BookingChange from './BookingChange';
import {
  type BookingSettings,
  bookingGet,
  bookingPost,
  type GroupMember,
  type GroupSession,
  settingsGet,
  weekdays,
} from './bookingService';
import OrderPlanFields from './OrderPlanFields';
import { errorMessage, type Treatment } from './service';
import TreatmentTasks from './TreatmentTasks';
import { type Planning, taskStatus } from './taskService';

export default function GroupSessions({
  therapy,
  canPlan,
}: {
  therapy: Treatment;
  canPlan: boolean;
}) {
  const action = useRef<ActionType>(undefined);
  const [detail, setDetail] = useState<GroupSession>();
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [arriving, setArriving] = useState<GroupMember>();
  const [taskName, setTaskName] = useState<string>();
  const [changing, setChanging] = useState<'Reschedule' | 'Cancel'>();
  const [settings, setSettings] = useState<BookingSettings>();
  const [planning, setPlanning] = useState<Planning>();
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();
  const selectedSlot = Form.useWatch('slot', form);
  const requestId = useRef('');
  const dirty = useRef(false);
  const { message, modal } = App.useApp();
  async function read(name: string) {
    try {
      setDetail(await bookingGet<GroupSession>('get_group', { name }));
    } catch (reason) {
      message.error(errorMessage(reason));
    }
  }
  function closeCreate() {
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的团体场次？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setCreating(false),
      });
    else setCreating(false);
  }
  return (
    <>
      <ProTable<GroupSession>
        rowKey="name"
        actionRef={action}
        scroll={{ x: 1000 }}
        columns={[
          { title: '场次', dataIndex: 'name', search: false, ellipsis: true },
          {
            title: '预约日期',
            dataIndex: 'date',
            valueType: 'dateRange',
            hideInTable: true,
          },
          {
            title: '开始时间',
            dataIndex: 'starts_at',
            valueType: 'dateTime',
            search: false,
          },
          {
            title: '结束时间',
            dataIndex: 'ends_at',
            valueType: 'dateTime',
            search: false,
          },
          {
            title: '主治疗师',
            dataIndex: 'assigned_to',
            search: false,
            ellipsis: true,
          },
          { title: '场地', dataIndex: 'room', search: false },
          {
            title: '已加入／上限',
            search: false,
            render: (_, row) => `${row.enrolled} / ${row.capacity}`,
          },
          {
            title: '状态',
            dataIndex: 'status',
            search: false,
            render: (_, row) => (
              <Tag>
                {row.status === 'Cancelled'
                  ? '已取消'
                  : dayjs(row.ends_at).isBefore(dayjs())
                    ? '已过时段'
                    : '已安排'}
              </Tag>
            ),
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, row) => (
              <Button type="link" onClick={() => read(row.name)}>
                场次与患者
              </Button>
            ),
          },
        ]}
        request={(params) =>
          bookingGet('get_groups', {
            therapy_type: therapy.name,
            current: params.current,
            page_size: params.pageSize,
            date_from: params.date?.[0],
            date_to: params.date?.[1],
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
                      const value = await settingsGet<BookingSettings>(
                        'get_settings',
                        { therapy_type: therapy.name },
                      );
                      if (!value.rehab_group_enabled) {
                        message.info(
                          '请先在治疗项目的“预约规则”中启用团体治疗并设置人数上限',
                        );
                        return;
                      }
                      setSettings(value);
                      setPlanning(undefined);
                      form.resetFields();
                      form.setFieldValue(
                        'capacity',
                        value.rehab_group_capacity,
                      );
                      requestId.current = crypto.randomUUID();
                      dirty.current = false;
                      setCreating(true);
                    } catch (reason) {
                      message.error(errorMessage(reason));
                    }
                  }}
                >
                  新增团体场次
                </Button>,
              ]
            : []
        }
      />
      <DrawerForm
        title="新增团体场次"
        open={creating}
        form={form}
        width="min(800px, 100vw)"
        drawerProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) closeCreate();
        }}
        onValuesChange={() => {
          dirty.current = true;
          requestId.current = crypto.randomUUID();
        }}
        onFinish={async (values) => {
          const slot = settings?.rehab_fixed_slots.find(
            (r) => r.name === values.slot,
          );
          const starts_at = slot
            ? `${dayjs(values.slot_date).format('YYYY-MM-DD')} ${slot.starts_at}`
            : dayjs(values.starts_at).format('YYYY-MM-DD HH:mm:00');
          const ends_at = slot
            ? `${dayjs(values.slot_date).format('YYYY-MM-DD')} ${slot.ends_at}`
            : dayjs(values.ends_at).format('YYYY-MM-DD HH:mm:00');
          const plan = Object.fromEntries(
            [
              'rehab_order',
              'assigned_to',
              'collaborators',
              'equipment_list',
              'room',
              'therapy_team',
              'risk_acknowledged',
            ].map((key) => [key, values[key]]),
          );
          try {
            const result = await bookingPost<{ reference: string }>(
              'create_group',
              {
                data: { plan, starts_at, ends_at, capacity: values.capacity },
                request_id: requestId.current,
              },
            );
            dirty.current = false;
            setCreating(false);
            action.current?.reload();
            await read(result.reference);
            message.success('团体场次及首位患者预约已保存');
            return true;
          } catch (reason) {
            message.error(errorMessage(reason));
            return false;
          }
        }}
      >
        <Alert
          type="info"
          showIcon
          title="创建时同时加入首位患者。每位患者保留自己的医嘱、任务和治疗记录。"
          description={
            settings?.rehab_group_equipment_mode === 'Shared'
              ? '本项目配置为整场共用设备。'
              : '本项目配置为每位患者分别占用设备，加入患者时须选择可用设备。'
          }
        />
        <OrderPlanFields
          therapy={therapy}
          form={form}
          onPlanning={setPlanning}
        />
        <ProFormDigit
          name="capacity"
          label="本场人数上限"
          min={1}
          max={settings?.rehab_group_capacity || 1}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="slot"
          label="固定预约时段"
          rules={[{ required: Boolean(settings?.rehab_fixed_slots_only) }]}
          options={settings?.rehab_fixed_slots
            .filter(
              (r) =>
                r.enabled &&
                r.company === planning?.order.company &&
                r.department === planning?.order.clinical_department,
            )
            .map((r) => ({
              value: r.name,
              label: `${weekdays[r.weekday as keyof typeof weekdays]} ${r.starts_at}—${r.ends_at}`,
            }))}
          fieldProps={{
            onChange: (value) => {
              const row = settings?.rehab_fixed_slots.find(
                (r) => r.name === value,
              );
              if (row)
                form.setFieldsValue({
                  ...(row.assigned_to ? { assigned_to: row.assigned_to } : {}),
                  ...(row.room ? { room: row.room } : {}),
                });
            },
          }}
        />
        {selectedSlot ? (
          <ProFormDatePicker
            name="slot_date"
            label="预约日期（须符合所选星期和生效范围）"
            rules={[{ required: true }]}
          />
        ) : (
          <Space wrap>
            <ProFormDateTimePicker
              name="starts_at"
              label={`开始时间（${planning?.timezone || '站点时间'}）`}
              fieldProps={{
                format: 'YYYY-MM-DD HH:mm',
                showTime: { format: 'HH:mm' },
              }}
              rules={[{ required: true }]}
            />
            <ProFormDateTimePicker
              name="ends_at"
              label="结束时间"
              fieldProps={{
                format: 'YYYY-MM-DD HH:mm',
                showTime: { format: 'HH:mm' },
              }}
              rules={[{ required: true }]}
            />
          </Space>
        )}
      </DrawerForm>
      <Drawer
        title="团体场次与患者"
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        size="large"
        destroyOnHidden
      >
        {detail && (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <ProDescriptions<GroupSession>
              dataSource={detail}
              column={1}
              columns={[
                { title: '场次', dataIndex: 'name' },
                { title: '开始时间', dataIndex: 'starts_at' },
                { title: '结束时间', dataIndex: 'ends_at' },
                { title: '主治疗师', dataIndex: 'assigned_to' },
                { title: '场地', dataIndex: 'room' },
                {
                  title: '人数',
                  render: () => `${detail.enrolled} / ${detail.capacity}`,
                },
                {
                  title: '设备使用',
                  dataIndex: 'equipment_mode',
                  valueEnum: {
                    Shared: '整场共用',
                    PerPatient: '每位患者分别占用',
                  },
                },
              ]}
            />
            <Alert
              type="info"
              showIcon
              title="名单仅显示当前账号可访问的患者。到场登记不替代身份核验、风险核验和个人治疗记录。"
            />
            {detail.can_manage && detail.status === 'Open' && (
              <Space wrap>
                <Button
                  type="primary"
                  disabled={
                    !detail.enrollment_open ||
                    detail.enrolled >= detail.capacity
                  }
                  onClick={() => {
                    addForm.resetFields();
                    requestId.current = crypto.randomUUID();
                    setAdding(true);
                  }}
                >
                  加入患者
                </Button>
                <Button onClick={() => setChanging('Reschedule')}>
                  整场改约
                </Button>
                <Button danger onClick={() => setChanging('Cancel')}>
                  取消整场未执行预约
                </Button>
              </Space>
            )}
            <ProTable<GroupMember>
              rowKey="name"
              dataSource={detail.members}
              search={false}
              options={false}
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: '患者', dataIndex: 'patient_name' },
                { title: '医嘱', dataIndex: 'rehab_order', ellipsis: true },
                {
                  title: '任务状态',
                  dataIndex: 'status',
                  valueEnum: taskStatus,
                },
                {
                  title: '到场登记',
                  dataIndex: 'arrived_at',
                  valueType: 'dateTime',
                },
                {
                  title: '操作',
                  valueType: 'option',
                  render: (_, row) => [
                    <Button
                      key="task"
                      type="link"
                      onClick={() => setTaskName(row.name)}
                    >
                      查看任务
                    </Button>,
                    row.can_arrive && !row.arrived_at && (
                      <Button
                        key="arrive"
                        type="link"
                        onClick={() => setArriving(row)}
                      >
                        到场登记
                      </Button>
                    ),
                  ],
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
      <DrawerForm
        title="加入团体患者"
        form={addForm}
        open={adding}
        width="min(700px, 100vw)"
        drawerProps={{ destroyOnHidden: true }}
        onOpenChange={setAdding}
        onValuesChange={() => {
          requestId.current = crypto.randomUUID();
        }}
        onFinish={async (values) => {
          if (!detail) return false;
          try {
            await bookingPost('add_member', {
              name: detail.name,
              expected_modified: detail.modified,
              data: {
                rehab_order: values.rehab_order,
                equipment_list:
                  detail.equipment_mode === 'Shared'
                    ? detail.plan.equipment_list
                    : values.equipment_list,
                risk_acknowledged: values.risk_acknowledged,
              },
              request_id: requestId.current,
            });
            setAdding(false);
            await read(detail.name);
            action.current?.reload();
            message.success('患者已加入场次');
            return true;
          } catch (reason) {
            message.error(errorMessage(reason));
            return false;
          }
        }}
      >
        {detail?.equipment_mode === 'Shared' && (
          <Alert
            type="info"
            showIcon
            title="本场使用共享设备，将沿用场次原设备清单。"
          />
        )}
        <OrderPlanFields
          therapy={therapy}
          form={addForm}
          orderOnly
          equipmentReadOnly={detail?.equipment_mode === 'Shared'}
          onPlanning={(value) => {
            if (value && detail?.equipment_mode === 'Shared')
              addForm.setFieldValue(
                'equipment_list',
                detail.plan.equipment_list,
              );
          }}
        />
      </DrawerForm>
      <ModalForm
        title="团体患者到场登记"
        open={Boolean(arriving)}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) setArriving(undefined);
        }}
        onFinish={async (values) => {
          if (!arriving || !detail) return false;
          try {
            await bookingPost('arrive', {
              name: arriving.name,
              expected_modified: arriving.modified,
              patient_confirmed: values.patient_confirmed,
            });
            setArriving(undefined);
            await read(detail.name);
            message.success('到场已登记');
            return true;
          } catch (reason) {
            message.error(errorMessage(reason));
            return false;
          }
        }}
      >
        <Alert
          type="info"
          showIcon
          title={`请核对患者：${arriving?.patient_name || ''}`}
          description="时间由系统记录。登记窗口为本场开始前 60 分钟至本场结束，且须为站点当日。"
        />
        <ProFormCheckbox
          name="patient_confirmed"
          rules={[
            {
              validator: async (_, value) => {
                if (!value) throw new Error('请先核对实际到场患者');
              },
            },
          ]}
        >
          已核对本人实际到场
        </ProFormCheckbox>
      </ModalForm>
      {detail && changing && (
        <BookingChange
          kind="Group"
          reference={detail.name}
          action={changing}
          onClose={() => setChanging(undefined)}
          onSaved={() => {
            setChanging(undefined);
            read(detail.name);
            action.current?.reload();
          }}
        />
      )}
      {taskName && (
        <TreatmentTasks
          therapy={therapy}
          initialTask={taskName}
          detailOnly
          onDetailClose={() => {
            setTaskName(undefined);
            if (detail) read(detail.name);
          }}
        />
      )}
    </>
  );
}
