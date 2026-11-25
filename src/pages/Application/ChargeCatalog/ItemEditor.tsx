import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Input, Tabs, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { errorMessage } from './feedback';
import PriceManager from './PriceManager';
import {
  type ChargeOptions,
  get,
  getItem,
  type ItemContext,
  type OrderItem,
  post,
  projectValues,
  searchItemOptions,
} from './service';

export type ItemEditorState =
  | { kind: 'create' }
  | { kind: 'view' | 'edit' | 'prices'; itemCode: string };
export default function ItemEditor({
  editor,
  options,
  onClose,
  onSaved,
}: {
  editor?: ItemEditorState;
  options?: ChargeOptions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [context, setContext] = useState<ItemContext>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('basic');
  const working = useRef(false);
  const changes = useRef(new Set<string>());
  const { message, modal } = App.useApp();
  useEffect(() => {
    let active = true;
    form.resetFields();
    changes.current.clear();
    setContext(undefined);
    setError(undefined);
    setLoading(Boolean(editor && editor.kind !== 'create'));
    setTab(editor?.kind === 'prices' ? 'prices' : 'basic');
    if (!editor) return;
    if (editor.kind === 'create') {
      form.setFieldsValue({ disabled: false });
      return;
    }
    getItem(editor.itemCode)
      .then((value) => {
        if (active) {
          setContext(value);
          form.setFieldsValue({
            ...value.item,
            disabled: Boolean(value.item.disabled),
          });
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
  const canSave = Boolean(
    creating
      ? options?.item.can_create
      : editor?.kind === 'edit' && context?.can_edit,
  );
  const fields = creating
    ? options?.item.write_fields || []
    : context?.write_fields || [];
  const visible = new Set(creating ? fields : context?.read_fields || []);
  const allowed = (field: string) => canSave && fields.includes(field);
  const itemCode =
    editor && editor.kind !== 'create' ? editor.itemCode : undefined;
  function close() {
    if (working.current) return;
    if (canSave && changes.current.size)
      modal.confirm({
        title: '放弃尚未保存的收费项目资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  return (
    <DrawerForm
      name="charge-item"
      form={form}
      title={
        creating
          ? '新增收费项目'
          : editor?.kind === 'edit'
            ? '编辑收费项目'
            : '收费项目详情'
      }
      open={Boolean(editor)}
      width="min(900px, 100vw)"
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
      onValuesChange={(changed) => {
        for (const key of Object.keys(changed)) changes.current.add(key);
        setError(undefined);
      }}
      submitter={
        canSave && tab === 'basic'
          ? {
              searchConfig: {
                submitText: creating ? '创建收费项目' : '保存',
                resetText: '取消',
              },
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
        if (!editor || !canSave || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const data = projectValues(
            values,
            creating
              ? fields
              : fields.filter((field) => changes.current.has(field)),
          );
          if (!creating && !Object.keys(data).length) {
            changes.current.clear();
            onClose();
            return true;
          }
          let confirmed = false;
          if (
            !creating &&
            context &&
            Object.hasOwn(data, 'disabled') &&
            data.disabled !== context.item.disabled
          ) {
            confirmed = await new Promise<boolean>((resolve) => {
              const dialog = modal.confirm({
                title: '确认收费项目状态变更',
                content: (
                  <>
                    <p>
                      变更影响后续新收费。请核对关联医嘱项目，并输入完整收费编码：
                    </p>
                    <Typography.Text>{itemCode}</Typography.Text>
                    <Input
                      autoComplete="off"
                      aria-label="确认收费编码"
                      onChange={(event) =>
                        dialog.update({
                          okButtonProps: {
                            disabled: event.target.value !== itemCode,
                          },
                        })
                      }
                    />
                  </>
                ),
                okText: '确认变更',
                cancelText: '继续编辑',
                okButtonProps: { disabled: true },
                onOk: () => {
                  resolve(true);
                },
                onCancel: () => {
                  resolve(false);
                },
              });
            });
            if (!confirmed) return false;
          }
          await post(
            'charge_catalog_api',
            creating ? 'create_item' : 'save_item',
            creating
              ? { values: data }
              : {
                  item_code: itemCode,
                  modified: context?.item.modified,
                  values: data,
                  confirm_name: confirmed ? itemCode : undefined,
                },
          );
          changes.current.clear();
          void message.success('收费项目已保存。');
          onSaved();
          onClose();
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
      <Form.Item hidden={!error} key="feedback">
        {error && (
          <Alert
            showIcon
            type="error"
            title={error}
            action={
              <Button
                size="small"
                disabled={saving}
                onClick={() => {
                  if (changes.current.size)
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
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'basic',
            label: '基本资料',
            forceRender: true,
            children: (
              <>
                {visible.has('item_code') && (
                  <ProFormText
                    name="item_code"
                    label="收费编码"
                    disabled={!creating || !allowed('item_code')}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: '请输入收费编码',
                      },
                    ]}
                    fieldProps={{ maxLength: 140 }}
                    extra="编码创建后保持不变。"
                  />
                )}
                {visible.has('item_name') && (
                  <ProFormText
                    name="item_name"
                    label="收费项目名称"
                    disabled={!allowed('item_name')}
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: '请输入项目名称',
                      },
                    ]}
                    fieldProps={{ maxLength: 140 }}
                  />
                )}
                {visible.has('item_group') && (
                  <ProFormSelect
                    name="item_group"
                    label="项目分组"
                    disabled={!allowed('item_group')}
                    showSearch
                    debounceTime={300}
                    request={async ({ keyWords }) =>
                      searchItemOptions(
                        'item_group',
                        keyWords || form.getFieldValue('item_group') || '',
                      )
                    }
                    fieldProps={{ filterOption: false }}
                    rules={[{ required: true, message: '请选择分组' }]}
                  />
                )}
                {visible.has('stock_uom') && (
                  <ProFormSelect
                    name="stock_uom"
                    label="基本计价单位"
                    disabled={!creating || !allowed('stock_uom')}
                    showSearch
                    debounceTime={300}
                    request={async ({ keyWords }) =>
                      searchItemOptions(
                        'stock_uom',
                        keyWords || form.getFieldValue('stock_uom') || '',
                      )
                    }
                    fieldProps={{ filterOption: false }}
                    rules={[{ required: true, message: '请选择单位' }]}
                  />
                )}
                {visible.has('description') && (
                  <ProFormTextArea
                    name="description"
                    label="项目说明"
                    disabled={!allowed('description')}
                    fieldProps={{
                      maxLength: 10000,
                      autoSize: { minRows: 3, maxRows: 8 },
                    }}
                  />
                )}
                {visible.has('disabled') && (
                  <ProFormSwitch
                    name="disabled"
                    label="停用"
                    disabled={!allowed('disabled')}
                  />
                )}
              </>
            ),
          },
          ...(!creating && itemCode && options?.price.can_read
            ? [
                {
                  key: 'prices',
                  label: '价格记录',
                  children: (
                    <PriceManager
                      itemCode={itemCode}
                      capabilities={options.price}
                    />
                  ),
                },
              ]
            : []),
          ...(!creating && itemCode && options?.can_read_order_items
            ? [
                {
                  key: 'schemes',
                  label: '关联医嘱项目',
                  children: (
                    <ProTable<OrderItem>
                      rowKey="name"
                      search={false}
                      options={false}
                      params={{ item_code: itemCode }}
                      request={async (params) =>
                        get('order_item_charges', 'get_references', {
                          item_code: itemCode,
                          current: params.current,
                          page_size: params.pageSize,
                        })
                      }
                      pagination={{ defaultPageSize: 10 }}
                      columns={[
                        { title: '医嘱项目编码', dataIndex: 'name' },
                        { title: '名称', dataIndex: 'item_name' },
                        {
                          title: '状态',
                          dataIndex: 'disabled',
                          valueEnum: { 0: '启用', 1: '停用' },
                        },
                      ]}
                      onRequestError={(reason) =>
                        setError(errorMessage(reason))
                      }
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
    </DrawerForm>
  );
}
