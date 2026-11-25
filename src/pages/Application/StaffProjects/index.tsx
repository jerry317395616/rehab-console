import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Result, Space, Spin, Tabs, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { BatchAdd, PairChange, PersonPicker } from './Actions';
import ProfileEditor from './ProfileEditor';
import {
  api,
  choices,
  errorMessage,
  modes,
  type Options,
  type Row,
} from './service';

export default function StaffProjects() {
  const [options, setOptions] = useState<Options>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState('people');
  const [company, setCompany] = useState('');
  const [project, setProject] = useState('');
  const [editor, setEditor] = useState<{
    therapist: string;
    readOnly?: boolean;
  }>();
  const [picker, setPicker] = useState(false);
  const [batch, setBatch] = useState(false);
  const [change, setChange] = useState<Row>();
  const table = useRef<ActionType>(undefined);
  useEffect(() => {
    let active = true;
    api<Options>('get_options')
      .then((value) => {
        if (active) {
          setOptions(value);
          setCompany(value.companies[0]?.value || '');
          setError(undefined);
        }
      })
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [attempt]);
  const byProject = view === 'projects';
  const columns: ProColumns<Row>[] = [
    {
      title: '机构',
      dataIndex: 'company',
      hideInTable: true,
      valueType: 'select',
      initialValue: company,
      fieldProps: {
        'aria-label': '机构',
        showSearch: true,
        options: options?.companies,
        allowClear: false,
        onChange: (value) => {
          setCompany(String(value));
          setProject('');
        },
      },
      formItemProps: { rules: [{ required: true }] },
    },
    ...(byProject
      ? [
          {
            title: '治疗项目',
            dataIndex: 'therapy_type',
            hideInTable: true,
            valueType: 'select' as const,
            initialValue: project || undefined,
            request: async ({ keyWords }: { keyWords?: string }) =>
              company ? choices(company, 'project_all', keyWords || '') : [],
            fieldProps: {
              'aria-label': '治疗项目',
              showSearch: true,
              filterOption: false,
              onChange: (value: unknown) =>
                setProject(value ? String(value) : ''),
            },
          },
          {
            title: '对照状态',
            dataIndex: 'status',
            valueType: 'select' as const,
            valueEnum: { Allowed: '已对照', Removed: '已解除' },
            fieldProps: { 'aria-label': '对照状态' },
            hideInTable: true,
          },
          {
            title: '人员姓名或账号',
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { 'aria-label': '人员姓名或账号' },
          },
        ]
      : [
          {
            title: '人员姓名或账号',
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { 'aria-label': '人员姓名或账号' },
          },
          {
            title: '范围方式',
            dataIndex: 'scope_mode',
            valueType: 'select' as const,
            valueEnum: modes,
            fieldProps: { 'aria-label': '范围方式' },
            hideInTable: true,
          },
        ]),
    { title: '人员', dataIndex: 'person', search: false, width: 140 },
    { title: '账号', dataIndex: 'therapist', search: false, width: 220 },
    {
      title: '科室',
      key: 'departments',
      search: false,
      render: (_, row) => row.departments?.join('、') || '—',
    },
    {
      title: '范围方式',
      key: 'mode',
      search: false,
      render: (_, row) => modes[row.scope_mode],
    },
    ...(byProject
      ? [
          {
            title: '对照状态',
            key: 'pair-status',
            search: false,
            render: (_: unknown, row: Row) => (
              <Tag color={row.status === 'Allowed' ? 'success' : 'default'}>
                {row.status === 'Allowed' ? '已对照' : '已解除'}
              </Tag>
            ),
          },
        ]
      : [
          {
            title: '可开展治疗项目',
            key: 'projects',
            search: false,
            width: 320,
            render: (_: unknown, row: Row) => (
              <Space wrap>
                {row.projects?.map((p) => (
                  <Tag key={p.value}>{p.label}</Tag>
                ))}
                <span>
                  {row.hidden_links
                    ? '部分项目无权查看'
                    : `${row.project_count || 0} 项已配置`}
                </span>
              </Space>
            ),
          },
        ]),
    {
      title: '更新时间',
      dataIndex: 'modified',
      valueType: 'dateTime',
      search: false,
      width: 170,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: byProject ? 200 : 130,
      render: (_, row) => [
        <Button
          key="view"
          type="link"
          onClick={() =>
            setEditor({ therapist: row.therapist, readOnly: true })
          }
        >
          查看
        </Button>,
        row.can_edit && (
          <Button
            key="edit"
            type="link"
            onClick={() => setEditor({ therapist: row.therapist })}
          >
            编辑
          </Button>
        ),
        byProject && row.can_edit && (
          <Button
            key="change"
            type="link"
            danger={row.status === 'Allowed'}
            onClick={() => setChange(row)}
          >
            {row.status === 'Allowed' ? '解除' : '恢复'}
          </Button>
        ),
      ],
    },
  ];
  if (!options)
    return error ? (
      <Result
        status="403"
        title={error}
        extra={
          <Button onClick={() => setAttempt((v) => v + 1)}>重新加载</Button>
        }
      />
    ) : (
      <Spin />
    );
  if (!company)
    return <Alert type="info" showIcon title="当前账号没有可查看的机构。" />;
  const reload = () => table.current?.reload();
  return (
    <>
      <Tabs
        activeKey={view}
        onChange={setView}
        items={[
          { key: 'people', label: '按人员查看' },
          { key: 'projects', label: '按项目查看' },
        ]}
      />
      {error && <Alert type="error" showIcon title={error} />}
      <ProTable<Row>
        key={`${view}:${company}`}
        actionRef={table}
        rowKey="name"
        columns={columns}
        params={{ company, therapy_type: byProject ? project : undefined }}
        scroll={{ x: 1450 }}
        request={async (params) => {
          const result = await api<{
            data: Row[];
            total: number;
            success: boolean;
          }>(byProject ? 'get_pairs' : 'get_profiles', {
            company,
            therapy_type: byProject ? project : undefined,
            keyword: params.keyword,
            scope_mode: byProject ? undefined : params.scope_mode,
            status: byProject ? params.status : undefined,
            current: params.current,
            page_size: params.pageSize,
          });
          setError(undefined);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        locale={{
          emptyText:
            byProject && !project
              ? '请选择治疗项目查看对应人员'
              : '暂无已配置的对照关系',
        }}
        toolBarRender={() =>
          options.can_create || options.can_write
            ? [
                byProject ? (
                  <Button
                    key="batch"
                    type="primary"
                    icon={<PlusOutlined />}
                    disabled={!project}
                    onClick={() => setBatch(true)}
                  >
                    批量建立对照
                  </Button>
                ) : (
                  <Button
                    key="new"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setPicker(true)}
                  >
                    配置人员项目
                  </Button>
                ),
              ]
            : []
        }
      />
      {picker && (
        <PersonPicker
          company={company}
          onClose={() => setPicker(false)}
          onPick={(therapist) => setEditor({ therapist })}
        />
      )}
      {editor && (
        <ProfileEditor
          key={`${company}:${editor.therapist}`}
          company={company}
          therapist={editor.therapist}
          readOnly={editor.readOnly}
          onClose={() => setEditor(undefined)}
          onSaved={reload}
        />
      )}
      {batch && (
        <BatchAdd
          company={company}
          project={project}
          onClose={() => setBatch(false)}
          onSaved={reload}
        />
      )}
      {change && (
        <PairChange
          row={change}
          onClose={() => setChange(undefined)}
          onSaved={reload}
        />
      )}
    </>
  );
}
