import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ModalForm,
  ProDescriptions,
  ProFormCheckbox,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Form, Result, Space, Tabs } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { chargeProgressText } from '../ChargeCatalog/executionChargeService';
import { errorMessage, type Treatment } from './service';
import TaskChange from './TaskChange';
import {
  type Planning,
  type Task,
  type TaskDetail,
  taskGet,
  taskPost,
  taskStatus,
} from './taskService';

export default function TreatmentTasks({
  therapy,
  initialTask,
  detailOnly = false,
  onDetailClose,
  initialOrder,
}: {
  therapy: Treatment;
  initialTask?: string;
  detailOnly?: boolean;
  onDetailClose?: () => void;
  initialOrder?: {
    name: string;
    patient_name: string;
    assigned_to?: string;
    therapy_team?: string;
  };
}) {
  const [rights, setRights] = useState<{
    can_read: boolean;
    can_plan: boolean;
  }>();
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [planning, setPlanning] = useState<Planning>();
  const [loadingPlanning, setLoadingPlanning] = useState(false);
  const [detail, setDetail] = useState<TaskDetail>();
  const [operation, setOperation] = useState<string>();
  const [changing, setChanging] = useState<'Reschedule' | 'Cancel'>();
  const [form] = Form.useForm();
  const action = useRef<ActionType>(undefined);
  const requestId = useRef('');
  const planningVersion = useRef(0);
  const dirty = useRef(false);
  const { message, modal } = App.useApp();
  useEffect(() => {
    if (initialTask)
      taskGet<TaskDetail>('get_task', { name: initialTask })
        .then(setDetail)
        .catch((reason) => message.error(errorMessage(reason)));
  }, [initialTask, message]);
  useEffect(() => {
    let active = true;
    taskGet<{ can_read: boolean; can_plan: boolean }>('get_context', {
      therapy_type: therapy.name,
    })
      .then((value) => {
        if (active) setRights(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [therapy.name]);
  async function readTask(name: string) {
    try {
      setDetail(await taskGet<TaskDetail>('get_task', { name }));
    } catch (reason) {
      message.error(errorMessage(reason));
    }
  }
  async function prepareOrder(value: string) {
    const version = ++planningVersion.current;
    setPlanning(undefined);
    setLoadingPlanning(true);
    form.setFieldsValue({
      assigned_to: undefined,
      collaborators: [],
      equipment_list: [],
      room: undefined,
      therapy_team: undefined,
      risk_acknowledged: false,
    });
    try {
      const result = await taskGet<Planning>('get_planning', {
        rehab_order: value,
      });
      if (version === planningVersion.current) {
        setPlanning(result);
        if (initialOrder?.name === value)
          form.setFieldsValue({
            assigned_to: initialOrder.assigned_to,
            therapy_team: initialOrder.therapy_team,
          });
      }
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      if (version === planningVersion.current) setLoadingPlanning(false);
    }
  }
  function closeCreate() {
    const close = () => {
      setCreating(false);
      planningVersion.current += 1;
    };
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的安排？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: close,
      });
    else close();
  }
  if (error || rights?.can_read === false)
    return (
      <Result status="403" title={error || '当前账号没有治疗任务读取权限'} />
    );
  return (
    <>
      {!detailOnly && (
        <ProTable<Task>
          rowKey="name"
          actionRef={action}
          loading={!rights}
          search={false}
          scroll={{ x: 1080 }}
          columns={[
            { title: '患者', dataIndex: 'patient_name' },
            { title: '医嘱', dataIndex: 'rehab_order', ellipsis: true },
            {
              title: '主治疗师／责任人',
              dataIndex: 'assigned_to',
              ellipsis: true,
            },
            {
              title: '开始时间',
              dataIndex: 'starts_at',
              valueType: 'dateTime',
            },
            { title: '结束时间', dataIndex: 'ends_at', valueType: 'dateTime' },
            { title: '状态', dataIndex: 'status', valueEnum: taskStatus },
            {
              title: '操作',
              valueType: 'option',
              render: (_, row) => (
                <Button type="link" onClick={() => readTask(row.name)}>
                  查看任务
                </Button>
              ),
            },
          ]}
          request={(params) =>
            taskGet<{ data: Task[]; total: number; success: boolean }>(
              'get_tasks',
              {
                therapy_type: therapy.name,
                rehab_order: initialOrder?.name,
                current: params.current,
                page_size: params.pageSize,
              },
            )
          }
          toolBarRender={() =>
            rights?.can_plan
              ? [
                  <Button
                    key="new"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      dirty.current = false;
                      setPlanning(undefined);
                      form.resetFields();
                      form.setFieldsValue({
                        booking_mode: 'Advance',
                        collaborators: [],
                        equipment_list: [],
                      });
                      requestId.current = crypto.randomUUID();
                      setCreating(true);
                      if (initialOrder) {
                        form.setFieldValue('rehab_order', initialOrder.name);
                        void prepareOrder(initialOrder.name);
                      }
                    }}
                  >
                    新增单次安排
                  </Button>,
                ]
              : []
          }
        />
      )}
      <DrawerForm
        title="新增单次治疗安排"
        form={form}
        open={creating}
        width="min(760px, 100vw)"
        drawerProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) closeCreate();
        }}
        onValuesChange={(changes) => {
          dirty.current = true;
          if (changes.starts_at && !form.isFieldTouched('ends_at'))
            form.setFieldValue(
              'ends_at',
              dayjs(changes.starts_at).add(
                planning?.planned_duration || therapy.default_duration || 30,
                'minute',
              ),
            );
        }}
        onFinish={async (values) => {
          try {
            await taskPost('therapy_scheduling', 'schedule', {
              data: {
                ...values,
                starts_at: dayjs(values.starts_at).format(
                  'YYYY-MM-DD HH:mm:00',
                ),
                ends_at: dayjs(values.ends_at).format('YYYY-MM-DD HH:mm:00'),
                request_id: requestId.current,
              },
            });
            dirty.current = false;
            setCreating(false);
            action.current?.reload();
            message.success('治疗安排已保存');
            return true;
          } catch (reason) {
            message.error(errorMessage(reason));
            return false;
          }
        }}
      >
        <ProFormSelect
          name="rehab_order"
          label="康复医嘱"
          showSearch
          debounceTime={300}
          rules={[{ required: true }]}
          disabled={Boolean(initialOrder)}
          request={({ keyWords }) =>
            initialOrder
              ? Promise.resolve([
                  {
                    value: initialOrder.name,
                    label: `${initialOrder.patient_name} · ${initialOrder.name}`,
                  },
                ])
              : taskGet('search_orders', {
                  therapy_type: therapy.name,
                  keyword: keyWords || '',
                })
          }
          fieldProps={{
            filterOption: false,
            onChange: (value) => {
              void prepareOrder(String(value));
            },
          }}
        />
        {planning && (
          <Alert
            type="info"
            showIcon
            title={`需 ${planning.rules.therapist_count} 名全程参与治疗师；场地准备 ${planning.rules.room_buffer} 分钟，设备准备 ${planning.rules.equipment_buffer} 分钟。`}
            description={
              planning.order.clinical_notes || '医嘱未另附注意事项。'
            }
          />
        )}
        <ProFormSelect
          name="assigned_to"
          showSearch
          label={
            planning?.rules.requires_therapist === false
              ? '任务责任人'
              : '主治疗师'
          }
          options={planning?.therapists.map((r) => ({
            value: r.name,
            label: r.full_name || r.name,
          }))}
          disabled={!planning || loadingPlanning}
          rules={[{ required: true }]}
        />
        {Boolean(planning && planning.rules.therapist_count > 1) && (
          <ProFormSelect
            name="collaborators"
            label={`协作治疗师（另选 ${(planning?.rules.therapist_count || 1) - 1} 人）`}
            mode="multiple"
            options={planning?.therapists.map((r) => ({
              value: r.name,
              label: r.full_name || r.name,
            }))}
            rules={[{ required: true }]}
          />
        )}
        <ProFormSelect
          name="room"
          label="治疗场地"
          disabled={!planning}
          options={planning?.resources
            .filter((r) => r.resource_type === 'Room')
            .map((r) => ({ value: r.name, label: r.resource_name }))}
          rules={[{ required: true }]}
        />
        {planning && (
          <ProFormSelect
            name="equipment_list"
            label={
              planning.rules.requires_equipment
                ? '本次全部治疗设备'
                : '治疗设备（可选）'
            }
            showSearch
            mode="multiple"
            options={planning.resources
              .filter((r) => r.resource_type === 'Equipment')
              .map((r) => ({ value: r.name, label: r.resource_name }))}
            rules={[{ required: planning.rules.requires_equipment }]}
          />
        )}
        <ProFormSelect
          name="therapy_team"
          label="治疗组"
          disabled={!planning}
          options={planning?.teams.map((r) => ({
            value: r.name,
            label: r.team_name,
          }))}
        />
        <ProFormSelect
          name="booking_mode"
          label="安排方式"
          options={[
            { value: 'Advance', label: '提前预约' },
            {
              value: 'Onsite',
              label: '现场安排',
              disabled: planning?.rules.booking_required !== false,
            },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormDateTimePicker
          name="starts_at"
          label={`开始时间（站点时间${planning ? `：${planning.timezone}` : ''}）`}
          fieldProps={{
            format: 'YYYY-MM-DD HH:mm',
            showTime: { format: 'HH:mm' },
          }}
          rules={[{ required: true }]}
        />
        <ProFormDateTimePicker
          name="ends_at"
          label="结束时间（站点时间）"
          fieldProps={{
            format: 'YYYY-MM-DD HH:mm',
            showTime: { format: 'HH:mm' },
          }}
          rules={[{ required: true }]}
        />
        <ProFormTextArea
          name="notes"
          label="排程备注"
          fieldProps={{ maxLength: 2000 }}
        />
        <ProFormCheckbox
          name="risk_acknowledged"
          rules={[
            {
              validator: async (_, value) => {
                if (!value) throw new Error('请先阅读并确认医嘱注意事项');
              },
            },
          ]}
        >
          已阅读医嘱注意事项并核对本次排程风险
        </ProFormCheckbox>
      </DrawerForm>
      <Drawer
        title="治疗任务"
        open={Boolean(detail)}
        onClose={() => {
          setDetail(undefined);
          onDetailClose?.();
        }}
        size="large"
        destroyOnHidden
      >
        {detail && (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <ProDescriptions<Task>
              dataSource={detail.task}
              column={1}
              columns={[
                { title: '任务', dataIndex: 'name' },
                { title: '患者', dataIndex: 'patient_name' },
                { title: '主治疗师／责任人', dataIndex: 'assigned_to' },
                { title: '状态', dataIndex: 'status', valueEnum: taskStatus },
                ...(detail.billing
                  ? [
                      {
                        title: '收费进度',
                        render: () =>
                          detail.billing && chargeProgressText(detail.billing),
                      },
                    ]
                  : []),
                { title: '开始时间', dataIndex: 'starts_at' },
                { title: '结束时间', dataIndex: 'ends_at' },
                { title: '场地', dataIndex: 'room' },
                {
                  title: '安排方式',
                  dataIndex: 'rehab_booking_mode',
                  valueEnum: { Advance: '提前预约', Onsite: '现场安排' },
                },
              ]}
            />
            <Space wrap>
              {detail.capabilities.can_accept && (
                <Button type="primary" onClick={() => setOperation('accept')}>
                  接单
                </Button>
              )}
              {detail.capabilities.can_join && (
                <Button type="primary" onClick={() => setOperation('join')}>
                  本人确认到场
                </Button>
              )}
              {detail.capabilities.can_leave && (
                <Button onClick={() => setOperation('leave')}>
                  本人结束参与
                </Button>
              )}
              {detail.capabilities.can_complete && (
                <Button onClick={() => setOperation('complete')}>
                  完成任务
                </Button>
              )}
              {detail.capabilities.can_not_complete && (
                <Button onClick={() => setOperation('not_completed')}>
                  登记未执行
                </Button>
              )}
              {detail.capabilities.can_reschedule && (
                <Button onClick={() => setChanging('Reschedule')}>改约</Button>
              )}
              {detail.capabilities.can_cancel && (
                <Button danger onClick={() => setChanging('Cancel')}>
                  取消预约
                </Button>
              )}
            </Space>
            <Tabs
              items={[
                {
                  key: 'staff',
                  label: '协作参与',
                  children: (
                    <ProTable
                      rowKey="therapist"
                      dataSource={detail.task.rehab_collaborators || []}
                      search={false}
                      options={false}
                      pagination={false}
                      columns={[
                        { title: '协作治疗师', dataIndex: 'therapist' },
                        { title: '本人到场', dataIndex: 'joined_at' },
                        { title: '本人结束参与', dataIndex: 'left_at' },
                      ]}
                    />
                  ),
                },
                {
                  key: 'equipment',
                  label: '全部设备',
                  children: (
                    <ProTable
                      rowKey="equipment"
                      dataSource={detail.task.rehab_equipments || []}
                      search={false}
                      options={false}
                      pagination={false}
                      columns={[{ title: '设备', dataIndex: 'equipment' }]}
                    />
                  ),
                },
                {
                  key: 'events',
                  label: '操作记录',
                  children: (
                    <ProTable
                      rowKey={(r) => `${r.event_time}:${r.action}:${r.actor}`}
                      dataSource={detail.events}
                      search={false}
                      options={false}
                      pagination={false}
                      columns={[
                        { title: '操作', dataIndex: 'action' },
                        { title: '操作人', dataIndex: 'actor' },
                        { title: '时间', dataIndex: 'event_time' },
                        { title: '说明', dataIndex: 'reason' },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
      <ModalForm
        title={
          {
            accept: '接收治疗任务',
            join: '本人确认到场',
            leave: '本人结束参与',
            complete: '完成治疗任务',
            not_completed: '登记未执行',
          }[operation || '']
        }
        open={Boolean(operation)}
        modalProps={{ destroyOnHidden: true }}
        onOpenChange={(open) => {
          if (!open) setOperation(undefined);
        }}
        onFinish={async (values) => {
          if (!detail || !operation) return false;
          try {
            const data = {
              name: detail.task.name,
              expected_modified: detail.task.modified,
              action: operation,
              ...values,
            };
            await taskPost(
              operation === 'join' || operation === 'leave'
                ? 'therapy_scheduling'
                : 'scheduling_api',
              operation === 'join' || operation === 'leave'
                ? 'participation'
                : 'change_task',
              data,
            );
            setOperation(undefined);
            await readTask(detail.task.name);
            action.current?.reload();
            message.success('操作已保存');
            return true;
          } catch (reason) {
            message.error(errorMessage(reason));
            return false;
          }
        }}
      >
        {operation === 'complete' && (
          <>
            <Alert
              type="info"
              showIcon
              title="须已完成实际执行、协作参与登记，并关联已提交的治疗记录。"
            />
            <ProFormSelect
              name="therapy_session"
              label="已提交治疗记录"
              options={detail?.sessions.map((r) => ({
                value: r.name,
                label: r.name,
              }))}
              rules={[{ required: true }]}
            />
          </>
        )}
        {operation === 'not_completed' && (
          <ProFormTextArea
            name="reason"
            label="未执行原因"
            rules={[{ required: true }]}
          />
        )}
        {(operation === 'join' || operation === 'leave') && (
          <Alert
            type="info"
            showIcon
            title="仅登记本人的实际参与情况，时间以服务器记录为准。"
          />
        )}
      </ModalForm>
      {changing && detail && (
        <TaskChange
          task={detail.task}
          action={changing}
          onClose={() => setChanging(undefined)}
          onSaved={() => {
            setChanging(undefined);
            readTask(detail.task.name);
            action.current?.reload();
          }}
        />
      )}
    </>
  );
}
