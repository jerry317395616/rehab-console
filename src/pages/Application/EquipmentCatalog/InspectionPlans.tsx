import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  type ProColumns,
  ProDescriptions,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Form, Space, Tabs } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import InspectionEditor from './InspectionEditor';
import {
  deviceOptions,
  errorMessage,
  type InspectionOptions,
  inspectionApi,
  inspectionSave,
  type Page,
  type Plan,
  type PlanContext,
} from './inspectionService';
import PlanEditor, { type PlanEditorState } from './PlanEditor';

export default function InspectionPlans({
  device,
  readOnly = false,
  onChanged,
}: {
  device?: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const action = useRef<ActionType>(undefined);
  const [form] = Form.useForm();
  const [options, setOptions] = useState<InspectionOptions>();
  const [error, setError] = useState<string>();
  const [view, setView] = useState('all');
  const [editor, setEditor] = useState<PlanEditorState>();
  const [inspecting, setInspecting] = useState<string>();
  const [detail, setDetail] = useState<PlanContext>();
  const [retiring, setRetiring] = useState<Plan>();
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    inspectionApi<InspectionOptions>('get_options')
      .then((value) => {
        if (active) setOptions(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const readable = new Set(options?.plan_fields || []);
  const changed = () => {
    action.current?.reload();
    onChanged?.();
  };
  async function openDetail(name: string) {
    try {
      setDetail(await inspectionApi<PlanContext>('get_plan', { name }));
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  const columns: ProColumns<Plan>[] = [
    {
      title: '医疗科室',
      dataIndex: 'department',
      hideInTable: true,
      search: device ? false : undefined,
    },
    {
      title: '最近合格时间',
      dataIndex: 'last_passed_at',
      valueType: 'dateTime',
      width: 180,
      search: false,
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '计划名称或记录编号', maxLength: 120 },
    },
    {
      title: '计划名称',
      dataIndex: 'plan_title',
      search: false,
      width: 200,
      hideInTable: !readable.has('plan_title'),
      render: (_, row) => (
        <Button type="link" onClick={() => openDetail(row.name)}>
          {row.plan_title || row.name}
        </Button>
      ),
    },
    {
      title: '设备',
      dataIndex: 'device',
      valueType: 'select',
      width: 170,
      search: device ? false : undefined,
      request: ({ keyWords }) => deviceOptions(keyWords || ''),
      fieldProps: { showSearch: true },
      render: (_, row) => row.resource || '-',
    },
    {
      title: '所属机构',
      dataIndex: 'company',
      width: 160,
      hideInTable: !readable.has('company'),
      search: !device && readable.has('company') ? undefined : false,
    },
    {
      title: '责任人',
      dataIndex: 'assigned_to',
      width: 190,
      hideInTable: !readable.has('assigned_to'),
      search: false,
    },
    {
      title: '间隔（天）',
      dataIndex: 'interval_days',
      width: 100,
      hideInTable: !readable.has('interval_days'),
      search: false,
    },
    {
      title: '下次应检',
      dataIndex: 'next_due',
      valueType: 'date',
      width: 120,
      search: false,
    },
    {
      title: '应检状态',
      dataIndex: 'due_state',
      width: 120,
      search: false,
      valueEnum: {
        future: { text: '未到期', status: 'Success' },
        today: { text: '今日应检', status: 'Warning' },
        overdue: { text: '已逾期', status: 'Error' },
        unknown: { text: '需要核验', status: 'Warning' },
      },
    },
    {
      title: '计划状态',
      dataIndex: 'status',
      width: 100,
      search: false,
      hideInTable: !readable.has('status'),
      valueEnum: {
        Active: { text: '启用', status: 'Success' },
        Retired: { text: '停用', status: 'Default' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      render: (_, row) => (
        <Space wrap>
          <Button type="link" onClick={() => openDetail(row.name)}>
            详情
          </Button>
          {!readOnly && row.can_inspect && (
            <Button type="link" onClick={() => setInspecting(row.name)}>
              执行巡检
            </Button>
          )}
          {!readOnly && options?.can_create_plans && (
            <Button
              type="link"
              onClick={() =>
                setEditor({ mode: 'copy', name: row.name, device })
              }
            >
              复制新建
            </Button>
          )}
          {!readOnly && row.can_manage && row.status === 'Active' && (
            <>
              {options?.can_create_plans && (
                <Button
                  type="link"
                  onClick={() =>
                    setEditor({ mode: 'replace', name: row.name, device })
                  }
                >
                  调整版本
                </Button>
              )}
              <Button
                type="link"
                onClick={() => {
                  form.resetFields();
                  setError(undefined);
                  setRetiring(row);
                }}
              >
                停用
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];
  return (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      <Tabs
        activeKey={view}
        onChange={setView}
        items={[
          ['all', '全部计划'],
          ['mine', '我的待检'],
          ['today', '今日应检'],
          ['overdue', '已逾期'],
          ['retired', '已停用'],
        ].map(([key, label]) => ({ key, label }))}
      />
      <ProTable<Plan>
        actionRef={action}
        rowKey="name"
        columns={columns}
        params={{ device, view }}
        search={{ labelWidth: 'auto' }}
        scroll={{ x: 'max-content' }}
        pagination={{ defaultPageSize: 20 }}
        request={async (params) => {
          try {
            const result = await inspectionApi<Page<Plan>>('get_plans', {
              device: device || params.device,
              keyword: params.keyword,
              company: params.company,
              department: params.department,
              view,
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
        toolBarRender={() =>
          !readOnly && options?.can_create_plans
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({ mode: 'new', device })}
                >
                  新建巡检计划
                </Button>,
              ]
            : []
        }
      />
      <PlanEditor
        editor={editor}
        options={options}
        onClose={() => setEditor(undefined)}
        onSaved={changed}
      />
      <InspectionEditor
        name={inspecting}
        onClose={() => setInspecting(undefined)}
        onSaved={changed}
      />
      <Drawer
        title="巡检计划详情"
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        size="min(900px, 100vw)"
        destroyOnHidden
      >
        {detail && (
          <>
            <ProDescriptions
              column={{ xs: 1, sm: 2 }}
              dataSource={detail.plan}
              columns={[
                { title: '计划编号', dataIndex: 'name' },
                { title: '计划名称', dataIndex: 'plan_title' },
                { title: '设备', dataIndex: 'resource' },
                { title: '所属机构', dataIndex: 'company' },
                { title: '责任人', dataIndex: 'assigned_to' },
                { title: '首次应检', dataIndex: 'first_due' },
                { title: '巡检间隔（天）', dataIndex: 'interval_days' },
                { title: '下次应检', dataIndex: 'next_due' },
                { title: '替换的原计划', dataIndex: 'supersedes_plan' },
                { title: '规范依据', dataIndex: 'reference' },
              ]}
            />
            <ProTable
              rowKey="key"
              search={false}
              options={false}
              pagination={false}
              dataSource={detail.schema}
              columns={[
                { title: '序号', valueType: 'index', width: 70 },
                { title: '检查项目', dataIndex: 'label' },
              ]}
            />
          </>
        )}
      </Drawer>
      <ModalForm
        form={form}
        title="停用巡检计划"
        open={Boolean(retiring)}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
        }}
        onOpenChange={(open) => {
          if (!open && !working.current) setRetiring(undefined);
        }}
        onFinish={async (values) => {
          if (!retiring || working.current) return false;
          working.current = true;
          setError(undefined);
          setSaving(true);
          try {
            await inspectionSave('retire_plan', {
              name: retiring.name,
              modified: retiring.modified,
              reason: values.reason,
            });
            message.success('巡检计划已停用');
            setRetiring(undefined);
            changed();
            return true;
          } catch (reason) {
            setError(errorMessage(reason));
            return false;
          } finally {
            working.current = false;
            setSaving(false);
          }
        }}
      >
        <Alert
          type="warning"
          title="停用后保留历史检查记录"
          description="到期未完成巡检或仍有未处理巡检异常的计划，不能通过停用清除设备限制。"
          showIcon
        />
        {error && <Alert type="error" title={error} showIcon />}
        <ProFormTextArea
          name="reason"
          label="停用原因"
          rules={[{ required: true }]}
          fieldProps={{ maxLength: 2000 }}
        />
      </ModalForm>
    </>
  );
}
