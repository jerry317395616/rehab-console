import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  type ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import React, { useRef, useState } from 'react';
import { errorMessage } from './feedback';
import { get, post, projectValues } from './service';

export type DictionaryKind = 'type' | 'category';
export type DictionaryOption = {
  value: string;
  label: string;
  disabled?: boolean;
};
export type DictionaryRights = {
  can_read: boolean;
  can_create: boolean;
  read_fields: string[];
  write_fields: string[];
};
export type ClassificationOptions = Record<DictionaryKind, DictionaryRights>;
type Entry = {
  name: string;
  modified: string;
  code?: string;
  type_name?: string;
  category_name?: string;
  order_type?: string;
  business_kind?: string;
  sort_order?: number;
  disabled?: number;
  can_edit: boolean;
  can_delete: boolean;
};
export function dictionaryOptions(
  kind: DictionaryKind,
  params: Record<string, unknown> = {},
) {
  const { keyWords, revision: _revision, ...query } = params;
  return get<DictionaryOption[]>('order_classification', 'link_options', {
    kind,
    ...query,
    keyword: keyWords,
  });
}
export default function OrderDictionaries({
  kind,
  rights,
  canReadTypes,
  onChanged,
}: {
  kind: DictionaryKind;
  rights: DictionaryRights;
  canReadTypes: boolean;
  onChanged: () => void;
}) {
  const label = kind === 'type' ? '医嘱类型' : '医嘱分类';
  const nameField = kind === 'type' ? 'type_name' : 'category_name';
  const action = useRef<ActionType>(undefined);
  const [form] = Form.useForm();
  const [editor, setEditor] = useState<{ row?: Entry }>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  const working = useRef(false);
  const { modal, message } = App.useApp();
  const writable = (field: string) => rights.write_fields.includes(field);
  const readable = (field: string) => rights.read_fields.includes(field);
  function open(row?: Entry) {
    form.resetFields();
    form.setFieldsValue({
      sort_order: 0,
      ...row,
      disabled: Boolean(row?.disabled),
    });
    setError(undefined);
    dirty.current = false;
    setEditor({ row });
  }
  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: `放弃尚未保存的${label}修改？`,
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setEditor(undefined),
      });
    else setEditor(undefined);
  }
  const columns: ProColumns<Entry>[] = [
    { title: '编码或名称', dataIndex: 'keyword', hideInTable: true },
    { title: '编码', dataIndex: 'name', search: false },
    {
      title: `${label}名称`,
      dataIndex: nameField,
      search: false,
      hideInTable: !readable(nameField),
    },
    ...(kind === 'type'
      ? [
          {
            title: '业务性质',
            dataIndex: 'business_kind',
            search: false,
            hideInTable: !readable('business_kind'),
            valueEnum: { Treatment: '治疗', Assessment: '评估' },
          },
        ]
      : [
          {
            title: '所属医嘱类型',
            dataIndex: 'order_type',
            valueType: 'select' as const,
            hideInTable: !readable('order_type'),
            search: canReadTypes && readable('order_type') ? undefined : false,
            fieldProps: { showSearch: { filterOption: false } },
            request: (params: Record<string, unknown>) =>
              dictionaryOptions('type', { ...params, include_disabled: 1 }),
          },
        ]),
    {
      title: '排序',
      dataIndex: 'sort_order',
      search: false,
      hideInTable: !readable('sort_order'),
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      valueType: 'select',
      valueEnum: { '0': '启用', '1': '停用' },
      hideInTable: !readable('disabled'),
      search: readable('disabled') ? undefined : false,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => [
        row.can_edit && (
          <Button key="edit" type="link" onClick={() => open(row)}>
            编辑
          </Button>
        ),
        row.can_delete && (
          <Button
            key="delete"
            type="link"
            danger
            onClick={() =>
              modal.confirm({
                title: `删除${label} ${row.name}？`,
                content: '已被引用的字典不能删除，可改为停用。',
                okText: '删除',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: async () => {
                  try {
                    await post('order_classification', 'delete_entry', {
                      kind,
                      name: row.name,
                      modified: row.modified,
                    });
                    action.current?.reload();
                    onChanged();
                    message.success(`${label}已删除`);
                  } catch (reason) {
                    message.error(errorMessage(reason));
                    throw reason;
                  }
                },
              })
            }
          >
            删除
          </Button>
        ),
      ],
    },
  ];
  return (
    <>
      {error && !editor && <Alert type="error" title={error} showIcon />}
      <ProTable<Entry>
        form={{ name: `order-${kind}-search` }}
        rowKey="name"
        actionRef={action}
        columns={columns}
        scroll={{ x: 850 }}
        request={(params) =>
          get('order_classification', 'get_entries', {
            ...params,
            kind,
            page_size: params.pageSize,
            pageSize: undefined,
          })
        }
        onRequestError={(reason) => setError(errorMessage(reason))}
        toolBarRender={() =>
          rights.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => open()}
                >
                  新增{label}
                </Button>,
              ]
            : []
        }
      />
      <ModalForm
        name={`order-${kind}-editor`}
        form={form}
        title={`${editor?.row ? '编辑' : '新增'}${label}`}
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
          searchConfig: { submitText: '保存', resetText: '取消' },
          render: (_, buttons) => [
            <Button key="cancel" disabled={saving} onClick={close}>
              取消
            </Button>,
            buttons[1],
          ],
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setSaving(true);
          try {
            await post('order_classification', 'save_entry', {
              kind,
              name: editor?.row?.name,
              modified: editor?.row?.modified,
              values: projectValues(values, rights.write_fields),
            });
            dirty.current = false;
            setEditor(undefined);
            action.current?.reload();
            onChanged();
            message.success(`${label}已保存`);
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
        {readable('code') && (
          <ProFormText
            name="code"
            label="编码"
            disabled={Boolean(editor?.row) || !writable('code')}
            rules={[{ required: true, whitespace: true }]}
            fieldProps={{ maxLength: 40 }}
          />
        )}
        {readable(nameField) && (
          <ProFormText
            name={nameField}
            label={`${label}名称`}
            disabled={!writable(nameField)}
            rules={[{ required: true, whitespace: true }]}
            fieldProps={{ maxLength: 140 }}
          />
        )}
        {kind === 'type' && readable('business_kind') && (
          <ProFormSelect
            name="business_kind"
            label="业务性质"
            tooltip="治疗用于治疗医嘱；评估仍从评估模板开立。被引用后不可更改。"
            disabled={!writable('business_kind')}
            options={[
              { value: 'Treatment', label: '治疗' },
              { value: 'Assessment', label: '评估' },
            ]}
            rules={[{ required: true }]}
          />
        )}
        {kind === 'category' && readable('order_type') && (
          <ProFormSelect
            name="order_type"
            label="所属医嘱类型"
            disabled={!writable('order_type') || !canReadTypes}
            params={{ current: editor?.row?.order_type }}
            request={(params) => dictionaryOptions('type', params)}
            fieldProps={{ showSearch: { filterOption: false } }}
            rules={[{ required: true }]}
          />
        )}
        {readable('sort_order') && (
          <ProFormDigit
            name="sort_order"
            label="排序"
            disabled={!writable('sort_order')}
            min={0}
            max={1000000}
            fieldProps={{ precision: 0 }}
          />
        )}
        {readable('disabled') && (
          <ProFormSwitch
            name="disabled"
            label="停用"
            disabled={!writable('disabled')}
          />
        )}
      </ModalForm>
    </>
  );
}
