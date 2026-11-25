import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Result, Spin, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Options, type Team } from './service';
import TeamEditor from './TeamEditor';

export default function TherapyTeams() {
  const [options, setOptions] = useState<Options>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<{ name?: string; readOnly?: boolean }>();
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
  const columns: ProColumns<Team>[] = [
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
    { title: '治疗组名称', dataIndex: 'team_name', search: false, width: 180 },
    {
      title: '治疗组名称或编号',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { 'aria-label': '治疗组名称或编号' },
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
    { title: '组长', dataIndex: 'leader', search: false, width: 140 },
    {
      title: '组长账号',
      dataIndex: 'team_lead',
      hideInTable: true,
      fieldProps: { 'aria-label': '组长账号' },
    },
    {
      title: '当前成员数',
      dataIndex: 'member_count',
      search: false,
      width: 110,
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: { 1: '启用', 0: '停用' },
      fieldProps: { 'aria-label': '启用状态' },
      width: 100,
      render: (_, row) => (
        <Tag color={row.enabled ? 'success' : 'default'}>
          {row.enabled ? '启用' : '停用'}
        </Tag>
      ),
    },
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
      width: 130,
      render: (_, row) => [
        <Button
          key="view"
          type="link"
          onClick={() => setEditor({ name: row.name, readOnly: true })}
        >
          查看
        </Button>,
        row.can_edit && (
          <Button
            key="edit"
            type="link"
            onClick={() => setEditor({ name: row.name })}
          >
            编辑
          </Button>
        ),
      ],
    },
  ];
  if (!options)
    return error ? (
      <Result
        status="warning"
        title="无法加载治疗组管理"
        subTitle={error}
        extra={<Button onClick={() => setAttempt((v) => v + 1)}>重试</Button>}
      />
    ) : (
      <Spin />
    );
  return (
    <>
      {error && <Alert type="error" showIcon title={error} />}
      <ProTable<Team>
        rowKey="name"
        headerTitle="治疗组管理"
        actionRef={table}
        columns={columns}
        scroll={{ x: 1200 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        request={async (params) => {
          try {
            const value = await api<{
              data: Team[];
              total: number;
              success: boolean;
            }>('get_teams', { ...params, page_size: params.pageSize });
            setError(undefined);
            return value;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() =>
          options.can_create
            ? [
                <Button
                  key="add"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({})}
                >
                  新增治疗组
                </Button>,
              ]
            : []
        }
      />
      {editor && (
        <TeamEditor
          name={editor.name}
          readOnly={editor.readOnly}
          options={options}
          onClose={() => setEditor(undefined)}
          onSaved={() => table.current?.reload()}
        />
      )}
    </>
  );
}
