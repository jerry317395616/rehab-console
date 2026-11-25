import {
  DrawerForm,
  type EditableFormInstance,
  EditableProTable,
  type ProColumns,
  ProFormDatePicker,
  ProFormSelect,
  ProFormSwitch,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { errorMessage } from './feedback';
import {
  type ChargeLine,
  getScheme,
  post,
  type Scheme,
  searchSchemeOptions,
} from './service';

export type SchemeEditorState =
  | { kind: 'create'; orderItem?: string; copy?: Scheme }
  | { kind: 'view' | 'edit'; name: string };
export default function SchemeEditor({
  editor,
  onClose,
  onSaved,
}: {
  editor?: SchemeEditorState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const { modal, message } = App.useApp();
  const [context, setContext] = useState<{
    scheme: Scheme;
    can_edit: boolean;
    can_publish: boolean;
  }>();
  const [rows, setRows] = useState<ChargeLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const tableForm = useRef<EditableFormInstance<ChargeLine>>(undefined);
  const unitByItem = useRef(new Map<string, string>());
  const dirty = useRef(false);
  const working = useRef(false);
  useEffect(() => {
    let active = true;
    form.resetFields();
    setRows([]);
    setContext(undefined);
    setError(undefined);
    dirty.current = false;
    if (!editor) return;
    if (editor.kind === 'create') {
      const copy = editor.copy;
      form.setFieldsValue({
        order_item: editor.orderItem || copy?.order_item,
        company: copy?.company,
        valid_from: dayjs().format('YYYY-MM-DD'),
        enabled: true,
      });
      setRows(
        copy?.lines?.map((row) => ({ ...row, _key: crypto.randomUUID() })) ||
          [],
      );
      return;
    }
    setLoading(true);
    getScheme(editor.name)
      .then((value) => {
        if (active) {
          setContext(value);
          form.setFieldsValue({
            ...value.scheme,
            enabled: Boolean(value.scheme.enabled),
            change_reason: '',
          });
          setRows(
            (value.scheme.lines || []).map((row) => ({
              ...row,
              _key: crypto.randomUUID(),
            })),
          );
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editor, attempt, form]);
  const creating = editor?.kind === 'create';
  const published = Boolean(context?.scheme.docstatus);
  const canEdit =
    creating || Boolean(editor?.kind === 'edit' && context?.can_edit);
  function close() {
    if (working.current) return;
    if (canEdit && dirty.current)
      modal.confirm({
        title: '放弃尚未保存的收费关联方案？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  function removeRow(key: string) {
    setRows((values) => values.filter((value) => value._key !== key));
    dirty.current = true;
  }
  function updateRows(values: readonly ChargeLine[]) {
    const edited = new Map(values.map((row) => [row._key, row]));
    setRows((current) =>
      current.map((row) => ({ ...row, ...edited.get(row._key) })),
    );
    dirty.current = true;
  }
  const columns: ProColumns<ChargeLine>[] = [
    {
      title: '收费项目',
      dataIndex: 'item_code',
      valueType: 'select',
      width: 250,
      request: async ({ keyWords }) => {
        const options = await searchSchemeOptions('item_code', keyWords || '');
        for (const option of options) {
          if (option.uom) unitByItem.current.set(option.value, option.uom);
        }
        return options;
      },
      fieldProps: { showSearch: true, filterOption: false },
      formItemProps: { rules: [{ required: true, message: '请选择收费项目' }] },
    },
    {
      title: '计价单位',
      dataIndex: 'uom',
      editable: false,
      width: 100,
      render: (_, row) =>
        unitByItem.current.get(row.item_code || '') || row.uom,
    },
    {
      title: '默认数量',
      dataIndex: 'default_qty',
      valueType: 'digit',
      fieldProps: { min: 0.000001 },
      width: 110,
      formItemProps: { rules: [{ required: true, message: '请输入数量' }] },
    },
    {
      title: '数量依据',
      dataIndex: 'quantity_mode',
      valueType: 'select',
      valueEnum: { Fixed: '固定数量', Actual: '按本次实际数量' },
      width: 150,
      formItemProps: { rules: [{ required: true }] },
    },
    {
      title: '计费属性',
      dataIndex: 'requirement',
      valueType: 'select',
      valueEnum: { Required: '必选项', Optional: '按实际选用' },
      width: 140,
      formItemProps: { rules: [{ required: true }] },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: { 0: '停用', 1: '启用' },
      fieldProps: {
        options: [
          { value: 0, label: '停用' },
          { value: 1, label: '启用' },
        ],
      },
      width: 100,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      hideInTable: !canEdit || published,
    },
  ];
  return (
    <DrawerForm
      name="charge-scheme"
      form={form}
      title={
        creating
          ? '新增收费关联方案版本'
          : published
            ? '已发布收费关联方案'
            : '收费关联方案草稿'
      }
      open={Boolean(editor)}
      width="min(1120px, 100vw)"
      loading={loading}
      drawerProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onValuesChange={() => {
        dirty.current = true;
        setError(undefined);
      }}
      submitter={
        canEdit
          ? {
              searchConfig: { submitText: '保存方案', resetText: '取消' },
              render: (_, buttons) => [
                <Button key="cancel" disabled={saving} onClick={close}>
                  取消
                </Button>,
                buttons[1],
              ],
            }
          : { render: () => <Button onClick={close}>关闭</Button> }
      }
      onFinish={async (values) => {
        if (!editor || !canEdit || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          if (!published) await tableForm.current?.validateFields();
          const data = {
            valid_upto: values.valid_upto || null,
            enabled: Number(Boolean(values.enabled)),
            change_reason: values.change_reason,
            ...(!published
              ? {
                  order_item: values.order_item,
                  company: values.company,
                  valid_from: values.valid_from,
                  lines: rows.map((row) => {
                    const current = {
                      ...row,
                      ...tableForm.current?.getRowData?.(row._key),
                    };
                    return {
                      item_code: current.item_code,
                      default_qty: current.default_qty,
                      quantity_mode: current.quantity_mode,
                      requirement: current.requirement,
                      enabled: Number(current.enabled),
                    };
                  }),
                }
              : {}),
          };
          await post('charge_scheme', 'save_scheme', {
            name: context?.scheme.name,
            modified: context?.scheme.modified,
            values: data,
          });
          dirty.current = false;
          onSaved();
          onClose();
          void message.success('收费关联方案已保存。');
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
      <Form.Item key="feedback" hidden={!error}>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={
              <Button
                size="small"
                disabled={saving}
                onClick={() => {
                  if (dirty.current)
                    modal.confirm({
                      title: '重新加载会丢弃当前编辑，是否继续？',
                      okText: '重新加载',
                      cancelText: '继续编辑',
                      onOk: () => setAttempt((value) => value + 1),
                    });
                  else setAttempt((value) => value + 1);
                }}
              >
                重新加载
              </Button>
            }
          />
        )}
      </Form.Item>
      {published && (
        <Alert
          type="info"
          showIcon
          title="已发布明细保持不变。可调整后续有效期或停用，新关联内容请新增版本。"
          style={{ marginBottom: 16 }}
        />
      )}
      <ProFormSelect
        name="order_item"
        label="康复医嘱项目"
        disabled={
          !canEdit ||
          published ||
          Boolean(editor?.kind === 'create' && editor.orderItem) ||
          Boolean(context)
        }
        showSearch
        request={async ({ keyWords }) =>
          searchSchemeOptions(
            'order_item',
            keyWords || form.getFieldValue('order_item') || '',
          )
        }
        fieldProps={{ filterOption: false }}
        rules={[{ required: true, message: '请选择医嘱项目' }]}
      />
      <ProFormSelect
        name="company"
        label="适用机构"
        disabled={!canEdit || published || Boolean(context)}
        showSearch
        request={async ({ keyWords }) =>
          searchSchemeOptions(
            'company',
            keyWords || form.getFieldValue('company') || '',
          )
        }
        fieldProps={{ filterOption: false }}
        rules={[{ required: true, message: '请选择机构' }]}
      />
      <ProFormDatePicker
        name="valid_from"
        label="生效日期"
        disabled={!canEdit || published}
        rules={[{ required: true, message: '请选择日期' }]}
      />
      <ProFormDatePicker
        name="valid_upto"
        label="截止日期"
        disabled={!canEdit}
      />
      <ProFormSwitch name="enabled" label="启用方案" disabled={!canEdit} />
      <ProFormTextArea
        name="change_reason"
        label="配置或变更说明"
        disabled={!canEdit}
        rules={[
          { required: true, whitespace: true, message: '请填写本次变更说明' },
        ]}
        fieldProps={{ maxLength: 2000 }}
      />
      <Form.Item label="关联收费项目" required>
        <EditableProTable<ChargeLine>
          rowKey="_key"
          value={rows}
          onChange={updateRows}
          onValuesChange={updateRows}
          editableFormRef={tableForm}
          columns={columns}
          search={false}
          options={false}
          pagination={false}
          scroll={{ x: 950 }}
          maxLength={100}
          toolBarRender={() =>
            canEdit && !published
              ? [
                  <Button
                    key="add"
                    disabled={rows.length >= 100}
                    onClick={() => {
                      setRows((values) => [
                        ...values,
                        {
                          _key: crypto.randomUUID(),
                          default_qty: 1,
                          quantity_mode: 'Fixed',
                          requirement: 'Required',
                          enabled: 1,
                        },
                      ]);
                      dirty.current = true;
                    }}
                  >
                    添加收费项目
                  </Button>,
                ]
              : []
          }
          editable={
            canEdit && !published
              ? {
                  type: 'multiple',
                  editableKeys: rows.map((row) => row._key),
                  actionRender: (row) => [
                    <Button
                      key="remove"
                      type="link"
                      danger
                      onClick={() => removeRow(row._key)}
                    >
                      移除
                    </Button>,
                  ],
                }
              : { editableKeys: [] }
          }
          recordCreatorProps={false}
        />
      </Form.Item>
    </DrawerForm>
  );
}
