import {
  ProDescriptions,
  ProForm,
  ProFormCheckbox,
  ProFormSelect,
} from '@ant-design/pro-components';
import { Alert, App, Button, Empty, Flex, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type {
  Draft,
  Filters,
  NewSlot,
  Order,
  OrderPlanning,
  Slot,
} from './service';
import { create, errorMessage, read, slotKey, slots } from './service';

type BookingFields = {
  order?: string;
  room?: string;
  equipment?: string[];
  collaborators?: string[];
  risk?: boolean;
};

export default function BookingPanel({
  draft,
  filters,
  pickedSlot,
  onClose,
  onOrderChange,
  onSlots,
  onBooked,
  onReschedule,
}: {
  draft: Draft;
  filters: Filters;
  pickedSlot?: Slot;
  onClose: () => void;
  onOrderChange: (hasOrder: boolean) => void;
  onSlots: (slots: Slot[]) => void;
  onBooked: (name: string, date: string) => void;
  onReschedule: (slot: NewSlot) => void;
}) {
  const task = draft.task;
  const fixedOrder = task?.rehab_order || draft.order;
  const [form] = ProForm.useForm<BookingFields>();
  const orderName = ProForm.useWatch('order', form);
  const room = ProForm.useWatch('room', form);
  const equipment = ProForm.useWatch('equipment', form);
  const collaborators = ProForm.useWatch('collaborators', form);
  const [planningResult, setPlanningResult] = useState<{
    order: string;
    date: string;
    value?: OrderPlanning;
    error?: string;
  }>();
  const { date } = filters;
  const currentPlanning =
    planningResult?.order === orderName && planningResult?.date === date
      ? planningResult
      : undefined;
  const planning = currentPlanning?.value;
  const planningError = currentPlanning?.error;
  const [orderError, setOrderError] = useState<string>();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{
    query: string;
    slots: Slot[];
    reasons: string[];
  }>();
  const [wholeDay, setWholeDay] = useState(false);
  const [retry, setRetry] = useState(0);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const request = useRef<{ body: string; uuid: string }>(undefined);
  const { message } = App.useApp();
  const target = draft.at?.slice(0, 10) === filters.date ? draft.at : undefined;
  const therapist = task?.assigned_to || draft.therapist || filters.therapist;
  const exact = wholeDay ? undefined : target;
  const roomChoices = planning?.resources.filter(
    (resource) => resource.resource_type === 'Room',
  );
  const equipmentChoices = planning?.resources.filter(
    (resource) => resource.resource_type === 'Equipment',
  );
  const query =
    planning &&
    !planning.booking_error &&
    room &&
    orderName &&
    (task || planning.counts.remaining > 0) &&
    (!planning.rules.requires_equipment || equipment?.length) &&
    (planning.rules.therapist_count <= 1 ||
      (collaborators?.length ?? 0) >= planning.rules.therapist_count - 1)
      ? JSON.stringify({
          name: orderName,
          date: filters.date,
          room,
          equipment: equipment || [],
          collaborators: collaborators || [],
          at: exact,
          therapist,
          task: task?.name,
        })
      : undefined;
  const checked = query && result?.query === query ? result : undefined;
  const selection = checked?.slots.find((slot) =>
    pickedSlot
      ? slotKey(slot) === slotKey(pickedSlot)
      : Boolean(exact && slot.starts_at === exact),
  );

  useEffect(() => {
    if (!orderName || !date) return;
    let active = true;
    read<OrderPlanning>('planning', { name: orderName, date })
      .then((value) => {
        if (active) setPlanningResult({ order: orderName, date, value });
      })
      .catch((reason) => {
        if (active)
          setPlanningResult({
            order: orderName,
            date,
            error: errorMessage(reason),
          });
      });
    return () => {
      active = false;
    };
  }, [orderName, date]);

  useEffect(() => {
    onSlots([]);
    setError(undefined);
    setResult(undefined);
    setChecking(Boolean(query));
    if (!query) return;
    let active = true;
    const timer = window.setTimeout(() => {
      slots(JSON.parse(query))
        .then((value) => {
          if (!active) return;
          setResult({ ...value, query });
          onSlots(value.slots);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, retry, onSlots]);

  return (
    <Flex vertical gap={12}>
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {task ? '选择改约时段' : '新建治疗预约'}
        </Typography.Title>
        <Button size="small" disabled={saving} onClick={onClose}>
          关闭
        </Button>
      </Flex>
      {exact && (
        <Typography.Text type="secondary">
          日程所选 {exact.slice(0, 16)}
          {draft.therapist
            ? ` · ${draft.therapistLabel || draft.therapist}`
            : ''}
        </Typography.Text>
      )}
      <ProForm<BookingFields>
        form={form}
        disabled={saving}
        initialValues={{
          order: fixedOrder,
          room: task?.room,
          equipment:
            task?.rehab_equipments?.map((item) => item.equipment) ||
            (task?.equipment ? [task.equipment] : []),
          collaborators:
            task?.rehab_collaborators?.map((item) => item.therapist) || [],
        }}
        submitter={{
          resetButtonProps: false,
          submitButtonProps: { disabled: !selection || checking },
          searchConfig: { submitText: task ? '预览改约影响' : '确认预约' },
        }}
        onValuesChange={(changed) => {
          if (!('risk' in changed)) onSlots([]);
          if ('order' in changed) {
            setPlanningResult(undefined);
            onOrderChange(Boolean(changed.order));
            form.setFieldsValue({
              room: undefined,
              equipment: [],
              collaborators: [],
              risk: false,
            });
          }
        }}
        onFinish={async (fields) => {
          if (!selection || form.getFieldValue('order') !== orderName)
            return false;
          const proposed: NewSlot = {
            ...selection,
            room: fields.room || '',
            equipment_list: fields.equipment || [],
            collaborators: fields.collaborators || [],
          };
          if (task) {
            onReschedule(proposed);
            return true;
          }
          const { therapist_label, ...booking } = proposed;
          const data = {
            ...booking,
            rehab_order: fields.order,
            risk_acknowledged: fields.risk,
          };
          const body = JSON.stringify(data);
          if (request.current?.body !== body)
            request.current = { body, uuid: crypto.randomUUID() };
          setSaving(true);
          try {
            const saved = await create({
              ...data,
              request_id: request.current.uuid,
            });
            message.success('治疗预约已确认');
            onBooked(saved.task.name, selection.starts_at.slice(0, 10));
            return true;
          } catch (reason) {
            setError(errorMessage(reason));
            setResult(undefined);
            onSlots([]);
            return false;
          } finally {
            setSaving(false);
          }
        }}
      >
        <ProFormSelect
          name="order"
          label="康复医嘱"
          showSearch
          disabled={Boolean(fixedOrder) || saving}
          params={{
            date: filters.date,
            company: filters.company,
            department: filters.department,
            therapist,
            at: target,
          }}
          request={async ({
            keyWords,
            date,
            company,
            department,
            therapist,
            at,
          }) => {
            if (fixedOrder) return [];
            try {
              const result = await read<{ data: Order[] }>('orders', {
                date,
                company,
                department,
                therapist,
                at,
                keyword: keyWords,
                page_size: 30,
              });
              setOrderError(undefined);
              return result.data.map((row) => ({
                value: row.name,
                label: `${row.patient_name} · ${row.therapy_type} · ${row.name}`,
              }));
            } catch (reason) {
              setOrderError(errorMessage(reason));
              return [];
            }
          }}
          fieldProps={{
            filterOption: false,
            notFoundContent: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  target
                    ? '该时段没有分派给这位治疗师的待约医嘱'
                    : '当前条件下没有待预约医嘱'
                }
              />
            ),
          }}
          rules={[{ required: true }]}
        />
        {!fixedOrder && orderError && (
          <Alert showIcon type="error" title={orderError} />
        )}
        {!orderName && !orderError && (
          <Typography.Paragraph type="secondary">
            {target
              ? '请选择该时段的待约医嘱。'
              : '可先选待约医嘱，也可直接点击日程中的空档。'}
          </Typography.Paragraph>
        )}
        {planningError && <Alert showIcon type="error" title={planningError} />}
        {orderName && !planning && !planningError && <Spin />}
        {planning && (
          <Flex vertical gap={12}>
            {planning.booking_error && (
              <Alert showIcon type="warning" title={planning.booking_error} />
            )}
            {!roomChoices?.length && (
              <Alert
                type="warning"
                showIcon
                title="当前机构和科室没有可选治疗场地"
                description="请在「基础数据 → 治疗资源档案」核对该科室的场地是否已启用。"
              />
            )}
            {planning.rules.requires_equipment && !equipmentChoices?.length && (
              <Alert
                type="warning"
                showIcon
                title="当前科室没有符合治疗项目要求的设备"
              />
            )}
            {planning.counts.remaining <= 0 && !task && (
              <Alert type="warning" showIcon title="医嘱没有剩余可预约次数" />
            )}
            <ProDescriptions
              size="small"
              column={2}
              dataSource={planning.order}
              columns={[
                { title: '患者', dataIndex: 'patient_name' },
                { title: '治疗项目', dataIndex: 'therapy_type' },
                {
                  title: '剩余可约',
                  render: () => `${planning.counts.remaining} 次`,
                },
                {
                  title: '项目时长',
                  render: () => `${planning.duration || '—'} 分钟`,
                },
                {
                  title: '医嘱有效期',
                  span: 2,
                  render: () =>
                    planning.order.end_date
                      ? `${planning.order.start_date} 至 ${planning.order.end_date}`
                      : `${planning.order.start_date} 起`,
                },
              ]}
            />
            {planning.order.clinical_notes && (
              <Alert
                type="info"
                showIcon
                title="医嘱注意事项"
                description={planning.order.clinical_notes}
              />
            )}
            <ProFormSelect
              name="room"
              label="治疗场地"
              rules={[{ required: true }]}
              options={roomChoices?.map((item) => ({
                label: item.resource_name,
                value: item.name,
              }))}
            />
            <ProFormSelect
              name="equipment"
              mode="multiple"
              label="治疗设备"
              rules={[{ required: planning.rules.requires_equipment }]}
              options={equipmentChoices?.map((item) => ({
                label: item.resource_name,
                value: item.name,
              }))}
            />
            {(planning.rules.therapist_count > 1 ||
              Boolean(task?.rehab_collaborators?.length)) && (
              <ProFormSelect
                name="collaborators"
                mode="multiple"
                label="协作治疗师"
                rules={[
                  {
                    type: 'array',
                    required: planning.rules.therapist_count > 1,
                    min: Math.max(0, planning.rules.therapist_count - 1),
                  },
                ]}
                options={planning.therapists.map((item) => ({
                  label: item.full_name || item.name,
                  value: item.name,
                }))}
              />
            )}
            {checking && (
              <Spin size="small" description="核验可约时段">
                <div />
              </Spin>
            )}
            {!selection && checked && checked.slots.length > 0 && (
              <Typography.Text type="secondary">
                请在日程上选择绿色时段。
              </Typography.Text>
            )}
            {checked && !checked.slots.length && (
              <Alert
                type="warning"
                showIcon
                title="所选条件下没有可预约时段"
                description={
                  checked.reasons.join(' ') ||
                  '请核对日期、责任分派和选择的开始时间。'
                }
              />
            )}
            {error && <Alert showIcon type="error" title={error} />}
            <Flex gap={8} wrap>
              {exact && query && (
                <Button
                  size="small"
                  disabled={checking || saving}
                  onClick={() => setWholeDay(true)}
                >
                  查看当天其他时段
                </Button>
              )}
              {query && (checked || error) && (
                <Button
                  size="small"
                  disabled={checking || saving}
                  onClick={() => setRetry((value) => value + 1)}
                >
                  刷新可约时段
                </Button>
              )}
            </Flex>
            {selection && (
              <Alert
                type="success"
                showIcon
                title={`${filters.date} ${selection.starts_at.slice(11, 16)}–${selection.ends_at.slice(11, 16)} · ${selection.therapist_label}`}
                description={[
                  roomChoices?.find((choice) => choice.name === room)
                    ?.resource_name,
                  ...(equipmentChoices || [])
                    .filter((choice) => equipment?.includes(choice.name))
                    .map((choice) => choice.resource_name),
                  !task &&
                    `确认后剩余可约 ${Math.max(0, planning.counts.remaining - 1)} 次`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )}
            {!task && (
              <ProFormCheckbox
                name="risk"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (!value)
                        throw new Error('请核对本次预约及医嘱注意事项。');
                    },
                  },
                ]}
              >
                已核对本次预约及医嘱注意事项
              </ProFormCheckbox>
            )}
          </Flex>
        )}
      </ProForm>
    </Flex>
  );
}
