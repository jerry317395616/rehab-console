import {
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  Flex,
  Input,
  Segmented,
  Select,
  Spin,
  Switch,
  Tabs,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { chargeProgressText } from '../ChargeCatalog/executionChargeService';
import TaskChange from '../TherapyCatalog/TaskChange';
import {
  type Task,
  type TaskDetail,
  taskGet,
} from '../TherapyCatalog/taskService';
import BookingPanel from './BookingPanel';
import type {
  Booking,
  Choice,
  Day,
  Draft,
  Filters,
  NewSlot,
  Options,
  Order,
  Slot,
} from './service';
import { errorMessage, read, statuses } from './service';
import TherapistDay from './TherapistDay';

export default function TreatmentBooking({
  initialOrder,
  initialDate,
  workstationRoute,
}: {
  initialOrder?: string;
  initialDate?: string;
  workstationRoute?: string;
}) {
  const [options, setOptions] = useState<Options>();
  const [filters, setFilters] = useState<Filters>({ date: '' });
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState('records');
  const [view, setView] = useState<'list' | 'day'>('list');
  const [day, setDay] = useState<Day>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [orderError, setOrderError] = useState<string>();
  const [queueTherapists, setQueueTherapists] = useState<Choice[]>([]);
  const queueRequest = useRef(0);
  const [revision, setRevision] = useState(0);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [draft, setDraft] = useState<Draft>();
  const [verified, setVerified] = useState<Slot[]>([]);
  const [pickedSlot, setPickedSlot] = useState<Slot>();
  const [orderSelected, setOrderSelected] = useState(false);
  const [rescheduling, setRescheduling] = useState<Task>();
  const [detailName, setDetailName] = useState<string>();
  const [detail, setDetail] = useState<TaskDetail>();
  const [detailError, setDetailError] = useState<string>();
  const [change, setChange] = useState<{
    task: Task;
    action: 'Cancel' | 'Reschedule';
    slot?: NewSlot;
  }>();
  const isQueue = tab === 'orders';

  useEffect(() => {
    if (options) return;
    let active = true;
    read<Options>('options')
      .then((value) => {
        if (!active) return;
        setOptions(value);
        const date =
          initialOrder &&
          initialDate &&
          initialDate > value.date &&
          dayjs(initialDate).format('YYYY-MM-DD') === initialDate
            ? initialDate
            : value.date;
        setFilters({ date });
        if (value.can_book && initialOrder) {
          setView('day');
          setOrderSelected(true);
          setDraft({ order: initialOrder });
        }
      })
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [initialOrder, initialDate, revision, options]);

  useEffect(() => {
    if (isQueue || !filters.date) return;
    let active = true;
    setPending(true);
    setError(undefined);
    read<Day>('day', filters)
      .then((value) => {
        if (active) setDay(value);
      })
      .catch((reason) => {
        if (!active) return;
        setDay(undefined);
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [filters, isQueue, revision]);

  useEffect(() => {
    if (!detailName) return;
    let active = true;
    taskGet<TaskDetail>('get_task', { name: detailName })
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((reason) => {
        if (active) setDetailError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [detailName, revision]);

  const updateSlots = useCallback((slots: Slot[]) => {
    setVerified(slots);
    setPickedSlot(undefined);
  }, []);

  function filter(values: Partial<Filters>) {
    if (
      ('date' in values && values.date !== filters.date) ||
      ('therapist' in values && values.therapist !== filters.therapist)
    )
      updateSlots([]);
    setFilters((previous) => ({ ...previous, ...values }));
  }

  function openBooking(next: Draft, scope: Partial<Filters> = {}) {
    updateSlots([]);
    setTab('records');
    setView('day');
    filter({
      status: undefined,
      keyword: undefined,
      date: filters.date < (day?.today || '') ? day?.today : filters.date,
      ...scope,
    });
    setKeyword('');
    setOrderSelected(Boolean(next.order || next.task));
    setDraft(next);
  }

  function closeBooking() {
    setDraft(undefined);
    setOrderSelected(false);
    updateSlots([]);
  }

  function showDetail(name: string) {
    setDetail(undefined);
    setDetailError(undefined);
    setDetailName(name);
  }

  function selectOrder(order: Order) {
    setRescheduling(undefined);
    openBooking(
      { order: order.name },
      {
        date: order.first_date,
        company: order.company,
        department: order.department,
        therapist: order.assigned_to,
      },
    );
  }

  function refreshed() {
    setRevision((value) => value + 1);
    updateSlots([]);
  }

  const bookingColumns: ProColumns<Booking>[] = [
    {
      title: '预约时段',
      render: (_, row) =>
        `${row.starts_at.slice(11, 16)}–${row.ends_at.slice(11, 16)}`,
    },
    { title: '患者', dataIndex: 'patient_name' },
    { title: '治疗项目', dataIndex: 'therapy_type' },
    { title: '责任治疗师', dataIndex: 'therapist_label' },
    { title: '治疗场地', dataIndex: 'room_label' },
    { title: '状态', dataIndex: 'status', valueEnum: statuses },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => showDetail(row.name)}>
          详情
        </Button>
      ),
    },
  ];
  const orderColumns: ProColumns<Order>[] = [
    { title: '患者', dataIndex: 'patient_name' },
    { title: '治疗项目', dataIndex: 'therapy_type' },
    { title: '康复医嘱', dataIndex: 'name' },
    {
      title: '医嘱有效期',
      render: (_, row) => (
        <Flex vertical>
          <Typography.Text>
            {row.end_date
              ? `${row.start_date} 至 ${row.end_date}`
              : `${row.start_date} 起`}
          </Typography.Text>
          {row.starts_in_future && !row.reason && (
            <Typography.Text type="secondary">
              {dayjs(row.first_date).format('M 月 D 日')}起可安排
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    { title: '责任治疗师', dataIndex: 'therapist_label' },
    { title: '已预约', dataIndex: ['counts', 'reserved'] },
    { title: '剩余可约', dataIndex: ['counts', 'remaining'] },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) =>
        row.reason ? (
          <Typography.Text type="secondary">{row.reason}</Typography.Text>
        ) : (
          <Button type="link" size="small" onClick={() => selectOrder(row)}>
            预约
          </Button>
        ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      {error && !isQueue && (
        <Alert
          showIcon
          type="error"
          title={error}
          action={
            <Button
              size="small"
              onClick={() => {
                setError(undefined);
                refreshed();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {options && (
        <>
          <Flex wrap align="center" gap={12}>
            {!isQueue && (
              <>
                <DatePicker
                  aria-label="预约日期"
                  allowClear={false}
                  value={dayjs(filters.date)}
                  disabledDate={
                    draft
                      ? (date) =>
                          date.format('YYYY-MM-DD') <
                          (day?.today || options.date)
                      : undefined
                  }
                  onChange={(date) => {
                    if (date) filter({ date: date.format('YYYY-MM-DD') });
                  }}
                />
                <Button
                  onClick={() => filter({ date: day?.today || options.date })}
                >
                  今天
                </Button>
              </>
            )}
            <Select
              aria-label="机构"
              placeholder="全部机构"
              options={options.companies}
              allowClear
              style={{ minWidth: 145 }}
              value={filters.company}
              disabled={orderSelected || Boolean(draft?.at)}
              onChange={(company) =>
                filter({ company, department: undefined, therapist: undefined })
              }
            />
            <Select
              aria-label="科室"
              placeholder="全部科室"
              options={options.departments}
              allowClear
              style={{ minWidth: 145 }}
              value={filters.department}
              disabled={orderSelected || Boolean(draft?.at)}
              onChange={(department) =>
                filter({ department, therapist: undefined })
              }
            />
            <Select
              aria-label="治疗师"
              placeholder="全部治疗师"
              options={isQueue ? queueTherapists : day?.therapists}
              allowClear
              style={{ minWidth: 145 }}
              value={filters.therapist}
              disabled={Boolean(draft?.therapist || draft?.task)}
              onChange={(therapist) => filter({ therapist })}
            />
            {tab === 'records' && !draft && (
              <Select
                aria-label="预约状态"
                placeholder="全部状态"
                allowClear
                style={{ minWidth: 120 }}
                options={Object.entries(statuses).map(([value, status]) => ({
                  value,
                  label: status.text,
                }))}
                value={filters.status}
                onChange={(status) => filter({ status })}
              />
            )}
            {!draft && (
              <>
                <Input.Search
                  aria-label="患者、医嘱或项目"
                  placeholder="患者、医嘱或项目"
                  value={keyword}
                  style={{ width: 220 }}
                  allowClear
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    if (!event.target.value) filter({ keyword: undefined });
                  }}
                  onSearch={(value) => filter({ keyword: value })}
                />
                <Button
                  aria-label="重置预约筛选"
                  onClick={() => {
                    setKeyword('');
                    updateSlots([]);
                    setFilters({
                      date: isQueue ? filters.date : day?.today || options.date,
                    });
                  }}
                >
                  重置
                </Button>
              </>
            )}
          </Flex>
          {rescheduling && (
            <Alert
              showIcon
              type="info"
              title={`正在为 ${rescheduling.patient_name} 选择新时段，原预约继续占用原时段。`}
              action={
                <Flex gap={8}>
                  <Button
                    size="small"
                    onClick={() => openBooking({ task: rescheduling })}
                  >
                    选择其他时段
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      setRescheduling(undefined);
                      closeBooking();
                    }}
                  >
                    退出改约
                  </Button>
                </Flex>
              }
            />
          )}
          <Tabs
            activeKey={tab}
            onChange={(value) => {
              closeBooking();
              setTab(value);
            }}
            tabBarExtraContent={
              <Flex align="center" gap={8} wrap>
                {tab === 'records' && !draft && (
                  <Segmented
                    value={view}
                    onChange={setView}
                    options={[
                      { label: '列表', value: 'list' },
                      { label: '治疗师日程', value: 'day' },
                    ]}
                  />
                )}
                {options.can_book && !draft && (
                  <Button
                    type="primary"
                    onClick={() => {
                      setRescheduling(undefined);
                      openBooking({});
                    }}
                  >
                    新建预约
                  </Button>
                )}
              </Flex>
            }
            items={[
              {
                key: 'records',
                label: '预约记录',
                children:
                  view === 'list' ? (
                    <ProTable<Booking>
                      rowKey="name"
                      dataSource={day?.records || []}
                      loading={pending}
                      columns={bookingColumns}
                      options={false}
                      search={false}
                      scroll={{ x: 880 }}
                    />
                  ) : (
                    <Flex wrap gap={16} align="start">
                      <div style={{ flex: '1 1 440px', minWidth: 0 }}>
                        <Spin spinning={pending}>
                          {day && (
                            <TherapistDay
                              day={day}
                              verified={verified.filter(
                                (slot) =>
                                  slot.starts_at.slice(0, 10) === day.date,
                              )}
                              selected={pickedSlot}
                              choosing={orderSelected}
                              canBook={
                                options.can_book &&
                                !pending &&
                                day.date === filters.date
                              }
                              onCandidate={(therapist, at, therapistLabel) => {
                                openBooking(
                                  rescheduling
                                    ? { task: rescheduling, at }
                                    : { therapist, at, therapistLabel },
                                );
                              }}
                              onSelect={setPickedSlot}
                              onDetail={(row) => {
                                if (!draft) showDetail(row.name);
                              }}
                            />
                          )}
                        </Spin>
                      </div>
                      {draft && (
                        <div
                          style={{
                            flex: '1 1 320px',
                            minWidth: 0,
                            maxWidth: 420,
                          }}
                        >
                          <ProCard>
                            <BookingPanel
                              key={
                                draft.order ||
                                draft.at ||
                                draft.task?.name ||
                                'new'
                              }
                              draft={draft}
                              filters={filters}
                              pickedSlot={pickedSlot}
                              onClose={closeBooking}
                              onOrderChange={setOrderSelected}
                              onSlots={updateSlots}
                              onBooked={(name, date) => {
                                closeBooking();
                                filter({ date, status: undefined });
                                refreshed();
                                showDetail(name);
                              }}
                              onReschedule={(slot) => {
                                if (draft.task)
                                  setChange({
                                    task: draft.task,
                                    action: 'Reschedule',
                                    slot,
                                  });
                                closeBooking();
                              }}
                            />
                          </ProCard>
                        </div>
                      )}
                    </Flex>
                  ),
              },
              ...(options.can_book
                ? [
                    {
                      key: 'orders',
                      label: '待预约医嘱',
                      children: (
                        <>
                          {orderError && (
                            <Alert type="error" showIcon title={orderError} />
                          )}
                          <ProTable<Order>
                            rowKey="name"
                            search={false}
                            columns={orderColumns}
                            scroll={{ x: 1150 }}
                            params={{
                              company: filters.company,
                              department: filters.department,
                              keyword: filters.keyword,
                              therapist: filters.therapist,
                              include_blocked: includeBlocked ? 1 : 0,
                              revision,
                            }}
                            toolBarRender={() => [
                              <Flex key="blocked" align="center" gap={8}>
                                <Switch
                                  aria-label="查看暂不可约医嘱"
                                  checked={includeBlocked}
                                  onChange={setIncludeBlocked}
                                />
                                <Typography.Text>查看暂不可约</Typography.Text>
                              </Flex>,
                              <Button key="reload" onClick={refreshed}>
                                刷新
                              </Button>,
                            ]}
                            request={async ({
                              current,
                              pageSize,
                              company,
                              department,
                              keyword,
                              therapist,
                              include_blocked,
                            }) => {
                              const request = ++queueRequest.current;
                              setOrderError(undefined);
                              try {
                                const value = await read<{
                                  data: Order[];
                                  total: number;
                                  success: boolean;
                                  therapists: Choice[];
                                }>('pending_orders', {
                                  current,
                                  page_size: pageSize,
                                  company,
                                  department,
                                  keyword,
                                  therapist,
                                  include_blocked,
                                });
                                if (request === queueRequest.current)
                                  setQueueTherapists(value.therapists);
                                return value;
                              } catch (reason) {
                                if (request === queueRequest.current) {
                                  setQueueTherapists([]);
                                  setOrderError(errorMessage(reason));
                                }
                                return { success: false, data: [], total: 0 };
                              }
                            }}
                          />
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}
      {!options && !error && <Spin />}
      {detailName && (
        <Drawer
          title="治疗预约详情"
          open
          size="large"
          onClose={() => setDetailName(undefined)}
          destroyOnHidden
        >
          {detailError && <Alert showIcon type="error" title={detailError} />}
          {!detail && !detailError && <Spin />}
          {detail && (
            <Flex vertical gap={16}>
              <ProDescriptions
                column={2}
                dataSource={detail.task}
                columns={[
                  { title: '患者', dataIndex: 'patient_name' },
                  { title: '医嘱', dataIndex: 'rehab_order' },
                  {
                    title: '预约状态',
                    dataIndex: 'status',
                    valueEnum: statuses,
                  },
                  { title: '治疗师', dataIndex: 'assigned_to' },
                  ...(detail.billing
                    ? [
                        {
                          title: '收费进度',
                          render: () =>
                            detail.billing &&
                            chargeProgressText(detail.billing),
                        },
                      ]
                    : []),
                  { title: '开始时间', dataIndex: 'starts_at' },
                  { title: '结束时间', dataIndex: 'ends_at' },
                  { title: '治疗场地', dataIndex: 'room' },
                  {
                    title: '设备',
                    render: () =>
                      detail.task.rehab_equipments
                        ?.map((item) => item.equipment)
                        .join('、') ||
                      detail.task.equipment ||
                      '—',
                  },
                ]}
              />
              <Flex gap={8}>
                {workstationRoute && (
                  <Button
                    onClick={() => {
                      const [pathname, query] = workstationRoute.split('?');
                      const params = new URLSearchParams(query);
                      params.set('task', detail.task.name);
                      params.set('date', detail.task.starts_at.slice(0, 10));
                      history.push(`${pathname}?${params}`);
                    }}
                  >
                    打开治疗师工作站
                  </Button>
                )}
                {options?.can_book && detail.capabilities.can_reschedule && (
                  <Button
                    onClick={() => {
                      setRescheduling(detail.task);
                      setDetailName(undefined);
                      setTab('records');
                      setView('day');
                      filter({
                        date:
                          detail.task.starts_at.slice(0, 10) <
                          (day?.today || '')
                            ? day?.today
                            : detail.task.starts_at.slice(0, 10),
                        therapist: detail.task.assigned_to,
                        status: undefined,
                      });
                    }}
                  >
                    改约
                  </Button>
                )}
                {options?.can_book && detail.capabilities.can_cancel && (
                  <Button
                    danger
                    onClick={() =>
                      setChange({ task: detail.task, action: 'Cancel' })
                    }
                  >
                    取消预约
                  </Button>
                )}
              </Flex>
              <ProTable
                rowKey={(row) => `${row.event_time}:${row.action}`}
                headerTitle="操作记录"
                dataSource={detail.events}
                search={false}
                options={false}
                pagination={false}
                columns={[
                  { title: '时间', dataIndex: 'event_time' },
                  {
                    title: '操作',
                    dataIndex: 'action',
                    valueEnum: {
                      schedule: '预约',
                      reschedule: '改约',
                      cancel: '取消',
                    },
                  },
                  { title: '操作人', dataIndex: 'actor' },
                  { title: '说明', dataIndex: 'reason' },
                ]}
              />
            </Flex>
          )}
        </Drawer>
      )}
      {change && (
        <TaskChange
          task={change.task}
          action={change.action}
          initialSlot={change.slot}
          onClose={() => setChange(undefined)}
          onSaved={() => {
            if (change.slot)
              filter({ date: change.slot.starts_at.slice(0, 10) });
            setChange(undefined);
            setRescheduling(undefined);
            refreshed();
            showDetail(change.task.name);
          }}
        />
      )}
    </Flex>
  );
}
