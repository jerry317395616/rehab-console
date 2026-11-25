import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  type ProColumns,
  ProFormDigit,
  ProFormSwitch,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import React, { useRef, useState } from 'react';
import { errorMessage, propertiesApi, propertiesMutation } from './service';

type Category = {
  name: string;
  modified: string;
  category_name?: string;
  sort_order?: number;
  disabled?: number;
  can_edit?: boolean;
};
type Result = {
  data: Category[];
  total: number;
  success: boolean;
  read_fields: string[];
  write_fields: string[];
  can_create: boolean;
};
export default function Categories({ onChanged }: { onChanged: () => void }) {
  const [rights, setRights] = useState<Result>();
  const [editor, setEditor] = useState<{ row?: Category }>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const action = useRef<ActionType>(undefined);
  const working = useRef(false);
  const dirty = useRef(false);
  const { message, modal } = App.useApp();
  const fields = rights?.write_fields || [];
  function open(row?: Category) {
    setError(undefined);
    dirty.current = false;
    form.resetFields();
    form.setFieldsValue({
      sort_order: 0,
      ...row,
      disabled: Boolean(row?.disabled),
    });
    setEditor({ row });
  }
  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的分类修改？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setEditor(undefined),
      });
    else setEditor(undefined);
  }
  const columns: ProColumns<Category>[] = [
    { title: '分类名称', dataIndex: 'keyword', hideInTable: true },
    {
      title: '分类名称',
      dataIndex: 'category_name',
      search: false,
      hideInTable: !rights?.read_fields.includes('category_name'),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      search: false,
      width: 80,
      hideInTable: !rights?.read_fields.includes('sort_order'),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      valueType: 'select',
      valueEnum: { '0': '启用', '1': '停用' },
      hideInTable: !rights?.read_fields.includes('disabled'),
      search: rights?.read_fields.includes('disabled') ? undefined : false,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
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
      <ProTable<Category>
        actionRef={action}
        rowKey="name"
        columns={columns}
        scroll={{ x: 580 }}
        request={async ({ current, pageSize, keyword, disabled }) => {
          const result = await propertiesApi<Result>('get_categories', {
            current,
            page_size: pageSize,
            keyword,
            disabled,
          });
          setRights(result);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        toolBarRender={() =>
          rights?.can_create
            ? [
                <Button
                  key="add"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => open()}
                >
                  新增分类
                </Button>,
              ]
            : []
        }
      />
      <ModalForm
        form={form}
        title={editor?.row ? '编辑治疗分类' : '新增治疗分类'}
        open={Boolean(editor)}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
          onCancel: close,
        }}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        onValuesChange={() => {
          dirty.current = true;
          setError(undefined);
        }}
        submitter={{
          searchConfig: { submitText: '保存分类', resetText: '取消' },
          render: (_, buttons) => [
            <Button key="cancel" disabled={saving} onClick={close}>
              取消
            </Button>,
            buttons[1],
          ],
        }}
        onFinish={async (values: Record<string, unknown>) => {
          if (working.current) return false;
          working.current = true;
          setSaving(true);
          try {
            await propertiesMutation('save_category', {
              name: editor?.row?.name,
              modified: editor?.row?.modified,
              values: Object.fromEntries(
                fields
                  .filter((key) => Object.hasOwn(values, key))
                  .map((key) => [
                    key,
                    typeof values[key] === 'boolean'
                      ? Number(values[key])
                      : values[key],
                  ]),
              ),
            });
            dirty.current = false;
            setEditor(undefined);
            action.current?.reload();
            onChanged();
            message.success('治疗分类已保存');
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
        {fields.includes('category_name') && (
          <ProFormText
            name="category_name"
            label="分类名称"
            rules={[{ required: true, whitespace: true }]}
            fieldProps={{ maxLength: 60 }}
          />
        )}
        {fields.includes('sort_order') && (
          <ProFormDigit
            name="sort_order"
            label="排序"
            min={0}
            max={100000}
            fieldProps={{ precision: 0 }}
          />
        )}
        {fields.includes('disabled') && (
          <ProFormSwitch
            name="disabled"
            label="停用"
            tooltip="停用后不能用于新的分类选择，已有治疗项目保留原关联。"
          />
        )}
      </ModalForm>
    </>
  );
}
