import {
  type ActionType,
  ModalForm,
  type ProColumns,
  ProDescriptions,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Drawer, Form, Tabs } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  deviceOptions,
  errorMessage,
  type Hold,
  type Inspection,
  type InspectionContext,
  type InspectionOptions,
  inspectionApi,
  inspectionSave,
  type Page,
} from './inspectionService';

function Holds({
  device,
  readOnly,
  onChanged,
}: {
  device?: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const action = useRef<ActionType>(undefined);
  const [form] = Form.useForm();
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [review, setReview] = useState<Hold>();
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const { message } = App.useApp();
  const columns: ProColumns<Hold>[] = [
    { title: '异常编号', dataIndex: 'name', width: 150 },
    ...[
      ['resource', '设备'],
      ['inspection', '不合格巡检'],
      ['starts_at', '停用开始'],
      ['reason', '原因'],
      ['resolution', '复核说明'],
      ['resolution_reference', '复核依据'],
    ].map(([key, title]) => ({
      title,
      dataIndex: key,
      width: 180,
      hideInTable: !fields.includes(key),
    })),
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      hideInTable: !fields.includes('status'),
      valueEnum: {
        Open: { text: '待处理', status: 'Error' },
        Released: { text: '已解除', status: 'Success' },
        Cancelled: { text: '已取消', status: 'Default' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, row) =>
        !readOnly && row.can_release ? (
          <Button
            type="link"
            onClick={() => {
              form.resetFields();
              setError(undefined);
              setReview(row);
            }}
          >
            复核解除
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      <Alert
        type="info"
        title="整改后完成同计划的合格复检，再由管理人员复核解除"
        description="解除异常不会自动启用设备。关联运维工单的异常继续遵循原工单恢复验证流程。"
        showIcon
      />
      {error && <Alert type="error" title={error} showIcon />}
      <ProTable<Hold>
        rowKey="name"
        actionRef={action}
        columns={columns}
        search={false}
        params={{ device }}
        scroll={{ x: 'max-content' }}
        pagination={{ defaultPageSize: 10 }}
        request={async (params) => {
          try {
            const data = await inspectionApi<Page<Hold>>('get_holds', {
              device,
              current: params.current,
              page_size: params.pageSize,
            });
            setFields(data.read_fields || []);
            setError(undefined);
            return data;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
      />
      <ModalForm
        form={form}
        title="复核解除巡检异常"
        open={Boolean(review)}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
        }}
        onOpenChange={(open) => {
          if (!open && !working.current) setReview(undefined);
        }}
        onFinish={async (values) => {
          if (!review || working.current) return false;
          working.current = true;
          setError(undefined);
          setSaving(true);
          try {
            await inspectionSave('release_hold', {
              name: review.name,
              modified: review.modified,
              resolution: values.resolution,
              reference: values.reference,
            });
            message.success('巡检异常已复核解除');
            setReview(undefined);
            action.current?.reload();
            onChanged?.();
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
          title="请核对实际整改及合格复检"
          description="系统会校验同计划的后续合格记录、记录摘要及原有运维限制；操作保留处理人和依据。"
          showIcon
        />
        {error && <Alert type="error" title={error} showIcon />}
        <ProFormTextArea
          name="resolution"
          label="处理复核说明"
          rules={[{ required: true }]}
          fieldProps={{ maxLength: 2000 }}
        />
        <ProFormTextArea
          name="reference"
          label="修复复核依据"
          rules={[{ required: true }]}
          fieldProps={{ maxLength: 2000 }}
        />
      </ModalForm>
    </>
  );
}

export default function InspectionRecords({
  device,
  readOnly = false,
  onChanged,
}: {
  device?: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const action = useRef<ActionType>(undefined);
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [detail, setDetail] = useState<InspectionContext>();
  const [options, setOptions] = useState<InspectionOptions>();
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
  const columns: ProColumns<Inspection>[] = [
    {
      title: '医疗科室',
      dataIndex: 'department',
      hideInTable: true,
      search: device ? false : undefined,
    },
    {
      title: '所属机构',
      dataIndex: 'company',
      hideInTable: true,
      search: device ? false : undefined,
    },
    {
      title: '记录编号',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { maxLength: 120 },
    },
    { title: '巡检编号', dataIndex: 'name', width: 170 },
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
    ...[
      ['inspection_plan', '巡检计划'],
      ['performed_at', '巡检时间'],
      ['performed_by', '巡检人'],
    ].map(([key, title]) => ({
      title,
      dataIndex: key,
      width: 180,
      hideInTable: !fields.includes(key),
      search: false as const,
    })),
    {
      title: '结果',
      dataIndex: 'result',
      width: 100,
      valueType: 'select',
      hideInTable: !fields.includes('result'),
      valueEnum: {
        Passed: { text: '合格', status: 'Success' },
        Failed: { text: '不合格', status: 'Error' },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_, row) => (
        <Button
          type="link"
          onClick={async () => {
            try {
              setDetail(
                await inspectionApi<InspectionContext>('get_inspection', {
                  name: row.name,
                }),
              );
            } catch (reason) {
              setError(errorMessage(reason));
            }
          }}
        >
          查看明细
        </Button>
      ),
    },
  ];
  const records = (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      <ProTable<Inspection>
        rowKey="name"
        actionRef={action}
        columns={columns}
        params={{ device }}
        search={{ labelWidth: 'auto' }}
        scroll={{ x: 'max-content' }}
        pagination={{ defaultPageSize: 20 }}
        request={async (params) => {
          try {
            const result = await inspectionApi<Page<Inspection>>(
              'get_inspections',
              {
                device: device || params.device,
                keyword: params.keyword,
                company: params.company,
                department: params.department,
                result: params.result,
                current: params.current,
                page_size: params.pageSize,
              },
            );
            setFields(result.read_fields || []);
            setError(undefined);
            return result;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
      />
    </>
  );
  return (
    <>
      <Tabs
        items={[
          { key: 'records', label: '巡检记录', children: records },
          ...(options?.can_read_holds
            ? [
                {
                  key: 'holds',
                  label: '巡检异常复核',
                  children: (
                    <Holds
                      device={device}
                      readOnly={readOnly}
                      onChanged={onChanged}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      <Drawer
        title="巡检记录明细"
        open={Boolean(detail)}
        onClose={() => setDetail(undefined)}
        size="min(900px, 100vw)"
        destroyOnHidden
      >
        {detail && (
          <>
            <ProDescriptions
              column={{ xs: 1, sm: 2 }}
              dataSource={detail.inspection}
              columns={[
                { title: '巡检编号', dataIndex: 'name' },
                { title: '设备', dataIndex: 'resource' },
                { title: '巡检计划', dataIndex: 'inspection_plan' },
                { title: '实际时间', dataIndex: 'performed_at' },
                { title: '实际巡检人', dataIndex: 'performed_by' },
                {
                  title: '结果',
                  dataIndex: 'result',
                  valueEnum: { Passed: '合格', Failed: '不合格' },
                },
                { title: '整体备注', dataIndex: 'notes' },
              ]}
            />
            <ProTable
              rowKey="key"
              search={false}
              options={false}
              pagination={false}
              dataSource={detail.schema.map((row) => ({
                ...row,
                ...detail.answers[row.key],
              }))}
              columns={[
                { title: '检查项目', dataIndex: 'label' },
                {
                  title: '结果',
                  dataIndex: 'result',
                  valueEnum: { Pass: '合格', Fail: '不合格', NA: '不适用' },
                },
                { title: '说明', dataIndex: 'note' },
              ]}
            />
          </>
        )}
      </Drawer>
    </>
  );
}
