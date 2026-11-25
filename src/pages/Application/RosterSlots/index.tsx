import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Dropdown, Result, Spin, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import PlanEditor from '../RosterPlans/PlanEditor';
import ChangeModal from './ChangeModal';
import DetailDrawer from './DetailDrawer';
import {
  type Action,
  actions,
  api,
  errorMessage,
  kinds,
  type Options,
  progress,
  type Row,
} from './service';

export default function RosterSlots() {
  const [options, setOptions] = useState<Options>(),
    [error, setError] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  const [detail, setDetail] = useState<string>(),
    [plan, setPlan] = useState<string>(),
    [change, setChange] = useState<{ row: Row; action: Action }>();
  const table = useRef<ActionType>(undefined);
  useEffect(() => {
    let active = true;
    api<Options>('get_options')
      .then((value) => {
        if (active) {
          setOptions(value);
          setError(undefined);
        }
      })
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [attempt]);
  const columns: ProColumns<Row>[] = [
    {
      title: '日期范围',
      dataIndex: 'dates',
      valueType: 'dateRange',
      hideInTable: true,
      initialValue: options ? [options.starts_on, options.ends_on] : undefined,
      formItemProps: { rules: [{ required: true }] },
    },
    {
      title: '人员姓名或账号',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { 'aria-label': '人员姓名或账号' },
    },
    {
      title: '机构',
      dataIndex: 'company',
      valueType: 'select',
      fieldProps: {
        'aria-label': '机构',
        showSearch: true,
        options: options?.companies,
      },
      width: 180,
    },
    {
      title: '医疗科室',
      dataIndex: 'department',
      valueType: 'select',
      fieldProps: {
        'aria-label': '医疗科室',
        showSearch: true,
        options: options?.departments,
      },
      width: 160,
    },
    { title: '班次日期', dataIndex: 'work_date', search: false, width: 110 },
    { title: '实际排班人员', dataIndex: 'person', search: false, width: 150 },
    {
      title: '时段',
      key: 'time',
      search: false,
      width: 130,
      render: (_, r) =>
        `${r.starts_at.slice(11, 16)}–${r.ends_at.slice(11, 16)}`,
    },
    {
      title: '工作类型',
      dataIndex: 'work_kind',
      valueType: 'select',
      valueEnum: kinds,
      fieldProps: { 'aria-label': '工作类型' },
      width: 100,
    },
    {
      title: '可安排项目',
      key: 'projects',
      search: false,
      width: 230,
      render: (_, r) => r.projects.map((p) => p.label).join('、') || '—',
    },
    {
      title: '来源计划编号',
      dataIndex: 'plan',
      hideInTable: true,
      fieldProps: { 'aria-label': '来源计划编号' },
    },
    {
      title: '来源计划／版本',
      key: 'plan_snapshot',
      search: false,
      width: 220,
      render: (_, r) => `${r.plan_title} · 版本 ${r.plan_revision}`,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: { 0: '停用', 1: '启用' },
      fieldProps: { 'aria-label': '启用状态' },
      width: 90,
      render: (_, r) => (
        <Tag color={r.enabled ? 'success' : 'default'}>
          {r.enabled ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '班次进度',
      dataIndex: 'progress',
      search: false,
      valueEnum: progress,
      width: 100,
    },
    {
      title: '人事影响',
      key: 'availability',
      search: false,
      width: 150,
      render: (_, r) => (
        <Tag color={r.hr_impacts.length ? 'warning' : 'default'}>
          {r.hr_impacts.length
            ? `受影响 · 可用 ${r.available_minutes} 分钟`
            : r.enabled && ['Work', 'Duty'].includes(r.work_kind)
              ? '未发现缺勤影响'
              : '无可预约时段'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 160,
      render: (_, r) => [
        <Button key="view" type="link" onClick={() => setDetail(r.name)}>
          查看
        </Button>,
        r.can_edit && (
          <Dropdown
            key="change"
            trigger={['click']}
            menu={{
              items: [
                ...(r.enabled
                  ? [
                      {
                        key: 'adjust',
                        label: actions.adjust,
                        onClick: () => setChange({ row: r, action: 'adjust' }),
                      },
                    ]
                  : []),
                ...(r.enabled && ['Work', 'Duty'].includes(r.work_kind)
                  ? [
                      {
                        key: 'replace',
                        label: actions.replace,
                        onClick: () => setChange({ row: r, action: 'replace' }),
                      },
                      {
                        key: 'swap',
                        label: actions.swap,
                        onClick: () => setChange({ row: r, action: 'swap' }),
                      },
                    ]
                  : []),
                {
                  key: 'status',
                  label: r.enabled ? actions.disable : actions.enable,
                  onClick: () =>
                    setChange({
                      row: r,
                      action: r.enabled ? 'disable' : 'enable',
                    }),
                },
              ],
            }}
          >
            <Button type="link">变更</Button>
          </Dropdown>
        ),
      ],
    },
  ];
  if (!options)
    return error ? (
      <Result
        status="warning"
        title="无法加载排班明细管理"
        subTitle={error}
        extra={<Button onClick={() => setAttempt((v) => v + 1)}>重试</Button>}
      />
    ) : (
      <Spin />
    );
  return (
    <>
      {error && <Alert type="error" showIcon title={error} />}
      <ProTable<Row>
        rowKey="name"
        actionRef={table}
        columns={columns}
        scroll={{ x: 1750 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        request={async (params) => {
          try {
            const result = await api<{
              data: Row[];
              total: number;
              success: boolean;
            }>('get_slots', {
              company: params.company,
              department: params.department,
              keyword: params.keyword,
              plan: params.plan,
              work_kind: params.work_kind,
              enabled: params.enabled,
              starts_on: params.dates?.[0],
              ends_on: params.dates?.[1],
              current: params.current,
              page_size: params.pageSize,
            });
            setError(undefined);
            return result;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
      />
      {detail && (
        <DetailDrawer
          name={detail}
          onClose={() => setDetail(undefined)}
          onOpenPlan={(name) => setPlan(name)}
        />
      )}
      {plan && (
        <PlanEditor
          name={plan}
          readOnly
          options={options}
          onClose={() => setPlan(undefined)}
          onSaved={() => {}}
        />
      )}
      {change && (
        <ChangeModal
          {...change}
          timezone={options.site_timezone}
          onClose={() => setChange(undefined)}
          onSaved={() => table.current?.reload()}
        />
      )}
    </>
  );
}
