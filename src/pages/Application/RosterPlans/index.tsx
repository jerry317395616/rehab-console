import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  type ProColumns,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Dropdown, Result, Spin, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import Generation from './Generation';
import PlanEditor from './PlanEditor';
import { api, errorMessage, mutate, type Options, type Plan } from './service';

export default function RosterPlans() {
  const [options, setOptions] = useState<Options>(),
    [error, setError] = useState<string>(),
    [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<{
      name?: string;
      copy?: boolean;
      readOnly?: boolean;
    }>(),
    [generation, setGeneration] = useState<string>(),
    [toggle, setToggle] = useState<Plan>();
  const table = useRef<ActionType>(undefined);
  const { message } = App.useApp();
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
  const columns: ProColumns<Plan>[] = [
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
    { title: '计划名称', dataIndex: 'plan_title', search: false, width: 200 },
    {
      title: '计划名称查询',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { 'aria-label': '计划名称查询' },
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
    {
      title: '所属周',
      dataIndex: 'week',
      valueType: 'date',
      hideInTable: true,
      fieldProps: { 'aria-label': '所属周' },
    },
    {
      title: '治疗师账号',
      dataIndex: 'therapist',
      hideInTable: true,
      fieldProps: { 'aria-label': '治疗师账号' },
    },
    {
      title: '有效期',
      key: 'period',
      search: false,
      width: 220,
      render: (_, r) => `${r.starts_on} 至 ${r.ends_on}`,
    },
    { title: '适用人数', dataIndex: 'people_count', search: false, width: 100 },
    {
      title: '每周时段数',
      dataIndex: 'slots_count',
      search: false,
      width: 110,
    },
    { title: '版本', dataIndex: 'revision', search: false, width: 70 },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: { 0: '停用', 1: '启用' },
      fieldProps: { 'aria-label': '状态' },
      width: 90,
      render: (_, r) => (
        <Tag color={r.enabled ? 'success' : 'default'}>
          {r.enabled ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 190,
      render: (_, r) => [
        <Button
          key="view"
          type="link"
          onClick={() => setEditor({ name: r.name, readOnly: true })}
        >
          查看
        </Button>,
        r.can_write && (
          <Button
            key="edit"
            type="link"
            onClick={() => setEditor({ name: r.name })}
          >
            编辑
          </Button>
        ),
        (options?.can_create || r.can_write || r.can_generate) && (
          <Dropdown
            key="more"
            trigger={['click']}
            menu={{
              items: [
                ...(r.can_generate && r.enabled
                  ? [
                      {
                        key: 'generate',
                        label: '生成排班',
                        onClick: () => setGeneration(r.name),
                      },
                    ]
                  : []),
                ...(options?.can_create
                  ? [
                      {
                        key: 'copy',
                        label: '复制计划',
                        onClick: () => setEditor({ name: r.name, copy: true }),
                      },
                    ]
                  : []),
                ...(r.can_write
                  ? [
                      {
                        key: 'toggle',
                        label: r.enabled ? '停用计划' : '启用计划',
                        onClick: () => setToggle(r),
                      },
                    ]
                  : []),
              ],
            }}
          >
            <Button type="link">更多</Button>
          </Dropdown>
        ),
      ],
    },
  ];
  if (!options)
    return error ? (
      <Result
        status="warning"
        title="无法加载排班计划管理"
        subTitle={error}
        extra={<Button onClick={() => setAttempt((v) => v + 1)}>重试</Button>}
      />
    ) : (
      <Spin />
    );
  return (
    <>
      {error && <Alert type="error" showIcon title={error} />}
      <ProTable<Plan>
        rowKey="name"
        headerTitle="排班计划管理"
        columns={columns}
        actionRef={table}
        scroll={{ x: 1500 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        request={async (params) => {
          try {
            const result = await api<{
              data: Plan[];
              total: number;
              success: boolean;
            }>('get_plans', { ...params, page_size: params.pageSize });
            setError(undefined);
            return result;
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
                  新增排班计划
                </Button>,
              ]
            : []
        }
      />
      {editor && (
        <PlanEditor
          {...editor}
          options={options}
          onClose={() => setEditor(undefined)}
          onSaved={() => table.current?.reload()}
        />
      )}
      {generation && (
        <Generation
          name={generation}
          onClose={() => setGeneration(undefined)}
          onSaved={() => table.current?.reload()}
        />
      )}
      {toggle && (
        <ModalForm
          name="roster-plan-toggle"
          title={toggle.enabled ? '停用排班计划' : '启用排班计划'}
          open
          modalProps={{ destroyOnHidden: true }}
          onOpenChange={(open) => {
            if (!open) setToggle(undefined);
          }}
          onFinish={async (values) => {
            try {
              await mutate('set_enabled', {
                name: toggle.name,
                modified: toggle.modified,
                enabled: toggle.enabled ? 0 : 1,
                reason: values.reason,
              });
              message.success('计划状态已更新');
              setToggle(undefined);
              table.current?.reload();
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
            title={
              toggle.enabled
                ? '停用后阻止后续生成，已有班次和预约继续保留。'
                : '启用后可以生成班次，生成时仍会逐条校验。'
            }
          />
          <ProFormTextArea
            name="reason"
            label="启停说明"
            rules={[{ required: true }, { max: 1000 }]}
          />
        </ModalForm>
      )}
    </>
  );
}
