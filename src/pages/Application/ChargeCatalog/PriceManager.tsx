import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import React, { useRef, useState } from 'react';
import { errorMessage } from './feedback';
import {
  type Capability,
  getPrices,
  type Price,
  post,
  projectValues,
  searchPriceOptions,
} from './service';

type PriceAction =
  | { kind: 'create' }
  | { kind: 'edit' | 'change'; price: Price };
export default function PriceManager({
  itemCode,
  capabilities,
}: {
  itemCode: string;
  capabilities: Capability;
}) {
  const actionRef = useRef<ActionType>(undefined);
  const [action, setAction] = useState<PriceAction>();
  const [error, setError] = useState<string>();
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const dirty = useRef(false);
  const working = useRef(false);
  const [saving, setSaving] = useState(false);
  function open(value: PriceAction) {
    form.resetFields();
    if (value.kind !== 'create') form.setFieldsValue(value.price);
    setAction(value);
    setError(undefined);
    dirty.current = false;
  }
  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的价格资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setAction(undefined),
      });
    else setAction(undefined);
  }
  const readable = new Set(capabilities.read_fields);
  const change = action?.kind === 'change';
  return (
    <>
      <ProTable<Price>
        rowKey="name"
        actionRef={actionRef}
        headerTitle="价格记录"
        search={false}
        options={false}
        params={{ item_code: itemCode }}
        request={(params) => getPrices(itemCode, params)}
        pagination={{ defaultPageSize: 10 }}
        scroll={{ x: 900 }}
        columns={[
          {
            title: '价目表',
            dataIndex: 'price_list',
            hideInTable: !readable.has('price_list'),
          },
          {
            title: '计价单位',
            dataIndex: 'uom',
            hideInTable: !readable.has('uom'),
          },
          {
            title: '币种',
            dataIndex: 'currency',
            hideInTable: !readable.has('currency'),
          },
          {
            title: '单价',
            dataIndex: 'price_list_rate',
            valueType: 'digit',
            hideInTable: !readable.has('price_list_rate'),
          },
          {
            title: '生效日期',
            dataIndex: 'valid_from',
            hideInTable: !readable.has('valid_from'),
          },
          {
            title: '截止日期',
            dataIndex: 'valid_upto',
            hideInTable: !readable.has('valid_upto'),
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, row) => [
              row.can_edit && (
                <Button
                  key="edit"
                  type="link"
                  onClick={() => open({ kind: 'edit', price: row })}
                >
                  编辑
                </Button>
              ),
              row.can_change && capabilities.can_create && (
                <Button
                  key="change"
                  type="link"
                  onClick={() => open({ kind: 'change', price: row })}
                >
                  调价
                </Button>
              ),
            ],
          },
        ]}
        toolBarRender={() =>
          capabilities.can_create
            ? [
                <Button
                  key="create"
                  icon={<PlusOutlined />}
                  onClick={() => open({ kind: 'create' })}
                >
                  新增价格
                </Button>,
              ]
            : []
        }
        onRequestError={(reason) => setError(errorMessage(reason))}
      />
      {!action && error && <Alert type="error" showIcon title={error} />}
      <ModalForm
        name="charge-price"
        title={
          change
            ? '调价并保留历史'
            : action?.kind === 'edit'
              ? '编辑未生效价格'
              : '新增收费价格'
        }
        open={Boolean(action)}
        form={form}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
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
          if (!action || working.current) return false;
          working.current = true;
          setSaving(true);
          setError(undefined);
          try {
            if (action.kind === 'change')
              await post('charge_price_api', 'change_price', {
                name: action.price.name,
                modified: action.price.modified,
                rate: values.rate,
                valid_from: values.valid_from,
                reason: values.reason,
                confirm_name: values.confirm_name,
              });
            else {
              const data = projectValues(
                values,
                capabilities.write_fields.filter(
                  (field) => !['currency', 'item_code'].includes(field),
                ),
              );
              await post(
                'charge_price_api',
                action.kind === 'create' ? 'create_price' : 'save_price',
                action.kind === 'create'
                  ? { item_code: itemCode, values: data }
                  : {
                      name: action.price.name,
                      modified: action.price.modified,
                      values: data,
                    },
              );
            }
            dirty.current = false;
            setAction(undefined);
            void message.success('收费价格已保存。');
            void actionRef.current?.reload();
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
        <Form.Item hidden={!error}>
          {error && <Alert showIcon type="error" title={error} />}
        </Form.Item>
        {change ? (
          <>
            <Alert
              type="info"
              showIcon
              title="原价格将保留，并在新价格生效前一天截止。"
              style={{ marginBottom: 16 }}
            />
            <ProFormDigit
              name="rate"
              label="新价格"
              min={0}
              rules={[{ required: true, message: '请明确填写价格' }]}
            />
            <ProFormDatePicker
              name="valid_from"
              label="新价格生效日期"
              rules={[{ required: true, message: '请选择日期' }]}
            />
            <ProFormTextArea
              name="reason"
              label="调价原因"
              rules={[
                { required: true, whitespace: true, message: '请填写原因' },
              ]}
              fieldProps={{ maxLength: 2000 }}
            />
            <ProFormText
              name="confirm_name"
              label="输入完整收费编码以确认"
              rules={[
                {
                  validator: (_, value) =>
                    value === itemCode
                      ? Promise.resolve()
                      : Promise.reject(new Error('收费编码不一致')),
                },
              ]}
            />
          </>
        ) : (
          <>
            <ProFormSelect
              name="price_list"
              label="销售价目表"
              showSearch
              debounceTime={300}
              request={async ({ keyWords }) =>
                searchPriceOptions(
                  'price_list',
                  keyWords || form.getFieldValue('price_list') || '',
                  itemCode,
                )
              }
              fieldProps={{ filterOption: false }}
              rules={[{ required: true, message: '请选择价目表' }]}
              extra="币种由价目表确定。"
            />
            <ProFormSelect
              name="uom"
              label="计价单位"
              showSearch
              request={async () => searchPriceOptions('uom', '', itemCode)}
              rules={[{ required: true, message: '请选择计价单位' }]}
            />
            <ProFormDigit
              name="price_list_rate"
              label="单价"
              min={0}
              rules={[{ required: true, message: '请明确填写价格' }]}
            />
            <ProFormDatePicker
              name="valid_from"
              label="生效日期"
              rules={[{ required: true, message: '请选择日期' }]}
            />
            <ProFormDatePicker name="valid_upto" label="截止日期" />
            <ProFormTextArea
              name="note"
              label="说明"
              fieldProps={{ maxLength: 2000 }}
            />
          </>
        )}
      </ModalForm>
    </>
  );
}
