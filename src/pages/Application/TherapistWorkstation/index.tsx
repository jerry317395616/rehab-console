import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  DatePicker,
  Select,
  Space,
  Spin,
  Tabs,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import { load, type Options, phases, type TaskRow } from './service';
import TaskDrawer from './TaskDrawer';

const columns: ProColumns<TaskRow>[] = [
  {
    title: '关键词',
    dataIndex: 'keyword',
    hideInTable: true,
    fieldProps: { placeholder: '患者、项目或医嘱' },
  },
  { title: '患者', dataIndex: 'patient_name', search: false },
  { title: '治疗项目', dataIndex: 'therapy_type', search: false },
  {
    title: '预约时段',
    search: false,
    render: (_, row) =>
      `${row.starts_at.slice(11, 16)}–${row.ends_at.slice(11, 16)}`,
  },
  { title: '责任治疗师', dataIndex: 'assigned_to_name', search: false },
  { title: '状态', dataIndex: 'phase', valueEnum: phases, search: false },
  {
    title: '待核对事项',
    search: false,
    ellipsis: true,
    render: (_, row) =>
      row.arrival?.reason ||
      (row.execution?.order_ready === false
        ? row.execution.reason
        : undefined) ||
      '—',
  },
];

export default function TherapistWorkstation({
  initialTask,
  initialDate,
}: {
  initialTask?: string;
  initialDate?: string;
}) {
  const table = useRef<ActionType>(undefined);
  const [options, setOptions] = useState<Options>();
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('');
  const [scope, setScope] = useState<Options['scope']>('mine');
  const [selected, setSelected] = useState(initialTask);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    load<Options>('options')
      .then((value) => {
        if (!active) return;
        setOptions(value);
        setScope(value.scope);
        setDate(
          initialDate && dayjs(initialDate).format('YYYY-MM-DD') === initialDate
            ? initialDate
            : value.date,
        );
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [attempt, initialDate]);

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          action={
            <Button
              size="small"
              onClick={() => {
                setError(undefined);
                if (options) table.current?.reload();
                else setAttempt((previous) => previous + 1);
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {options ? (
        <>
          <Space wrap>
            <DatePicker
              aria-label="任务日期"
              allowClear={false}
              value={dayjs(date)}
              onChange={(value) => {
                if (value) setDate(value.format('YYYY-MM-DD'));
              }}
            />
            <Button onClick={() => setDate(options.date)}>今天</Button>
            <Select
              aria-label="责任范围"
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: '本人任务' },
                { value: 'visible', label: '权限内任务' },
              ]}
            />
            <Typography.Text type="secondary">
              {options.timezone}
            </Typography.Text>
          </Space>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              { key: '', label: '全部' },
              ...Object.entries(phases).map(([key, value]) => ({
                key,
                label: value.text,
              })),
            ]}
          />
          <ProTable<TaskRow>
            actionRef={table}
            rowKey="name"
            pagination={{ defaultPageSize: 20, pageSizeOptions: [10, 20, 50] }}
            scroll={{ x: 980 }}
            params={{ date, tab, scope }}
            request={async ({ current, pageSize, keyword }) => {
              setError(undefined);
              try {
                return await load('queue', {
                  date,
                  tab,
                  scope,
                  keyword,
                  current,
                  page_size: pageSize,
                });
              } catch (reason) {
                setError(errorMessage(reason));
                return { data: [], total: 0, success: false };
              }
            }}
            columns={[
              ...columns,
              {
                title: '操作',
                valueType: 'option',
                render: (_, row) => (
                  <Button type="link" onClick={() => setSelected(row.name)}>
                    打开任务
                  </Button>
                ),
              },
            ]}
          />
        </>
      ) : (
        !error && <Spin />
      )}
      {selected && (
        <TaskDrawer
          key={selected}
          name={selected}
          onClose={() => setSelected(undefined)}
          onChanged={() => table.current?.reload()}
        />
      )}
    </Space>
  );
}
