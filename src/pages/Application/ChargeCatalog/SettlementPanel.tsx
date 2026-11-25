import {
  ModalForm,
  ProDescriptions,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Space, Spin, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from './feedback';
import { get, post } from './service';

type SettlementAction =
  | 'submit'
  | 'withdraw'
  | 'receive'
  | 'credit'
  | 'refund'
  | 'offset';
type SettlementLine = {
  name: string;
  item_code: string;
  item_name?: string;
  qty: string;
  uom: string;
  rate: string;
  amount: string;
  price_reference?: string;
  available_return_qty: string;
};
type SettlementDetail = {
  invoice: {
    name: string;
    customer: string;
    currency: string;
    balance_currency: string;
    selling_price_list: string;
    posting_date: string;
    total: string;
    outstanding: string;
    received: string;
    refunded: string;
    refundable: string;
    credited: string;
    docstatus: number;
    version: string;
  };
  items: SettlementLine[];
  actions: SettlementAction[];
  modes: { value: string; label: string; needs_reference: boolean }[];
  payments: {
    name: string;
    kind: 'Receive' | 'Pay';
    date: string;
    amount: string;
  }[];
  credits: { name: string; date: string; amount: string }[];
  refund_sources: { value: string; label: string; maximum: string }[];
  offset_sources: { value: string; label: string }[];
  history: {
    id: string;
    actor: string;
    action: SettlementAction | 'draft';
    at: string;
    reason: string;
    reference: string;
  }[];
  today: string;
};
type OperationValues = {
  reason?: string;
  mode?: string;
  payment_date?: string;
  reference?: string;
  amount?: number;
  credit_note?: string;
  quantities?: Record<string, number | undefined>;
};

type CreditPreview = { amount: string; currency: string; confirmation: string };

const actionText = {
  draft: '生成收费草稿',
  submit: '提交收费单',
  withdraw: '撤回草稿',
  receive: '登记收款',
  credit: '确认退费',
  refund: '登记退款',
  offset: '核销贷项',
} as const;
const effectText: Record<SettlementAction, string> = {
  submit: '确认后提交这张收费单并形成应收。',
  withdraw: '确认后撤回草稿，该治疗记录回到待收费列表。',
  receive: '按已实际收到的金额提交收款凭证。',
  credit:
    '按原收费明细生成并提交贷项通知单。实际付出退款后，还需登记退款凭证。',
  refund: '按已实际付出的金额提交退款凭证。',
  offset: '用所选贷项抵扣本单未收金额，抵扣后的余额用于后续收款或退款。',
};

export default function SettlementPanel({
  name,
  session,
  onComplete,
}: {
  name: string;
  session: string;
  onComplete: (message: string) => void;
}) {
  const [detail, setDetail] = useState<SettlementDetail>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<SettlementAction>();
  const [creditPreview, setCreditPreview] = useState<CreditPreview>();
  const [operationError, setOperationError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const retry = useRef<{ input: string; id: string }>(undefined);
  const sending = useRef(false);

  useEffect(() => {
    let active = true;
    setDetail(undefined);
    setError(undefined);
    get<SettlementDetail>('execution_settlement', 'detail', { name, session })
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
    };
  }, [name, session, revision]);

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        title={error}
        action={
          <Button onClick={() => setRevision((value) => value + 1)}>
            刷新详情
          </Button>
        }
      />
    );
  }
  if (!detail) return <Spin />;

  const { invoice } = detail;
  const payment = selected === 'receive' || selected === 'refund';
  const amount =
    selected === 'refund' ? invoice.refundable : invoice.outstanding;
  const refundSource = detail.refund_sources[0];
  const noteOptions =
    selected === 'offset'
      ? detail.offset_sources
      : detail.refund_sources.map((note) => ({
          value: note.value,
          label: `${note.label} · 可退 ${note.maximum} ${invoice.balance_currency}`,
        }));
  const needsOffset =
    Number(invoice.outstanding) > 0 && detail.offset_sources.length > 0;
  const linked = [
    ...detail.payments.map((row) => ({
      ...row,
      kind: row.kind === 'Receive' ? '收款凭证' : '退款凭证',
      currency: invoice.balance_currency,
    })),
    ...detail.credits.map((row) => ({
      ...row,
      kind: '贷项通知单',
      currency: invoice.currency,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <ProDescriptions
        column={2}
        dataSource={invoice}
        columns={[
          { title: '客户', dataIndex: 'customer' },
          { title: '入账日期', dataIndex: 'posting_date' },
          { title: '销售价目表', dataIndex: 'selling_price_list' },
          {
            title: invoice.docstatus ? '原应收金额' : '草稿金额',
            render: () => `${invoice.total} ${invoice.currency}`,
          },
          ...(invoice.docstatus === 1
            ? [
                {
                  title: '已收金额',
                  render: () =>
                    `${invoice.received} ${invoice.balance_currency}`,
                },
                {
                  title: '未收金额',
                  render: () =>
                    `${invoice.outstanding} ${invoice.balance_currency}`,
                },
                {
                  title: '已冲减金额',
                  render: () => `${invoice.credited} ${invoice.currency}`,
                },
                {
                  title: '已退款',
                  render: () =>
                    `${invoice.refunded} ${invoice.balance_currency}`,
                },
                ...(Number(invoice.refundable) > 0
                  ? [
                      {
                        title: '待退款',
                        render: () =>
                          `${invoice.refundable} ${invoice.balance_currency}`,
                      },
                    ]
                  : []),
              ]
            : []),
        ]}
      />
      <ProTable<SettlementLine>
        rowKey="name"
        headerTitle="收费明细"
        search={false}
        options={false}
        pagination={false}
        dataSource={detail.items}
        columns={[
          {
            title: '项目',
            dataIndex: 'item_name',
            render: (_, row) => row.item_name || row.item_code,
          },
          { title: '数量', dataIndex: 'qty' },
          { title: '单位', dataIndex: 'uom' },
          { title: '单价', dataIndex: 'rate' },
          { title: '小计', dataIndex: 'amount' },
          { title: '价格来源', dataIndex: 'price_reference' },
        ]}
      />
      {linked.length > 0 && (
        <ProTable
          rowKey="name"
          headerTitle="关联凭证"
          search={false}
          options={false}
          pagination={false}
          dataSource={linked}
          columns={[
            { title: '凭证编号', dataIndex: 'name' },
            { title: '类型', dataIndex: 'kind' },
            { title: '入账日期', dataIndex: 'date' },
            { title: '金额', dataIndex: 'amount' },
            { title: '币种', dataIndex: 'currency' },
          ]}
        />
      )}
      <Space wrap>
        {detail.actions.map((action) => (
          <Button
            key={action}
            type={
              action === 'submit' || action === 'receive'
                ? 'primary'
                : 'default'
            }
            onClick={() => {
              setOperationError(undefined);
              setCreditPreview(undefined);
              setSelected(action);
            }}
          >
            {actionText[action]}
          </Button>
        ))}
        {detail.history.length > 0 && (
          <Button onClick={() => setRevision((value) => value + 1)}>
            刷新详情
          </Button>
        )}
      </Space>
      {needsOffset && (
        <Alert
          type="warning"
          showIcon
          title="当前有可用贷项，请先核销，再办理剩余收款或退款。"
        />
      )}
      {detail.history.length > 0 && (
        <ProTable
          rowKey="id"
          headerTitle="操作记录"
          search={false}
          options={false}
          pagination={{ defaultPageSize: 5 }}
          dataSource={detail.history}
          columns={[
            { title: '时间', dataIndex: 'at' },
            { title: '操作人', dataIndex: 'actor' },
            { title: '处理', render: (_, row) => actionText[row.action] },
            { title: '原因', dataIndex: 'reason' },
            { title: '单据', dataIndex: 'reference' },
          ]}
        />
      )}
      {selected && (
        <ModalForm<OperationValues>
          key={selected}
          title={actionText[selected]}
          open
          width={650}
          dateFormatter="string"
          initialValues={
            payment
              ? {
                  payment_date: detail.today,
                  amount: Number(
                    selected === 'refund' ? refundSource?.maximum || 0 : amount,
                  ),
                  credit_note:
                    selected === 'refund' ? refundSource?.value : undefined,
                }
              : {
                  credit_note:
                    selected === 'offset'
                      ? detail.offset_sources[0]?.value
                      : undefined,
                }
          }
          modalProps={{ destroyOnHidden: true, mask: { closable: false } }}
          onOpenChange={(open) => {
            if (!open && !sending.current) setSelected(undefined);
          }}
          onValuesChange={(change) => {
            if (change.quantities) setCreditPreview(undefined);
          }}
          submitter={{
            searchConfig: {
              submitText:
                selected === 'credit' && !creditPreview
                  ? '预览退费'
                  : actionText[selected],
            },
            submitButtonProps: {
              disabled:
                payment &&
                (!detail.modes.length ||
                  (selected === 'refund' && !refundSource)),
            },
          }}
          onFinish={async (values) => {
            if (sending.current) return false;
            setOperationError(undefined);
            const quantities = Object.fromEntries(
              Object.entries(values.quantities || {}).filter(
                ([, value]) => value,
              ),
            );
            if (selected === 'credit' && Object.keys(quantities).length === 0) {
              setOperationError('请输入至少一项退费数量。');
              return false;
            }
            const bank = detail.modes.find(
              (mode) => mode.value === values.mode,
            );
            if (payment && bank?.needs_reference && !values.reference?.trim()) {
              setOperationError('所选收付款方式需要填写流水号。');
              return false;
            }
            const data = {
              ...values,
              quantities,
              action: selected,
              name,
              session,
              version: invoice.version,
              confirmation: creditPreview?.confirmation,
            };
            sending.current = true;
            try {
              if (selected === 'credit' && !creditPreview) {
                const value = await post<CreditPreview>(
                  'execution_settlement',
                  'preview_credit',
                  {
                    name,
                    session,
                    version: invoice.version,
                    quantities,
                  },
                );
                setCreditPreview(value);
                return false;
              }
              const input = JSON.stringify(data);
              if (retry.current?.input !== input)
                retry.current = { input, id: crypto.randomUUID() };
              const result = await post<{ document: string }>(
                'execution_settlement',
                'command',
                {
                  ...data,
                  request_id: retry.current.id,
                },
              );
              retry.current = undefined;
              onComplete(`${actionText[selected]}成功 ${result.document}`);
              return true;
            } catch (failure) {
              setOperationError(errorMessage(failure));
              return false;
            } finally {
              sending.current = false;
            }
          }}
        >
          <Typography.Paragraph>{effectText[selected]}</Typography.Paragraph>
          {operationError && (
            <Alert type="error" showIcon title={operationError} />
          )}
          {creditPreview && (
            <Alert
              type="info"
              showIcon
              title={`预计冲减 ${creditPreview.amount} ${creditPreview.currency}`}
            />
          )}
          {(selected === 'refund' || selected === 'offset') && (
            <ProFormSelect
              name="credit_note"
              label="退款或核销凭证"
              options={noteOptions}
              rules={[{ required: true }]}
            />
          )}
          {payment && (
            <>
              {!detail.modes.length && (
                <Alert
                  type="warning"
                  showIcon
                  title="本机构暂无可用的同币种收付款方式。"
                />
              )}
              <ProFormSelect
                name="mode"
                label="收付款方式"
                options={detail.modes}
                rules={[{ required: true }]}
              />
              <ProFormDigit
                name="amount"
                label={`金额（${invoice.balance_currency}）`}
                min={0}
                max={Number(amount)}
                rules={[{ required: true, type: 'number', min: 0.00000001 }]}
              />
              <ProFormDatePicker
                name="payment_date"
                label="实际收付款日"
                rules={[{ required: true }]}
              />
              <ProFormText
                name="reference"
                label="流水号（银行必填）"
                fieldProps={{ maxLength: 140 }}
              />
            </>
          )}
          {selected === 'credit' &&
            detail.items
              .filter((line) => Number(line.available_return_qty) > 0)
              .map((line) => (
                <ProFormDigit
                  key={line.name}
                  name={['quantities', line.name]}
                  label={`${line.item_name || line.item_code}（可退 ${line.available_return_qty} ${line.uom}）`}
                  extra={`原单价 ${line.rate} ${invoice.currency}`}
                  min={0}
                  max={Number(line.available_return_qty)}
                />
              ))}
          <ProFormTextArea
            name="reason"
            label="办理原因"
            fieldProps={{ maxLength: 300 }}
            rules={[
              { required: ['withdraw', 'credit', 'refund'].includes(selected) },
            ]}
          />
        </ModalForm>
      )}
    </Space>
  );
}
