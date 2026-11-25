import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Dropdown, Result, Space, Spin, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import ChangeModal from './ChangeModal';
import DetailDrawer from './DetailDrawer';
import {
  type Action,
  actions,
  api,
  type Choice,
  errorMessage,
  type Options,
  orderStates,
  type Row,
  settings,
  states,
} from './service';

export default function TreatmentDispatch({
  bookingRoute,
}: {
  bookingRoute?: string;
}) {
  const [options, setOptions] = useState<Options>(),
    [error, setError] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  const [view, setView] = useState('pending'),
    [detail, setDetail] = useState<string>(),
    [change, setChange] = useState<{ row: Row; action: Action }>();
  const [queryError, setQueryError] = useState<string>();
  const table = useRef<ActionType>(undefined);
  useEffect(() => {
    let active = true;
    api<Options>('get_options')
      .then((v) => {
        if (active) {
          setOptions(v);
          setError(undefined);
        }
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [attempt]);
  const reference = (kind: string) => ({
    request: ({ keyWords }: { keyWords?: string }) =>
      api<Choice[]>('references', { kind, keyword: keyWords || '' }),
    fieldProps: { showSearch: true, filterOption: false },
  });
  const columns: ProColumns<Row>[] = [
    {
      title: '患者或医嘱',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { 'aria-label': '患者或医嘱' },
    },
    {
      title: '机构',
      dataIndex: 'company',
      valueType: 'select',
      fieldProps: { options: options?.companies, showSearch: true },
    },
    {
      title: '科室',
      dataIndex: 'department',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: options?.departments, showSearch: true },
    },
    { title: '科室', dataIndex: 'clinical_department', search: false },
    {
      title: '就诊场景',
      dataIndex: 'care_setting',
      valueType: 'select',
      valueEnum: settings,
      width: 85,
    },
    { title: '患者', dataIndex: 'patient_name', search: false, width: 140 },
    {
      title: '具体医嘱',
      dataIndex: 'name',
      search: false,
      ellipsis: true,
      width: 135,
    },
    {
      title: '治疗项目',
      dataIndex: 'therapy_type',
      valueType: 'select',
      ...reference('therapy'),
      width: 160,
    },
    {
      title: '医嘱状态',
      dataIndex: 'status',
      search: false,
      valueEnum: orderStates,
      width: 100,
    },
    {
      title: '治疗组',
      dataIndex: 'team',
      valueType: 'select',
      ...reference('team'),
      render: (_, r) => r.team_label,
      width: 140,
    },
    {
      title: '责任治疗师',
      dataIndex: 'therapist',
      valueType: 'select',
      ...reference('person'),
      render: (_, r) => (
        <Space wrap>
          <span>{r.responsibility}</span>
          {r.pending_effect && <Tag>待生效</Tag>}
        </Space>
      ),
      width: 170,
    },
    {
      title: '责任生效时间',
      dataIndex: 'effective_from',
      valueType: 'dateTime',
      search: false,
      width: 170,
    },
    { title: '频次', dataIndex: 'frequency', search: false, width: 110 },
    {
      title: '有效期',
      key: 'period',
      search: false,
      width: 190,
      render: (_, r) => `${r.starts_on} 至 ${r.ends_on || '未设结束日'}`,
    },
    {
      title: '计划／完成／已约／剩余',
      key: 'counts',
      search: false,
      width: 185,
      render: (_, r) =>
        [
          r.counts.planned,
          r.counts.completed,
          r.counts.reserved,
          r.counts.remaining,
        ]
          .map((n) => n ?? '待核对')
          .join(' / '),
    },
    {
      title: '分派状态',
      dataIndex: 'dispatch_status',
      search: false,
      valueEnum: states,
      width: 120,
    },
    {
      title: '提示',
      key: 'notice',
      search: false,
      width: 230,
      render: (_, r) =>
        r.notice ? (
          <Tag color="warning">{r.notice}</Tag>
        ) : r.status !== 'Authorized' ? (
          '仅准备责任，待医嘱授权'
        ) : (
          '—'
        ),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 150,
      render: (_, row) => {
        const permitted: Action[] = [
          ...(row.can_assign
            ? [
                row.dispatch_status === 'Assigned' ||
                (row.dispatch_status === 'Returned' && row.effective_from)
                  ? ('adjust' as const)
                  : ('assign' as const),
              ]
            : []),
          ...(row.can_enqueue ? ['enqueue' as const] : []),
          ...(row.can_clear ? ['clear' as const] : []),
          ...(row.can_withdraw ? ['withdraw' as const] : []),
        ];
        return [
          <Button key="view" type="link" onClick={() => setDetail(row.name)}>
            查看
          </Button>,
          permitted.length ? (
            <Dropdown
              key="change"
              trigger={['click']}
              menu={{
                items: permitted.map((key) => ({ key, label: actions[key] })),
                onClick: ({ key }) => setChange({ row, action: key as Action }),
              }}
            >
              <Button type="link">办理</Button>
            </Dropdown>
          ) : null,
        ];
      },
    },
  ];
  if (error)
    return (
      <Result
        status="warning"
        title="无法读取治疗分派"
        subTitle={error}
        extra={<Button onClick={() => setAttempt((v) => v + 1)}>重试</Button>}
      />
    );
  if (!options) return <Spin />;
  return (
    <>
      <Alert
        type="info"
        showIcon
        title="按具体医嘱分派治疗责任；分派不占用次数、不生成预约或治疗任务。已有预约按原安排继续执行，改派须单独办理。"
      />
      {queryError && <Alert type="warning" showIcon title={queryError} />}
      <ProTable<Row>
        rowKey="name"
        actionRef={table}
        columns={columns}
        scroll={{ x: 2300 }}
        params={{ view }}
        toolbar={{
          menu: {
            type: 'tab',
            activeKey: view,
            items: [
              { key: 'pending', label: '待分派' },
              { key: 'assigned', label: '已分派' },
              { key: 'returned', label: '退回待处理' },
              { key: 'all', label: '全部' },
            ],
            onChange: (key) => setView(String(key)),
          },
        }}
        request={async (params) => {
          setQueryError(undefined);
          try {
            return await api<{ data: Row[]; total: number; success: boolean }>(
              'get_orders',
              { ...params, page_size: params.pageSize },
            );
          } catch (reason) {
            setQueryError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
      />
      {detail && (
        <DetailDrawer
          name={detail}
          bookingRoute={bookingRoute}
          onClose={() => setDetail(undefined)}
        />
      )}
      {change && (
        <ChangeModal
          row={change.row}
          action={change.action}
          options={options}
          onClose={() => setChange(undefined)}
          onSaved={() => table.current?.reload()}
        />
      )}
    </>
  );
}
