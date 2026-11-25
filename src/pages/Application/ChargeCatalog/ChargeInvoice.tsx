import {
  type ActionType,
  ProDescriptions,
  ProForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  InputNumber,
  Modal,
  Space,
  Spin,
  Tabs,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  chargeProgressText,
  chargeStates,
  type ExecutionChargeRow,
  settlementStates,
} from './executionChargeService';
import { errorMessage } from './feedback';
import SettlementPanel from './SettlementPanel';
import { get, post, searchPriceOptions } from './service';

type BillingLine = {
  key: string;
  item_code: string;
  uom: string;
  default_qty: string;
  requirement: 'Required' | 'Optional';
  quantity_mode: 'Fixed' | 'Actual';
};
type Selection = { session: string; price_list: string };
type Preview = {
  rows: {
    rehab_charge_line: string;
    item_code: string;
    uom: string;
    qty: string;
    rate: number;
    currency: string;
  }[];
  confirmation: string;
};

export default function ChargeInvoice() {
  const action = useRef<ActionType>(undefined);
  const [view, setView] = useState('Pending');
  const [target, setTarget] = useState<ExecutionChargeRow | 'manual'>();
  const [saved, setSaved] = useState<string>();
  const [error, setError] = useState<string>();
  const row = target === 'manual' ? undefined : target;
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {error && <Alert type="error" showIcon title={error} />}
      {saved && <Alert type="success" showIcon title={saved} />}
      <Tabs
        activeKey={view}
        onChange={(value) => {
          setView(value);
          setError(undefined);
        }}
        items={[
          { key: 'Pending', label: '待收费' },
          { key: 'Billed', label: '收费记录' },
        ]}
        tabBarExtraContent={
          <Button onClick={() => setTarget('manual')}>按治疗记录收费</Button>
        }
      />
      <ProTable<ExecutionChargeRow>
        actionRef={action}
        rowKey="name"
        params={{ view }}
        pagination={{ defaultPageSize: 20, pageSizeOptions: [10, 20, 50] }}
        scroll={{ x: 1050 }}
        request={async ({
          current,
          pageSize,
          keyword,
          from_date,
          to_date,
          settlement,
        }) => {
          setError(undefined);
          try {
            return await get<{
              data: ExecutionChargeRow[];
              total: number;
              success: boolean;
            }>('execution_charging', 'get_queue', {
              view,
              current,
              page_size: pageSize,
              keyword,
              from_date,
              to_date,
              settlement: view === 'Billed' ? settlement : undefined,
            });
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
        columns={[
          {
            title: '关键词',
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { placeholder: '患者、项目、治疗记录或收费单号' },
          },
          {
            title: '治疗日期',
            dataIndex: 'date_range',
            valueType: 'dateRange',
            hideInTable: true,
            search: {
              transform: (value) => ({
                from_date: value[0],
                to_date: value[1],
              }),
            },
          },
          { title: '患者', dataIndex: 'patient_name', search: false },
          { title: '治疗项目', dataIndex: 'therapy_type', search: false },
          {
            title: '实际治疗时间',
            search: false,
            render: (_, value) =>
              `${value.start_date} ${value.start_time || ''}`,
          },
          { title: '执行人', dataIndex: 'practitioner_name', search: false },
          {
            title: '收费状态',
            dataIndex: 'state',
            valueEnum: chargeStates,
            search: false,
          },
          {
            title: '费用单据',
            dataIndex: 'invoice',
            search: false,
            hideInTable: view !== 'Billed',
          },
          {
            title: '结算状态',
            dataIndex: 'settlement',
            valueType: 'select',
            valueEnum: settlementStates,
            hideInTable: view !== 'Billed',
            search: view === 'Billed',
          },
          {
            title: '待核对事项',
            dataIndex: 'reason',
            search: false,
            hideInTable: view !== 'Pending',
            ellipsis: true,
          },
          {
            title: '操作',
            valueType: 'option',
            render: (_, value) => (
              <Button type="link" onClick={() => setTarget(value)}>
                {value.can_review ? '核对收费' : '查看详情'}
              </Button>
            ),
          },
        ]}
      />
      <Drawer
        title={target === 'manual' ? '按治疗记录收费' : '执行收费核对'}
        open={Boolean(target)}
        onClose={() => setTarget(undefined)}
        size="min(900px, 100vw)"
        destroyOnHidden
      >
        {row && (
          <Space
            orientation="vertical"
            size="middle"
            style={{ width: '100%', marginBottom: 20 }}
          >
            <ProDescriptions
              dataSource={row}
              column={2}
              columns={[
                { title: '患者', dataIndex: 'patient_name' },
                { title: '机构', dataIndex: 'company' },
                { title: '治疗项目', dataIndex: 'therapy_type' },
                { title: '执行人', dataIndex: 'practitioner_name' },
                {
                  title: '实际治疗时间',
                  render: () => `${row.start_date} ${row.start_time || ''}`,
                },
                {
                  title: '实际时长',
                  render: () => (row.duration ? `${row.duration} 分钟` : '—'),
                },
                { title: '治疗记录', dataIndex: 'name' },
                { title: '康复医嘱', dataIndex: 'rehab_order' },
                { title: '收费状态', render: () => chargeProgressText(row) },
                ...(row.invoice
                  ? [{ title: '费用单据', dataIndex: 'invoice' }]
                  : []),
                ...(!row.settlement
                  ? []
                  : [
                      {
                        title: '结算状态',
                        render: () =>
                          row.settlement &&
                          settlementStates[row.settlement].text,
                      },
                    ]),
              ]}
            />
            {row.reason && <Alert type="warning" showIcon title={row.reason} />}
          </Space>
        )}
        {row?.invoice && row.state !== 'Conflict' && (
          <SettlementPanel
            key={row.invoice}
            name={row.invoice}
            session={row.name}
            onComplete={(message) => {
              setSaved(message);
              setTarget(undefined);
              action.current?.reload();
            }}
          />
        )}
        {(target === 'manual' || row?.can_review) && (
          <ChargeInvoiceEditor
            key={row?.name || 'manual'}
            session={row?.name}
            onSaved={(name) => {
              setSaved(`收费草稿已生成 ${name}`);
              setTarget(undefined);
              setView('Billed');
              action.current?.reload();
            }}
          />
        )}
      </Drawer>
    </Space>
  );
}

function ChargeInvoiceEditor({
  session,
  onSaved,
}: {
  session?: string;
  onSaved: (name: string) => void;
}) {
  const [form] = ProForm.useForm<Selection>();
  const [source, setSource] = useState<Selection>();
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [chosen, setChosen] = useState<Record<string, number | null>>({});
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [loadingLines, setLoadingLines] = useState(Boolean(session));
  const [loadedLines, setLoadedLines] = useState(false);
  const draftRequest = useRef<{ confirmation: string; id: string }>(undefined);
  useEffect(() => {
    if (!session) return;
    let active = true;
    get<{ lines: BillingLine[] }>('charge_billing', 'get_session_lines', {
      session,
    })
      .then((result) => {
        if (!active) return;
        setLines(result.lines);
        setLoadedLines(true);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoadingLines(false);
      });
    return () => {
      active = false;
    };
  }, [session]);
  const update = (key: string, quantity: number | null | undefined) => {
    setChosen((old) => {
      const next = { ...old };
      if (quantity === undefined) delete next[key];
      else next[key] = quantity;
      return next;
    });
  };
  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      {error && <Alert type="error" showIcon title={error} />}
      <ProForm<Selection>
        form={form}
        onFinish={async (value) => {
          setError(undefined);
          setSource(undefined);
          try {
            const result = await get<{ lines: BillingLine[] }>(
              'charge_billing',
              'get_session_lines',
              { session: value.session.trim() },
            );
            setSource({ ...value, session: value.session.trim() });
            setLines(result.lines);
            setChosen({});
            return true;
          } catch (reason) {
            setError(errorMessage(reason));
            return false;
          }
        }}
        submitter={
          session
            ? false
            : {
                searchConfig: { submitText: '读取收费明细' },
                render: (_, buttons) => [buttons[1]],
              }
        }
      >
        {!session && (
          <ProFormText
            name="session"
            label="已提交的治疗记录编号"
            rules={[{ required: true, whitespace: true }]}
            fieldProps={{ maxLength: 140 }}
          />
        )}
        <ProFormSelect
          name="price_list"
          label="销售价目表"
          showSearch
          request={({ keyWords }) =>
            searchPriceOptions('price_list', keyWords || '')
          }
          fieldProps={{ filterOption: false }}
          rules={[{ required: true }]}
        />
      </ProForm>
      {loadingLines && <Spin />}
      {(source || loadedLines) && (
        <ProTable<BillingLine>
          rowKey="key"
          search={false}
          options={false}
          pagination={false}
          dataSource={lines}
          headerTitle="本次收费项目"
          columns={[
            { title: '收费项目', dataIndex: 'item_code' },
            { title: '计价单位', dataIndex: 'uom' },
            {
              title: '计费属性',
              render: (_, row) =>
                row.requirement === 'Required' ? (
                  '必选项'
                ) : (
                  <Checkbox
                    checked={Object.hasOwn(chosen, row.key)}
                    onChange={(event) =>
                      update(
                        row.key,
                        event.target.checked
                          ? row.quantity_mode === 'Fixed'
                            ? Number(row.default_qty)
                            : null
                          : undefined,
                      )
                    }
                  >
                    本次使用
                  </Checkbox>
                ),
            },
            {
              title: '计费数量',
              render: (_, row) =>
                row.quantity_mode === 'Fixed' ? (
                  row.default_qty
                ) : (
                  <InputNumber
                    aria-label={`${row.item_code}实际数量`}
                    min={0.000001}
                    disabled={
                      row.requirement === 'Optional' &&
                      !Object.hasOwn(chosen, row.key)
                    }
                    value={chosen[row.key] ?? null}
                    onChange={(value) => update(row.key, value)}
                  />
                ),
            },
          ]}
          toolBarRender={() => [
            <Button
              key="preview"
              type="primary"
              loading={busy}
              onClick={async () => {
                let selection = source;
                if (session) {
                  try {
                    const { price_list } = await form.validateFields();
                    selection = { session, price_list };
                  } catch {
                    return;
                  }
                }
                if (!selection) return;
                setError(undefined);
                setBusy(true);
                try {
                  setPreview(
                    await post<Preview>('charge_billing', 'preview_session', {
                      ...selection,
                      ...(session ? { execution_queue: true } : {}),
                      selections: chosen,
                    }),
                  );
                  setSource(selection);
                } catch (reason) {
                  setError(errorMessage(reason));
                } finally {
                  setBusy(false);
                }
              }}
            >
              预览收费
            </Button>,
          ]}
        />
      )}
      <Modal
        title="确认生成收费草稿"
        open={Boolean(preview)}
        width={760}
        confirmLoading={busy}
        onCancel={() => {
          if (!busy) setPreview(undefined);
        }}
        okText="生成收费草稿"
        cancelText="返回"
        onOk={async () => {
          if (!source || !preview || busy) return;
          setBusy(true);
          setError(undefined);
          try {
            if (draftRequest.current?.confirmation !== preview.confirmation) {
              draftRequest.current = {
                confirmation: preview.confirmation,
                id: crypto.randomUUID(),
              };
            }
            const result = await post(
              'charge_billing',
              'create_session_invoice',
              {
                ...source,
                ...(session ? { execution_queue: true } : {}),
                selections: chosen,
                confirmation: preview.confirmation,
                request_id: draftRequest.current.id,
              },
            );
            setSource(undefined);
            setPreview(undefined);
            onSaved(result.name);
          } catch (reason) {
            setError(errorMessage(reason));
            setPreview(undefined);
          } finally {
            setBusy(false);
          }
        }}
      >
        <ProTable
          rowKey="rehab_charge_line"
          search={false}
          options={false}
          pagination={false}
          dataSource={preview?.rows || []}
          columns={[
            { title: '收费项目', dataIndex: 'item_code' },
            { title: '数量', dataIndex: 'qty' },
            { title: '单位', dataIndex: 'uom' },
            { title: '目录单价', dataIndex: 'rate' },
            { title: '币种', dataIndex: 'currency' },
          ]}
        />
      </Modal>
    </Space>
  );
}
