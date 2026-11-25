import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ProFormDigit,
  type ProFormInstance,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Grid, Input, Result, Tabs } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import TreatmentLookup from '../TherapyCatalog/TreatmentLookup';
import { errorMessage } from './feedback';
import OrderDictionaries, {
  type ClassificationOptions,
  dictionaryOptions,
} from './OrderDictionaries';
import OrderItemCharges, { type ChargesHandle } from './OrderItemCharges';
import SchemeList from './SchemeList';
import {
  get,
  getOrderItem,
  getOrderItems,
  type OrderItem,
  post,
  projectValues,
} from './service';

type OrderOptions = {
  can_create: boolean;
  read_fields: string[];
  write_fields: string[];
  charge_read_fields: string[];
  charge_write_fields: string[];
  can_select_items: boolean;
  can_read_prices: boolean;
};
type Editor =
  | { kind: 'create' }
  | { kind: 'view' | 'edit' | 'schemes'; name: string };
export default function OrderManagement() {
  const [classification, setClassification] = useState<ClassificationOptions>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    get<ClassificationOptions>('order_classification', 'get_options')
      .then((value) => {
        if (active) setClassification(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      <Tabs
        items={[
          {
            key: 'items',
            label: '医嘱项目',
            children: (
              <OrderCatalog
                classification={classification}
                revision={revision}
              />
            ),
          },
          ...(['type', 'category'] as const)
            .filter((kind) => classification?.[kind].can_read)
            .map((kind) => ({
              key: kind,
              label: kind === 'type' ? '医嘱类型' : '医嘱分类',
              children: classification && (
                <OrderDictionaries
                  kind={kind}
                  rights={classification[kind]}
                  canReadTypes={classification.type.can_read}
                  onChanged={() => setRevision((value) => value + 1)}
                />
              ),
            })),
        ]}
      />
    </>
  );
}
function OrderCatalog({
  classification,
  revision,
}: {
  classification?: ClassificationOptions;
  revision: number;
}) {
  const actionRef = useRef<ActionType>(undefined);
  const searchForm = useRef<ProFormInstance>(undefined);
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<OrderOptions>();
  const [editor, setEditor] = useState<Editor>();
  const [error, setError] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('basic');
  const [context, setContext] =
    useState<Awaited<ReturnType<typeof getOrderItem>>>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [form] = Form.useForm();
  const selectedType = Form.useWatch('order_type', form);
  const selectedCategory = Form.useWatch('order_category', form);
  const { message, modal } = App.useApp();
  const dirty = useRef(false);
  const working = useRef(false);
  const chargesRef = useRef<ChargesHandle>(null);
  const chargesDirty = useRef(false);
  useEffect(() => {
    let active = true;
    get<OrderOptions>('charge_order_item', 'get_options')
      .then((value) => {
        if (active) setOptions(value);
      })
      .catch((reason) => {
        if (active) {
          setError(errorMessage(reason));
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    form.resetFields();
    setContext(undefined);
    setError(undefined);
    dirty.current = false;
    chargesDirty.current = false;
    setTab(editor?.kind === 'schemes' ? 'schemes' : 'basic');
    if (!editor) return;
    if (editor.kind === 'create') {
      form.setFieldsValue({ default_sessions: 1, disabled: false });
      return;
    }
    setLoading(true);
    getOrderItem(editor.name)
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
      ? options?.can_create
      : (editor?.kind === 'edit' || editor?.kind === 'schemes') &&
          context?.can_edit,
  );
  const fields = creating
    ? options?.write_fields || []
    : context?.write_fields || [];
  const readable = new Set(options?.read_fields || []);
  const visible = new Set(creating ? fields : context?.read_fields || []);
  const allowed = (field: string) => canSave && fields.includes(field);
  const chargeContext = creating ? options : context;
  const chargeFields = chargeContext?.charge_read_fields || [];
  const canEditCharges =
    allowed('charge_items') &&
    chargeContext?.can_select_items &&
    [
      'item_code',
      'default_qty',
      'quantity_mode',
      'requirement',
      'enabled',
    ].every((field) => chargeContext.charge_write_fields.includes(field));
  function close() {
    if (working.current) return;
    if (canSave && dirty.current)
      modal.confirm({
        title: '放弃尚未保存的医嘱项目资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setEditor(undefined),
      });
    else setEditor(undefined);
  }
  if (failed)
    return (
      <Result
        status="403"
        title={error || '当前账号没有康复医嘱项目查看权限'}
        extra={
          <Button
            onClick={() => {
              setFailed(false);
              setError(undefined);
              void actionRef.current?.reload();
            }}
          >
            重新加载
          </Button>
        }
      />
    );
  return (
    <>
      {!editor && error && <Alert showIcon type="error" title={error} />}
      <ProTable<OrderItem>
        rowKey="name"
        actionRef={actionRef}
        formRef={searchForm}
        form={{
          name: 'order-item-search',
          onValuesChange: (changed) => {
            if (Object.hasOwn(changed, 'order_type'))
              searchForm.current?.setFieldsValue({ order_category: undefined });
          },
        }}
        headerTitle="康复医嘱项目"
        request={getOrderItems}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1100 }}
        columns={[
          {
            title: '编码或名称',
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { placeholder: '医嘱项目编码或名称', maxLength: 120 },
          },
          { title: '编码', dataIndex: 'name', search: false, width: 170 },
          {
            title: '医嘱项目名称',
            dataIndex: 'item_name',
            search: false,
            hideInTable: !readable.has('item_name'),
            width: 220,
          },
          ...(['order_type', 'order_category'] as const).map((field) => ({
            title: field === 'order_type' ? '医嘱类型' : '医嘱分类',
            dataIndex: field,
            valueType: 'select' as const,
            hideInTable: !readable.has(field),
            search:
              readable.has(field) &&
              classification?.[field === 'order_type' ? 'type' : 'category']
                .can_read
                ? undefined
                : false,
            dependencies:
              field === 'order_category' ? ['order_type'] : undefined,
            params: { revision },
            fieldProps: { showSearch: { filterOption: false } },
            request: async (params: Record<string, unknown>) => [
              { value: '__unset__', label: '未设置' },
              ...(field === 'order_category' &&
              (!params.order_type || params.order_type === '__unset__')
                ? []
                : await dictionaryOptions(
                    field === 'order_type' ? 'type' : 'category',
                    {
                      order_type: params.order_type,
                      keyWords: params.keyWords,
                      include_disabled: 1,
                    },
                  )),
            ],
            render: (_: unknown, row: OrderItem) =>
              row[`${field}_label`] || row[field] || '未设置',
          })),
          {
            title: '默认期限',
            dataIndex: 'order_term',
            search: false,
            hideInTable: !readable.has('order_term'),
            valueEnum: { 'Long Term': '长期', Temporary: '临时' },
          },
          {
            title: '默认次数',
            dataIndex: 'default_sessions',
            search: false,
            hideInTable: !readable.has('default_sessions'),
          },
          {
            title: '启用收费项',
            dataIndex: 'charge_count',
            search: false,
            width: 120,
            hideInTable:
              !readable.has('charge_items') ||
              !options?.charge_read_fields.includes('enabled'),
            render: (_, row) =>
              row.charge_count === null
                ? '旧方案'
                : row.charge_count === 0
                  ? '未配置'
                  : row.charge_count,
          },
          {
            title: '更新时间',
            dataIndex: 'modified',
            valueType: 'dateTime',
            search: false,
            width: 170,
          },
          {
            title: '状态',
            dataIndex: 'disabled',
            valueType: 'select',
            search: readable.has('disabled') ? undefined : false,
            hideInTable: !readable.has('disabled'),
            valueEnum: {
              0: { text: '启用', status: 'Success' },
              1: { text: '停用', status: 'Default' },
            },
          },
          {
            title: '操作',
            valueType: 'option',
            fixed: screens.md ? 'right' : undefined,
            width: 230,
            render: (_, row) => [
              <Button
                key="view"
                type="link"
                onClick={() => setEditor({ kind: 'view', name: row.name })}
              >
                查看
              </Button>,
              row.can_edit && (
                <Button
                  key="edit"
                  type="link"
                  onClick={() => setEditor({ kind: 'edit', name: row.name })}
                >
                  编辑
                </Button>
              ),
              readable.has('charge_items') && (
                <Button
                  key="schemes"
                  type="link"
                  onClick={() => setEditor({ kind: 'schemes', name: row.name })}
                >
                  收费关联
                </Button>
              ),
            ],
          },
        ]}
        toolBarRender={() =>
          options?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({ kind: 'create' })}
                >
                  新增医嘱项目
                </Button>,
              ]
            : []
        }
        onRequestError={(reason) => {
          setError(errorMessage(reason));
          setFailed(true);
        }}
      />
      <DrawerForm
        name="charge-order-item"
        title={creating ? '新增康复医嘱项目' : '康复医嘱项目详情'}
        form={form}
        open={Boolean(editor)}
        width="min(1000px, 100vw)"
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
          canSave && tab !== 'history' && tab !== 'legacy'
            ? {
                searchConfig: { submitText: '保存医嘱项目', resetText: '取消' },
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
          if (!canSave || working.current) return false;
          working.current = true;
          setSaving(true);
          setError(undefined);
          try {
            const data = projectValues(values, fields);
            for (const field of ['order_type', 'order_category']) {
              if (fields.includes(field) && Object.hasOwn(values, field))
                data[field] = values[field] || '';
            }
            if (context && data.disabled !== context.item.disabled) {
              const accepted = await new Promise<boolean>((resolve) => {
                const dialog = modal.confirm({
                  title: '确认医嘱项目状态变更',
                  content: (
                    <>
                      <p>请输入完整医嘱项目编码：{context.item.name}</p>
                      <Input
                        aria-label="确认医嘱项目编码"
                        onChange={(event) =>
                          dialog.update({
                            okButtonProps: {
                              disabled:
                                event.target.value !== context.item.name,
                            },
                          })
                        }
                      />
                    </>
                  ),
                  okButtonProps: { disabled: true },
                  okText: '确认变更',
                  cancelText: '继续编辑',
                  onOk: () => {
                    resolve(true);
                  },
                  onCancel: () => {
                    resolve(false);
                  },
                });
              });
              if (!accepted) return false;
            }
            if (chargesDirty.current && canEditCharges) {
              const rows = await chargesRef.current?.values();
              data.charge_items = (rows || []).map(
                ({ _key, uom, ...row }) => row,
              );
            }
            await post('charge_order_item', 'save_order_item', {
              name: context?.item.name,
              modified: context?.item.modified,
              values: data,
              confirm_name: context?.item.name,
            });
            dirty.current = false;
            setEditor(undefined);
            void actionRef.current?.reload();
            void message.success('康复医嘱项目已保存。');
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
              showIcon
              type="error"
              title={error}
              action={
                <Button
                  disabled={saving}
                  size="small"
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
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            ...(!creating && context?.can_read_treatments
              ? [
                  {
                    key: 'treatments',
                    label: '可用治疗项目',
                    children: <TreatmentLookup orderItem={context.item.name} />,
                  },
                ]
              : []),
            {
              key: 'basic',
              label: '医嘱项目资料',
              forceRender: true,
              children: (
                <>
                  {visible.has('code') && (
                    <ProFormText
                      name="code"
                      label="医嘱项目编码"
                      disabled={!creating || !allowed('code')}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: '请输入编码',
                        },
                      ]}
                      fieldProps={{ maxLength: 40 }}
                    />
                  )}
                  {visible.has('item_name') && (
                    <ProFormText
                      name="item_name"
                      label="医嘱项目名称"
                      disabled={!allowed('item_name')}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: '请输入名称',
                        },
                      ]}
                      fieldProps={{ maxLength: 140 }}
                    />
                  )}
                  {(['order_type', 'order_category'] as const).map(
                    (field) =>
                      visible.has(field) && (
                        <ProFormSelect
                          key={field}
                          name={field}
                          label={
                            field === 'order_type' ? '医嘱类型' : '医嘱分类'
                          }
                          disabled={
                            !allowed(field) ||
                            !classification?.[
                              field === 'order_type' ? 'type' : 'category'
                            ].can_read ||
                            (field === 'order_category' && !selectedType)
                          }
                          params={{
                            revision,
                            order_type: selectedType,
                            current:
                              field === 'order_type'
                                ? selectedType
                                : selectedCategory,
                          }}
                          request={(params) =>
                            classification?.[
                              field === 'order_type' ? 'type' : 'category'
                            ].can_read
                              ? dictionaryOptions(
                                  field === 'order_type' ? 'type' : 'category',
                                  params,
                                )
                              : Promise.resolve(
                                  context?.item[field]
                                    ? [
                                        {
                                          value: context.item[field],
                                          label: context.item[field],
                                        },
                                      ]
                                    : [],
                                )
                          }
                          fieldProps={{
                            showSearch: { filterOption: false },
                            onChange: () => {
                              if (field === 'order_type')
                                form.setFieldsValue({ order_category: '' });
                            },
                          }}
                          rules={[
                            {
                              required: Boolean(
                                creating ||
                                  context?.item.order_type ||
                                  selectedType ||
                                  selectedCategory,
                              ),
                              message: '请选择医嘱类型和分类',
                            },
                          ]}
                          placeholder={
                            field === 'order_category' && !selectedType
                              ? '请先选择医嘱类型'
                              : '请选择'
                          }
                        />
                      ),
                  )}
                  {visible.has('order_term') && (
                    <ProFormSelect
                      name="order_term"
                      label="默认医嘱期限"
                      disabled={!allowed('order_term')}
                      options={[
                        { value: 'Long Term', label: '长期' },
                        { value: 'Temporary', label: '临时' },
                      ]}
                    />
                  )}
                  {visible.has('default_sessions') && (
                    <ProFormDigit
                      name="default_sessions"
                      label="默认次数"
                      tooltip="开立医嘱时的默认执行次数，可在实际开立时调整。"
                      disabled={!allowed('default_sessions')}
                      min={1}
                      max={10000}
                      fieldProps={{ precision: 0 }}
                      rules={[{ required: true, message: '请填写次数' }]}
                    />
                  )}
                  {visible.has('description') && (
                    <ProFormTextArea
                      name="description"
                      label="项目说明"
                      disabled={!allowed('description')}
                      fieldProps={{ maxLength: 2000 }}
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
            ...(visible.has('charge_items')
              ? [
                  {
                    key: 'schemes',
                    label: '关联收费项目',
                    forceRender: true,
                    children: (
                      <>
                        {context && !context.use_direct_charges && (
                          <Alert
                            showIcon
                            type="warning"
                            title="该项目保留旧方案配置。保存新的收费关联后，之后提交的医嘱将使用这里的明细。历史医嘱继续保留原方案。"
                          />
                        )}
                        <OrderItemCharges
                          key={
                            context?.item.modified ||
                            `${editor?.kind}-${attempt}`
                          }
                          ref={chargesRef}
                          initial={context?.charge_items || []}
                          editable={Boolean(canEditCharges && !loading)}
                          readFields={chargeFields}
                          canSelectItems={Boolean(
                            chargeContext?.can_select_items,
                          )}
                          canReadPrices={Boolean(
                            chargeContext?.can_read_prices,
                          )}
                          onDirty={() => {
                            dirty.current = true;
                            chargesDirty.current = true;
                          }}
                        />
                      </>
                    ),
                  },
                ]
              : []),
            ...(!creating && context && !context.use_direct_charges
              ? [
                  {
                    key: 'legacy',
                    label: '历史收费方案',
                    children: <SchemeList orderItem={context.item.name} />,
                  },
                ]
              : []),
            ...(!creating && context
              ? [
                  {
                    key: 'history',
                    label: '修改记录',
                    children: (
                      <ProTable<{
                        name: string;
                        creation: string;
                        actor: string;
                        fields: string[];
                      }>
                        rowKey="name"
                        search={false}
                        options={false}
                        pagination={false}
                        params={{ name: context.item.name }}
                        request={async (params) =>
                          get('charge_order_item', 'get_history', params)
                        }
                        columns={[
                          {
                            title: '修改时间',
                            dataIndex: 'creation',
                            valueType: 'dateTime',
                          },
                          { title: '操作账号', dataIndex: 'actor' },
                          {
                            title: '修改内容',
                            dataIndex: 'fields',
                            render: (_, row) =>
                              row.fields
                                .map(
                                  (field) =>
                                    ({
                                      code: '编码',
                                      order_type: '医嘱类型',
                                      order_category: '医嘱分类',
                                      item_name: '名称',
                                      order_term: '默认期限',
                                      default_sessions: '默认次数',
                                      description: '说明',
                                      disabled: '状态',
                                      charge_items: '关联收费项目',
                                    })[field] || field,
                                )
                                .join('、'),
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
    </>
  );
}
