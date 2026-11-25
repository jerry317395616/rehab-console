import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  type ProColumns,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import React, { useRef, useState } from 'react';
import {
  api,
  type EquipmentType,
  errorMessage,
  type List,
  mutate,
  valuesFor,
} from './service';

export default function TypeList() {
  const action = useRef<ActionType>(undefined);
  const [form] = Form.useForm();
  const [permissions, setPermissions] = useState<List<EquipmentType>>();
  const [editor, setEditor] = useState<{ row?: EquipmentType }>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const { message } = App.useApp();
  const fields = permissions?.write_fields || [];
  const open = (row?: EquipmentType) => {
    form.resetFields();
    form.setFieldsValue({ ...row, disabled: Boolean(row?.disabled) });
    setError(undefined);
    setEditor({ row });
  };
  const columns: ProColumns<EquipmentType>[] = [
    { title: '关键词', dataIndex: 'keyword', hideInTable: true },
    {
      title: '类型名称',
      dataIndex: 'equipment_type_name',
      search: false,
      hideInTable: !permissions?.read_fields?.includes('equipment_type_name'),
    },
    {
      title: '说明',
      dataIndex: 'description',
      search: false,
      ellipsis: true,
      hideInTable: !permissions?.read_fields?.includes('description'),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      search: false,
      valueEnum: {
        0: { text: '启用', status: 'Success' },
        1: { text: '停用', status: 'Default' },
      },
      hideInTable: !permissions?.read_fields?.includes('disabled'),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) =>
        row.can_edit ? (
          <Button type="link" onClick={() => open(row)}>
            编辑
          </Button>
        ) : null,
    },
  ];
  return (
    <>
      {error && !editor && <Alert type="error" title={error} showIcon />}
      <ProTable<EquipmentType>
        rowKey="name"
        actionRef={action}
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20 }}
        request={async (params) => {
          try {
            const result = await api<List<EquipmentType>>('get_types', {
              current: params.current,
              page_size: params.pageSize,
              keyword: params.keyword,
            });
            setPermissions(result);
            setError(undefined);
            return result;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() =>
          permissions?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => open()}
                >
                  新增设备类型
                </Button>,
              ]
            : []
        }
      />
      <ModalForm
        form={form}
        title={editor?.row ? '编辑设备类型' : '新增设备类型'}
        open={Boolean(editor)}
        width={520}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
        }}
        onOpenChange={(value) => {
          if (!value && !working.current) setEditor(undefined);
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setSaving(true);
          try {
            await mutate('save_type', {
              name: editor?.row?.name,
              modified: editor?.row?.modified,
              values: valuesFor(values, fields),
            });
            message.success('设备类型已保存');
            setEditor(undefined);
            action.current?.reload();
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
        {error && <Alert type="error" title={error} showIcon />}
        {fields.includes('equipment_type_name') && (
          <ProFormText
            name="equipment_type_name"
            label="设备类型名称"
            rules={[{ required: true }]}
            fieldProps={{ maxLength: 140 }}
          />
        )}
        {fields.includes('description') && (
          <ProFormTextArea
            name="description"
            label="说明"
            fieldProps={{ maxLength: 2000 }}
          />
        )}
        {fields.includes('disabled') && (
          <ProFormSwitch
            name="disabled"
            label="停用"
            tooltip="停用后不能用于新设备归类；已有设备和治疗历史保留。"
          />
        )}
      </ModalForm>
    </>
  );
}
