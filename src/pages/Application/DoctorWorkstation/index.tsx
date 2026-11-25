import {
  ModalForm,
  ProCard,
  type ProColumns,
  ProDescriptions,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Flex,
  Grid,
  Popconfirm,
  Result,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import type { ScoreDetails } from '../ScaleBank/service';
import { ScoreBreakdown } from '../ScaleBank/Trial';
import OrderEditor from './OrderEditor';
import PatientPicker from './PatientPicker';
import * as S from './service';

type OrderKind = S.OrderItem['kind'];
type RecordFilter = 'all' | 'mine' | 'review';
type ListedOrder = S.OrderRow & {
  items: S.OrderSummary[];
  summary?: S.OrderSummary;
};

const recordFilters = [
  { value: 'all', label: '全部' },
  { value: 'mine', label: '本人草稿' },
  { value: 'review', label: '待本人确认' },
];

const orderTitle = (item: S.OrderSummary) =>
  item.order_item || item.therapy_type || item.template || '—';

const validity = (item?: S.OrderSummary) => {
  if (!item?.start_date) return '—';
  return item.end_date && item.end_date !== item.start_date
    ? `${item.start_date} 至 ${item.end_date}`
    : item.start_date;
};

type PendingItem = { id: string; item: S.OrderItem };
type Operation = {
  id: string;
  execute: () => Promise<unknown>;
  success: (value: unknown) => Promise<void>;
};
const actionNames: Record<string, string> = {
  revise: '退回补充，重新开立',
  review: '临床确认',
  cancel: '撤销医嘱',
  stop: '停止医嘱',
};
const planNames: Record<string, string> = {
  New: '新开康复医嘱',
  'New Assessment Order': '新开评估医嘱',
  'Reuse Assessment': '引用已有评估任务',
  Reuse: '引用已有医嘱',
  'Reuse Batch Row': '合并本清单重复项',
};
const text = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
const stageNames: Record<string, string> = {
  Initial: '初期',
  Interim: '中期',
  Final: '出院 / 终期',
};

export default function DoctorWorkstation() {
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const actionGeneration = useRef(0);
  const inFlight = useRef(false);
  const operation = useRef<Operation | undefined>(undefined);
  const [options, setOptions] = useState<S.Options>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [context, setContext] = useState<S.Context>();
  const [selectedKey, setSelectedKey] = useState('');
  const [contextLoading, setContextLoading] = useState(false);
  const [orderKind, setOrderKind] = useState<OrderKind>('Treatment');
  const [patientPicker, setPatientPicker] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editingItem, setEditingItem] = useState<PendingItem>();
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [changed, setChanged] = useState(false);
  const [draft, setDraft] = useState<S.Draft>();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [preview, setPreview] = useState<S.Preview>();
  const [ack, setAck] = useState(false);
  const [record, setRecord] = useState<S.OrderDetail>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [assessment, setAssessment] = useState<{
    name: string;
    value: Record<string, unknown>;
  }>();
  const [action, setAction] = useState<{ row: S.OrderRow; action: string }>();
  const [recordFiltersByKind, setRecordFiltersByKind] = useState<
    Record<OrderKind, RecordFilter>
  >({
    Treatment: 'all',
    Assessment: 'all',
  });
  const fail = (e: unknown) => message.error(errorMessage(e));
  const dirty = editorDirty || changed;
  const locked = busy || uncertain || draftLoading;

  useEffect(() => {
    let active = true;
    S.options()
      .then((value) => {
        if (!active) return;
        setOptions(value);
        setError('');
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!dirty && !uncertain) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty, uncertain]);
  useEffect(() => {
    if (!dirty && !locked) return;
    let dialogOpen = false;
    const unblock = history.block((transition) => {
      if (locked) {
        message.warning('请先核实当前办理结果，再离开医生工作站。');
        return;
      }
      if (dialogOpen) return;
      dialogOpen = true;
      modal.confirm({
        title: '离开医生工作站并放弃未保存内容？',
        content: '已保存的服务器草稿会保留。',
        okText: '放弃并离开',
        cancelText: '继续编辑',
        onOk: () => {
          unblock();
          transition.retry();
        },
        onCancel: () => {
          dialogOpen = false;
        },
      });
    });
    return unblock;
  }, [dirty, locked, message, modal]);
  useEffect(
    () => () => {
      generation.current++;
      detailGeneration.current++;
    },
    [],
  );

  const confirmLeave = async (
    title = '存在未保存的医嘱内容，是否放弃并继续？',
    discard = dirty,
    content = '已保存的服务器草稿会保留，尚未保存的编辑内容将被清除。',
  ) => {
    if (locked) {
      message.warning('请先核实当前办理结果。');
      return false;
    }
    if (!discard) return true;
    return new Promise<boolean>((resolve) => {
      modal.confirm({
        title,
        content,
        okText: '放弃未保存内容',
        cancelText: '继续编辑',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };
  const resetEditor = () => {
    setEditingItem(undefined);
    setEditorDirty(false);
    setEditorOpen(false);
  };
  const confirmVisitChange = () => {
    if (!dirty || editorDirty || !pending.length) return confirmLeave();
    return new Promise<'save' | boolean>((resolve) => {
      const dialog = modal.confirm({
        title: '切换前如何处理未保存的医嘱？',
        content: '可以保存本次待开清单为草稿，或放弃未保存的修改。',
        okText: '放弃并切换',
        cancelText: '继续编辑',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
        footer: (_, { CancelBtn, OkBtn }) => (
          <Space wrap>
            <Button
              type="primary"
              onClick={() => {
                resolve('save');
                dialog.destroy();
              }}
            >
              保存草稿并切换
            </Button>
            <OkBtn />
            <CancelBtn />
          </Space>
        ),
        okButtonProps: { danger: true, type: 'default' },
      });
    });
  };
  const selectVisit = async (key: string) => {
    if (locked) return;
    if (key === selectedKey && context) {
      setPatientPicker(false);
      return;
    }
    const decision = await confirmVisitChange();
    if (!decision || (decision === 'save' && !(await saveDraft()))) return;
    setContextLoading(true);
    try {
      const current = generation.current;
      const value = await S.context(key);
      if (current !== generation.current) return;
      generation.current++;
      detailGeneration.current++;
      actionGeneration.current++;
      setPatientPicker(false);
      setReferenceOpen(false);
      setContext(value);
      setSelectedKey(key);
      setPending([]);
      setDraft(undefined);
      setChanged(false);
      resetEditor();
      setPreview(undefined);
      setAction(undefined);
      setRecord(undefined);
      setAssessment(undefined);
      setOrderKind('Treatment');
    } catch (e) {
      fail(e);
    } finally {
      setContextLoading(false);
    }
  };
  const refreshContext = async () => {
    const current = generation.current,
      key = selectedKey;
    if (!key) return;
    const value = await S.context(key);
    if (current === generation.current) setContext(value);
  };
  const recover = async (retry: boolean) => {
    if (inFlight.current || !operation.current) return;
    const active = operation.current;
    inFlight.current = true;
    setBusy(true);
    try {
      const receipt = await S.receipt(active.id);
      if (receipt.found) {
        await active.success(receipt);
        operation.current = undefined;
        setUncertain(false);
        message.success('已核实原请求成功。');
      } else if (retry) {
        const value = await active.execute();
        await active.success(value);
        operation.current = undefined;
        setUncertain(false);
      } else
        message.info('暂未查询到成功回执，可使用原请求重试；当前内容会保留。');
    } catch (e) {
      fail(e);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const perform = async (op: Operation) => {
    if (inFlight.current || operation.current) return false;
    operation.current = op;
    inFlight.current = true;
    setBusy(true);
    try {
      const value = await op.execute();
      await op.success(value);
      operation.current = undefined;
      setUncertain(false);
      return true;
    } catch (e) {
      const status = (e as { response?: { status?: number } }).response?.status;
      if (status && status >= 400 && status < 500) {
        operation.current = undefined;
        fail(e);
      } else {
        setUncertain(true);
        message.warning('办理响应未确认，请核实原请求结果，避免重复开立。');
      }
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const saveDraft = async (submitAfter = false) => {
    if (!context || !pending.length) return false;
    if (editorDirty) {
      message.warning('请先将当前表单加入待开清单，或明确清除表单。');
      return false;
    }
    const requestId = crypto.randomUUID();
    const payload = {
      key: context.context.key,
      source_modified: context.context.modified,
      name: draft?.name,
      modified: draft?.modified,
      items: pending.map((r) => r.item),
      request_id: requestId,
    };
    return perform({
      id: requestId,
      execute: () => S.save(payload),
      success: async (response) => {
        const receipt = response as S.Draft;
        const saved = receipt.modified
          ? receipt
          : await S.order({
              name: String(receipt.name),
              doctype: 'Rehab Clinical Workspace',
            }).then((v) => ({
              name: v.row.name,
              modified: v.row.modified,
              status: v.row.status,
              items: v.content.items || [],
            }));
        setDraft(saved);
        setChanged(false);
        await refreshContext();
        message.success('医嘱草稿已保存。');
        if (submitAfter) {
          const checked = await S.previewSubmit({
            name: saved.name,
            modified: saved.modified,
          });
          setPreview(checked);
          setAck(false);
        }
      },
    });
  };
  const openOrder = async (row: S.OrderRow) => {
    const current = ++detailGeneration.current;
    setRecord(undefined);
    setAssessment(undefined);
    setDetailLoading(true);
    try {
      const value = await S.order(row);
      if (current === detailGeneration.current) setRecord(value);
    } catch (e) {
      if (current === detailGeneration.current) fail(e);
    } finally {
      if (current === detailGeneration.current) setDetailLoading(false);
    }
  };
  const openAssessment = async (name: string) => {
    const current = ++detailGeneration.current;
    setRecord(undefined);
    setAssessment(undefined);
    setDetailLoading(true);
    try {
      const value = await S.assessment(name);
      if (current === detailGeneration.current) setAssessment({ name, value });
    } catch (e) {
      if (current === detailGeneration.current) fail(e);
    } finally {
      if (current === detailGeneration.current) setDetailLoading(false);
    }
  };
  const editItem = (item?: PendingItem) => {
    setEditingItem(item);
    setEditorDirty(false);
    setEditorOpen(true);
  };
  const closeEditor = async () => {
    if (
      await confirmLeave(
        '放弃这次表单编辑？',
        editorDirty,
        '已经加入待开清单的项目会保留。',
      )
    ) {
      resetEditor();
    }
  };
  const editPendingKind = (rows: PendingItem[]) => {
    const matches = rows.filter((entry) => entry.item.kind === orderKind);
    if (matches.length === 1) editItem(matches[0]);
    else message.info('草稿已载入，可在本次待开清单逐条编辑。');
  };
  const applyDraft = (loaded: S.Draft) => {
    const rows = loaded.items.map((item) => ({
      id: crypto.randomUUID(),
      item,
    }));
    setDraft(loaded);
    setPending(rows);
    setChanged(false);
    resetEditor();
    editPendingKind(rows);
  };
  const loadDraft = async (row: ListedOrder) => {
    if (row.name === draft?.name) {
      editPendingKind(pending);
      return;
    }
    if (!(await confirmLeave('载入这份草稿并替换当前待开清单？'))) return;
    if (row.status === 'Rejected') {
      setAction({ row, action: 'revise' });
      return;
    }
    if (
      row.doctype !== 'Rehab Clinical Workspace' ||
      row.status === 'Returned'
    ) {
      const id = crypto.randomUUID();
      await perform({
        id,
        execute: () => S.editOriginal(row, id),
        success: async (value) => {
          const result = value as S.Draft;
          const next = result.items
            ? result
            : await S.order({
                name: String(result.name),
                doctype: 'Rehab Clinical Workspace',
              }).then((v) => ({
                name: v.row.name,
                modified: v.row.modified,
                status: v.row.status,
                items: v.content.items || [],
              }));
          applyDraft(next);
          await refreshContext();
        },
      });
      return;
    }
    const current = generation.current;
    setDraftLoading(true);
    try {
      const value = await S.order(row);
      if (current !== generation.current) return;
      applyDraft({
        name: row.name,
        modified: value.row.modified,
        status: value.row.status,
        items: value.content.items || [],
      });
    } catch (e) {
      if (current === generation.current) fail(e);
    } finally {
      if (current === generation.current) setDraftLoading(false);
    }
  };
  const add = (item: S.OrderItem) => {
    if (editingItem)
      setPending((rows) =>
        rows.map((r) => (r.id === editingItem.id ? { ...r, item } : r)),
      );
    else setPending((rows) => [...rows, { id: crypto.randomUUID(), item }]);
    setChanged(true);
    resetEditor();
  };
  const recordColumns: ProColumns<ListedOrder>[] = [
    {
      title: orderKind === 'Treatment' ? '医嘱项目' : '评估量表',
      dataIndex: 'title',
      render: (_, row) => (
        <Button type="link" onClick={() => openOrder(row)}>
          {row.items.length
            ? `${orderTitle(row.items[0])}${row.items.length > 1 ? ` 等 ${row.items.length} 项` : ''}`
            : row.title}
        </Button>
      ),
    },
    ...(orderKind === 'Treatment'
      ? [
          {
            title: '执行治疗项目',
            render: (_: unknown, row: ListedOrder) =>
              row.summary?.therapy_type || '—',
          },
          {
            title: '有效期',
            render: (_: unknown, row: ListedOrder) => validity(row.summary),
          },
          {
            title: '计划次数',
            render: (_: unknown, row: ListedOrder) =>
              row.summary?.sessions ?? '—',
          },
        ]
      : [
          {
            title: '评估阶段',
            render: (_: unknown, row: ListedOrder) =>
              stageNames[row.summary?.stage || ''] || '—',
          },
          {
            title: '要求完成日期',
            render: (_: unknown, row: ListedOrder) =>
              row.summary?.due_date || '—',
          },
          {
            title: '指定临床确认医生',
            render: (_: unknown, row: ListedOrder) =>
              row.reviewer_name || row.reviewer || '—',
          },
        ]),

    {
      title: '状态',
      dataIndex: 'status',
      render: (_, row) => <Tag>{S.states[row.status] || row.status}</Tag>,
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => [
        row.can_edit ? (
          <Button
            key="edit"
            type="link"
            disabled={locked}
            onClick={() => loadDraft(row)}
          >
            {row.items.length > 1 ? '载入草稿' : '编辑'}
          </Button>
        ) : null,
        row.can_review ? (
          <Button
            key="review"
            type="link"
            disabled={locked}
            onClick={() => setAction({ row, action: 'review' })}
          >
            确认 / 退回
          </Button>
        ) : null,
        row.can_cancel ? (
          <Button
            key="cancel"
            type="link"
            disabled={locked}
            onClick={() => setAction({ row, action: 'cancel' })}
          >
            撤销
          </Button>
        ) : null,
        row.can_stop ? (
          <Button
            key="stop"
            type="link"
            disabled={locked}
            onClick={() => setAction({ row, action: 'stop' })}
          >
            停止
          </Button>
        ) : null,
      ],
    },
  ];
  const pendingColumns: ProColumns<PendingItem>[] = [
    { title: '项目', render: (_, r) => r.item.order_item || r.item.template },
    {
      title: '计划量 / 阶段',
      render: (_, r) =>
        r.item.kind === 'Treatment'
          ? `${r.item.sessions} 次`
          : stageNames[r.item.stage || ''],
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, r) => [
        <Button
          key="edit"
          type="link"
          disabled={locked}
          onClick={() => editItem(r)}
        >
          编辑
        </Button>,
        <Popconfirm
          key="delete"
          title="从本次待开清单移除？"
          onConfirm={() => {
            setPending((rows) => rows.filter((item) => item.id !== r.id));
            setChanged(true);
            if (editingItem?.id === r.id) resetEditor();
          }}
        >
          <Button type="link" danger disabled={locked}>
            移除
          </Button>
        </Popconfirm>,
      ],
    },
  ];
  if (error)
    return (
      <Result
        status="warning"
        title="暂时无法打开医生工作站"
        subTitle={error}
        extra={<Button onClick={() => setAttempt((v) => v + 1)}>重试</Button>}
      />
    );
  if (!options) return <Spin />;
  const related = context?.visit.related;
  const recordView = recordFiltersByKind[orderKind];
  const listedOrders: ListedOrder[] = (context?.records || []).flatMap(
    (row) => {
      if (recordView === 'review' && !row.can_review) return [];
      if (
        recordView === 'mine' &&
        !(row.can_edit && (row.kind === 'OrderDraft' || row.status === 'Draft'))
      )
        return [];
      const items =
        row.order_items?.filter((item) => item.kind === orderKind) || [];
      const nativeKind =
        row.kind === 'AssessmentOrder' ? 'Assessment' : row.kind;
      const matchesKind =
        row.kind === 'OrderDraft'
          ? items.length > 0 || !row.order_items?.length
          : nativeKind === orderKind;
      return matchesKind
        ? [
            {
              ...row,
              items,
              summary: items.length === 1 ? items[0] : undefined,
            },
          ]
        : [];
    },
  );
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      {options.notice && <Alert showIcon type="info" title={options.notice} />}
      {uncertain && (
        <Alert
          type="warning"
          showIcon
          title="上次办理结果待核实，当前患者及输入已保留"
          action={
            <Space wrap>
              <Button loading={busy} onClick={() => recover(false)}>
                查询办理结果
              </Button>
              <Button disabled={busy} onClick={() => recover(true)}>
                使用原请求重试
              </Button>
            </Space>
          }
        />
      )}
      <ProCard>
        <Flex justify="space-between" align="center" gap={12} wrap>
          {context ? (
            <Space size="middle" wrap>
              <Typography.Text strong>
                {context.visit.row.patient_name}
              </Typography.Text>
              <Typography.Text>
                {context.visit.row.sex || '—'} · {context.visit.row.age ?? '—'}{' '}
                岁
              </Typography.Text>
              <Tag color="blue">
                {context.visit.row.kind === 'inpatient' ? '住院' : '门诊'}
              </Tag>
              <Typography.Text type="secondary">
                {context.visit.row.patient}
              </Typography.Text>
              <Typography.Text type="secondary">
                {context.visit.row.department}
              </Typography.Text>
              <Typography.Text type="secondary">
                本次就诊 {context.visit.row.name}
              </Typography.Text>
            </Space>
          ) : (
            <Typography.Text>当前患者</Typography.Text>
          )}
          <Space wrap>
            {context && (
              <Button onClick={() => setReferenceOpen(true)}>诊疗参考</Button>
            )}
            <Button
              type={context ? 'default' : 'primary'}
              loading={contextLoading}
              disabled={locked}
              onClick={() => setPatientPicker(true)}
            >
              {context ? '切换患者' : '选择患者'}
            </Button>
          </Space>
        </Flex>
      </ProCard>
      {contextLoading ? (
        <Spin />
      ) : context ? (
        <ProCard>
          <Tabs
            activeKey={orderKind}
            onChange={(value) => setOrderKind(value as OrderKind)}
            items={[
              { key: 'Treatment', label: '康复医嘱', disabled: locked },
              { key: 'Assessment', label: '评估医嘱', disabled: locked },
            ]}
          />
          <ProTable<ListedOrder>
            key={orderKind}
            cardProps={false}
            rowKey="name"
            columns={recordColumns}
            dataSource={listedOrders}
            search={false}
            options={false}
            pagination={{ defaultPageSize: 10, showSizeChanger: false }}
            size="small"
            scroll={{ x: 760 }}
            toolbar={{
              menu: {
                type: 'inline',
                activeKey: recordView,
                items: recordFilters.map((item) => ({
                  key: item.value,
                  label: item.label,
                })),
                onChange: (value) =>
                  setRecordFiltersByKind((current) => ({
                    ...current,
                    [orderKind]: value as RecordFilter,
                  })),
              },
              actions: [
                <Button
                  key="refresh"
                  disabled={locked}
                  onClick={() => refreshContext().catch(fail)}
                >
                  刷新
                </Button>,
                context.can_open && (
                  <Button
                    key="new"
                    type="primary"
                    disabled={locked}
                    onClick={() => editItem()}
                  >
                    新建{S.kindName(orderKind)}
                  </Button>
                ),
              ],
            }}
          />
          {pending.length > 0 && (
            <>
              <ProTable<PendingItem>
                cardProps={false}
                rowKey="id"
                headerTitle={`本次待开（${pending.length} 条）`}
                columns={pendingColumns}
                dataSource={pending.filter(
                  (row) => row.item.kind === orderKind,
                )}
                search={false}
                options={false}
                pagination={false}
                size="small"
                scroll={{ x: 360 }}
              />
              <Space wrap style={{ marginTop: 16 }}>
                <Button
                  loading={busy}
                  disabled={locked}
                  onClick={() => saveDraft()}
                >
                  保存草稿
                </Button>
                <Button
                  type="primary"
                  loading={busy}
                  disabled={locked}
                  onClick={() => saveDraft(true)}
                >
                  核对并提交
                </Button>
                <Typography.Text type="secondary">
                  康复{' '}
                  {
                    pending.filter((row) => row.item.kind === 'Treatment')
                      .length
                  }{' '}
                  条 · 评估{' '}
                  {
                    pending.filter((row) => row.item.kind === 'Assessment')
                      .length
                  }{' '}
                  条
                </Typography.Text>
                {draft && (
                  <Typography.Text type="secondary">
                    草稿 {draft.name}
                    {changed ? ' · 有未保存变更' : ' · 已保存'}
                  </Typography.Text>
                )}
              </Space>
            </>
          )}
        </ProCard>
      ) : (
        <ProCard>
          <Empty description="选择患者及本次就诊后查看医嘱" />
        </ProCard>
      )}
      {patientPicker && (
        <PatientPicker
          hasDoctor={Boolean(options.doctor.length)}
          locked={locked}
          onCancel={() => setPatientPicker(false)}
          onConfirm={selectVisit}
        />
      )}
      <Drawer
        title="诊疗参考"
        open={referenceOpen}
        size="min(560px, 100vw)"
        onClose={() => setReferenceOpen(false)}
      >
        {!context ? (
          <Empty description="选择患者后显示" />
        ) : (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <ProDescriptions
              column={1}
              size="small"
              dataSource={context.visit.values}
              columns={[
                { title: '就诊原因', dataIndex: 'rehab_visit_reason' },
                {
                  title: '主诉',
                  dataIndex: 'symptoms',
                  renderText: (value) =>
                    Array.isArray(value) ? value.join('、') : text(value),
                },
                {
                  title: '诊断',
                  dataIndex: 'diagnosis',
                  renderText: (value) =>
                    Array.isArray(value) ? value.join('、') : text(value),
                },
                { title: '接诊说明', dataIndex: 'encounter_comment' },
              ]}
            />
            <Typography.Title level={5}>本次已有医嘱</Typography.Title>
            {context.records
              .filter((r) => r.kind !== 'OrderDraft')
              .slice(0, 8)
              .map((r) => (
                <Space key={r.name} orientation="vertical" size={0}>
                  <Button
                    type="link"
                    onClick={() => {
                      setReferenceOpen(false);
                      void openOrder(r);
                    }}
                  >
                    {r.title}
                  </Button>
                  <Tag>{S.states[r.status] || r.status}</Tag>
                </Space>
              ))}
            <Typography.Title level={5}>本次评估任务与结果</Typography.Title>
            {related?.assessments.available ? (
              related.assessments.rows.length ? (
                related.assessments.rows.map((r) => (
                  <Space key={r.name} orientation="vertical" size={0}>
                    <Button
                      type="link"
                      onClick={() => {
                        setReferenceOpen(false);
                        void openAssessment(r.name);
                      }}
                    >
                      {r.name}
                    </Button>
                    <Typography.Text type="secondary">
                      {r.status} · {stageNames[r.stage || ''] || r.stage}
                    </Typography.Text>
                  </Space>
                ))
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="本次就诊暂无评估任务"
                />
              )
            ) : (
              <Typography.Text type="secondary">
                未获评估记录读取权限
              </Typography.Text>
            )}
            {related?.assessments.truncated && (
              <Alert
                type="warning"
                title="仅显示前100条评估，请从评估管理查询完整记录。"
              />
            )}
            <Typography.Title level={5}>历次已完成评估</Typography.Title>
            {(context.assessment_history || []).length ? (
              context.assessment_history.map((row) => (
                <Space key={row.name} orientation="vertical" size={0}>
                  <Button
                    type="link"
                    onClick={() => {
                      setReferenceOpen(false);
                      void openAssessment(row.name);
                    }}
                  >
                    {row.assessment_template}
                  </Button>
                  <Typography.Text type="secondary">
                    {row.assessed_at || '未记录实际时间'} ·{' '}
                    {stageNames[row.stage] || row.stage}
                  </Typography.Text>
                </Space>
              ))
            ) : (
              <Typography.Text type="secondary">
                暂无本机构获授权的已完成评估
              </Typography.Text>
            )}
            {context.history_truncated && (
              <Typography.Text type="secondary">
                仅显示最近20条，完整记录请从评估管理查询。
              </Typography.Text>
            )}
          </Space>
        )}
      </Drawer>
      {context && editorOpen && (
        <OrderEditor
          context={context}
          kind={orderKind}
          initial={editingItem?.item}
          timezone={options.timezone}
          disabled={locked}
          onAdd={add}
          onClose={closeEditor}
          onDirty={setEditorDirty}
        />
      )}
      <Drawer
        title={record?.row.title || assessment?.name || '读取详情'}
        open={Boolean(record || assessment || detailLoading)}
        size={screens.md ? 820 : '100%'}
        onClose={() => {
          detailGeneration.current++;
          setRecord(undefined);
          setAssessment(undefined);
          setDetailLoading(false);
        }}
      >
        {detailLoading ? (
          <Spin />
        ) : record ? (
          <OrderDetails record={record} />
        ) : assessment ? (
          <AssessmentDetails value={assessment.value} />
        ) : null}
      </Drawer>
      <ModalForm<Record<string, unknown>>
        key={`${action?.row.name}:${action?.action}`}
        title={action ? actionNames[action.action] : ''}
        open={Boolean(action)}
        modalProps={{
          destroyOnHidden: true,
          onCancel: () => {
            actionGeneration.current++;
            setAction(undefined);
          },
          maskClosable: false,
        }}
        submitter={{ searchConfig: { submitText: '预览核对' } }}
        onFinish={async (values) => {
          if (!action) return false;
          const currentAction = ++actionGeneration.current;
          try {
            if (action.action === 'revise') {
              const id = crypto.randomUUID();
              await perform({
                id,
                execute: () =>
                  S.editOriginal(action.row, id, String(values.reason)),
                success: async (value) => {
                  const result = value as S.Draft;
                  const next = result.items
                    ? result
                    : await S.order({
                        name: String(result.name),
                        doctype: 'Rehab Clinical Workspace',
                      }).then((v) => ({
                        name: v.row.name,
                        modified: v.row.modified,
                        status: v.row.status,
                        items: v.content.items || [],
                      }));
                  applyDraft(next);
                  setAction(undefined);
                  await refreshContext();
                },
              });
              return true;
            }
            const checked = await S.previewAction({
              ...values,
              name: action.row.name,
              doctype: action.row.doctype,
              modified: action.row.modified,
              action: action.action,
            });
            if (currentAction !== actionGeneration.current) return false;
            setPreview(checked);
            setAck(false);
            setAction(undefined);
            return true;
          } catch (e) {
            fail(e);
            return false;
          }
        }}
      >
        <ProDescriptions
          column={1}
          dataSource={action?.row}
          columns={[
            { title: '医嘱', dataIndex: 'title' },
            { title: '编号', dataIndex: 'name' },
            {
              title: '状态',
              dataIndex: 'status',
              renderText: (v) => S.states[v] || v,
            },
          ]}
        />
        {action?.action === 'review' && (
          <ProFormSelect
            name="decision"
            label="确认结论"
            valueEnum={{ accept: '确认', reject: '退回补充' }}
            rules={[{ required: true }]}
          />
        )}
        {action?.action === 'stop' && action.row.doctype === 'Rehab Order' && (
          <ProFormDateTimePicker
            name="effective_at"
            label="停止生效时间（医院时间）"
            rules={[{ required: true }]}
          />
        )}
        <ProFormTextArea
          name="reason"
          label="意见 / 原因"
          rules={[{ required: true, whitespace: true, max: 2000 }]}
        />
      </ModalForm>
      <ModalForm
        title="核对本次医嘱办理"
        open={Boolean(preview)}
        modalProps={{
          destroyOnHidden: true,
          maskClosable: false,
          onCancel: () => {
            if (!locked) setPreview(undefined);
          },
          width: 900,
        }}
        submitter={{
          searchConfig: { submitText: '确认办理' },
          submitButtonProps: { disabled: !ack || locked, loading: busy },
          resetButtonProps: { disabled: locked },
        }}
        onFinish={async () => {
          if (!preview || !ack || locked) return false;
          const id = crypto.randomUUID(),
            captured = preview;
          await perform({
            id,
            execute: () => S.confirm({ token: captured.token, request_id: id }),
            success: async (value) => {
              const receipt = value as S.Receipt;
              setPreview(undefined);
              if (captured.action === 'submit') {
                setPending([]);
                setDraft(undefined);
                setChanged(false);
                resetEditor();
              }
              await refreshContext();
              if (receipt.blocked)
                message.warning(
                  receipt.message || '签署接口尚未配置，原医嘱保留待签状态。',
                );
              else message.success(receipt.message || '本次办理已保存。');
            },
          });
          return false;
        }}
      >
        {preview && (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Alert type="info" showIcon title={preview.notice} />
            <ProDescriptions
              column={1}
              dataSource={{
                patient: context?.visit.row.patient_name,
                key: context?.context.key,
                action:
                  preview.action === 'submit'
                    ? '提交待开清单'
                    : actionNames[preview.action],
                reason: preview.summary.reason,
              }}
              columns={[
                { title: '患者', dataIndex: 'patient' },
                { title: '本次就诊', dataIndex: 'key' },
                { title: '办理动作', dataIndex: 'action' },
                { title: '意见 / 原因', dataIndex: 'reason' },
              ]}
            />
            {preview.summary.rows && (
              <Table<S.PreviewRow>
                rowKey="index"
                pagination={false}
                scroll={{ x: 500 }}
                dataSource={preview.summary.rows}
                columns={[
                  {
                    title: '项目',
                    render: (_, r) => r.item.order_item || r.item.template,
                  },
                  {
                    title: '本次处理',
                    dataIndex: 'action',
                    render: (value: string) => planNames[value] || value,
                  },
                  {
                    title: '已有相关记录',
                    render: (_, r) =>
                      r.candidates.map((c) => c.name).join('、') || '无',
                  },
                ]}
                expandable={{
                  expandedRowRender: (row) => <ItemDetails item={row.item} />,
                }}
              />
            )}
            {preview.summary.row && (
              <ProDescriptions
                column={1}
                dataSource={preview.summary.row}
                columns={[
                  { title: '医嘱', dataIndex: 'title' },
                  { title: '编号', dataIndex: 'name' },
                  {
                    title: '原状态',
                    dataIndex: 'status',
                    renderText: (value) => S.states[value] || value,
                  },
                ]}
              />
            )}
            {preview.summary.booking_order && (
              <ProDescriptions
                column={2}
                dataSource={preview.summary.booking_order}
                columns={[
                  { title: '患者', dataIndex: 'patient_name' },
                  { title: '治疗项目', dataIndex: 'therapy_type' },
                  { title: '计划次数', dataIndex: 'sessions_planned' },
                  {
                    title: '有效期',
                    render: (_, row) =>
                      `${row.start_date} 至 ${row.end_date || '未设结束日期'}`,
                  },
                  {
                    title: '医嘱注意事项',
                    dataIndex: 'clinical_notes',
                    span: 2,
                  },
                ]}
              />
            )}
            {preview.summary.plan && (
              <PlanDetails value={preview.summary.plan} />
            )}
            <Checkbox
              checked={ack}
              disabled={locked}
              onChange={(e) => setAck(e.target.checked)}
            >
              我已核对患者、本次就诊和逐项医嘱内容
            </Checkbox>
          </Space>
        )}
      </ModalForm>
    </Space>
  );
}

function PlanDetails({ value }: { value: Record<string, unknown> }) {
  const affected = Array.isArray(value.affected)
    ? (value.affected as Record<string, unknown>[])
    : undefined;
  const missing = Array.isArray(value.missing)
    ? (value.missing as Record<string, unknown>[])
    : [];
  const existing = Array.isArray(value.existing)
    ? (value.existing as Record<string, unknown>[])
    : [];
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {affected && (
        <>
          <Typography.Text>
            涉及的未完成任务：{affected.length} 条
          </Typography.Text>
          <Table
            rowKey="name"
            pagination={false}
            dataSource={affected}
            columns={[
              { title: '任务', dataIndex: 'name' },
              {
                title: '状态',
                dataIndex: 'status',
                render: (v) => S.states[v] || v,
              },
              ...(value.kind === 'Assessment'
                ? [
                    {
                      title: '要求完成日期',
                      dataIndex: 'due_date',
                      render: text,
                    },
                  ]
                : [
                    { title: '计划开始', dataIndex: 'starts_at', render: text },
                    { title: '计划结束', dataIndex: 'ends_at', render: text },
                  ]),
            ]}
            scroll={{ x: 500 }}
          />
        </>
      )}
      {value.kind === 'Assessment' && (
        <Typography.Text type="secondary">
          保留已完成或关闭的评估 {Number(value.retained_count || 0)}{' '}
          项，保留引用的其他任务 {Number(value.shared_count || 0)} 项。
        </Typography.Text>
      )}
      {Boolean(missing.length || existing.length) && (
        <>
          <Typography.Text>
            确认后新增 {missing.length} 项评估待办，引用 {existing.length}{' '}
            项已有待办。
          </Typography.Text>
          <Table
            rowKey={(row) =>
              String(row.name || `${row.template}:${row.assignee}`)
            }
            pagination={false}
            dataSource={[...missing, ...existing]}
            columns={[
              {
                title: '量表 / 任务',
                render: (_, row) =>
                  text(row.template || row.assessment_template || row.name),
              },
              {
                title: '执行人',
                render: (_, row) => text(row.assignee || row.assigned_to),
              },
            ]}
          />
        </>
      )}
    </Space>
  );
}

function ItemDetails({ item }: { item: S.OrderItem }) {
  const risk = item.prescription?.risk;
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <ProDescriptions
        column={1}
        dataSource={{
          ...item,
          quantity: item.kind === 'Treatment' ? `${item.sessions} 次` : '1 项',
          term:
            item.order_term === 'Long Term'
              ? '长期'
              : item.order_term === 'Temporary'
                ? '临时'
                : stageNames[item.stage || ''],
          dates:
            item.kind === 'Treatment'
              ? `${item.start_date} 至 ${item.end_date}`
              : item.due_date,
        }}
        columns={[
          { title: '类型', dataIndex: 'kind', renderText: S.kindName },
          { title: '医嘱项目', dataIndex: 'order_item' },
          { title: '执行治疗项目', dataIndex: 'therapy_type' },
          { title: '量表', dataIndex: 'template' },
          { title: '期限 / 阶段', dataIndex: 'term' },
          { title: '计划量', dataIndex: 'quantity' },
          { title: '日期', dataIndex: 'dates' },
          { title: '临床要求', dataIndex: 'notes' },
          { title: '确认医生账号', dataIndex: 'clinical_reviewer' },
          { title: '评估执行人', dataIndex: 'assignee' },
          { title: '接收治疗组', dataIndex: 'team' },
          { title: '原指定治疗师', dataIndex: 'assigned_therapist' },
          { title: '重叠新开依据', dataIndex: 'overlap_reason' },
        ]}
      />
      {item.prescription && (
        <ProDescriptions
          column={1}
          dataSource={item.prescription}
          columns={[
            { title: '单次预约分钟', dataIndex: 'planned_duration' },
            { title: '单次最短分钟', dataIndex: 'duration_min' },
            { title: '单次最长分钟', dataIndex: 'duration_max' },
            {
              title: '周期方式',
              dataIndex: 'period_kind',
              renderText: (v) =>
                v === 'Calendar' ? '固定日历周期' : '滚动时间窗',
            },
            { title: '每周期天数', dataIndex: 'period_days' },
            { title: '每周期上限', dataIndex: 'period_limit' },
            { title: '最短间隔分钟', dataIndex: 'gap_minutes' },
            {
              title: '允许星期',
              dataIndex: 'weekdays',
              renderText: (v: number[]) =>
                v
                  .map(
                    (n) =>
                      ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][
                        n
                      ],
                  )
                  .join('、'),
            },
            {
              title: '设备要求',
              dataIndex: 'equipment',
              renderText: (v) =>
                v === 'Required' ? '必须使用设备' : '按需使用',
            },
          ]}
        />
      )}
      {item.prescription?.specialty && (
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Typography.Text strong>原专科处方范围（保留）</Typography.Text>
          <Table
            rowKey={(r) => `${r.point}:${r.side}`}
            pagination={false}
            dataSource={item.prescription.specialty.points}
            columns={[
              { title: '穴位', dataIndex: 'point' },
              {
                title: '侧别',
                dataIndex: 'side',
                render: (v: string) =>
                  ({ Left: '左', Right: '右', Midline: '中线' })[v] || v,
              },
            ]}
          />
          <Table
            rowKey={(r) => `${r.resource}:${r.mode}`}
            pagination={false}
            dataSource={item.prescription.specialty.device_modes}
            columns={[
              { title: '设备', dataIndex: 'resource' },
              { title: '模式', dataIndex: 'mode' },
            ]}
          />
          <Table
            rowKey={(r) => `${r.scene}:${r.difficulty}`}
            pagination={false}
            dataSource={item.prescription.specialty.vr_scenes}
            columns={[
              { title: '场景', dataIndex: 'scene' },
              { title: '难度', dataIndex: 'difficulty' },
            ]}
          />
        </Space>
      )}
      {risk && (
        <>
          <ProDescriptions
            column={1}
            dataSource={risk}
            columns={[
              {
                title: '风险结论',
                dataIndex: 'disposition',
                renderText: (v) =>
                  ({
                    Clear: '已核对，无需额外处置',
                    Precautions: '按注意事项治疗',
                    'Do Not Treat': '暂不治疗',
                  })[v as string] || v,
              },
              { title: '实际核对时间', dataIndex: 'assessed_at' },
              { title: '注意及处置方案', dataIndex: 'precautions' },
            ]}
          />
          <Table
            rowKey="key"
            dataSource={risk.checks}
            pagination={false}
            columns={[
              { title: '风险项', dataIndex: 'label' },
              { title: '核对结果', dataIndex: 'result' },
              { title: '发现', dataIndex: 'finding' },
            ]}
          />
        </>
      )}
    </Space>
  );
}

function OrderDetails({ record }: { record: S.OrderDetail }) {
  const native = record.row.doctype === 'Rehab Order';
  const content = record.content;
  const item = native
    ? {
        kind: 'Treatment' as const,
        order_item: content.rehab_order_item as string,
        therapy_type: content.therapy_type as string,
        sessions: content.sessions_planned as number,
        order_term: content.order_term as string,
        start_date: content.start_date as string,
        end_date: content.end_date as string,
        notes: content.clinical_notes as string,
        clinical_reviewer: content.clinical_reviewer as string,
        prescription: content.prescription_json as S.Prescription,
      }
    : (content.item as S.OrderItem | undefined);
  return (
    <Tabs
      items={[
        {
          key: 'content',
          label: '医嘱内容',
          children: (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <ProDescriptions
                column={1}
                dataSource={record.row}
                columns={[
                  { title: '编号', dataIndex: 'name' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    renderText: (v) => S.states[v] || v,
                  },
                  { title: '开立人', dataIndex: 'author' },
                ]}
              />
              {(content.items || (item ? [item] : [])).map((row, i) => (
                <ProCard
                  key={JSON.stringify(row)}
                  title={`${i + 1}. ${S.kindName(row.kind)}`}
                >
                  <ItemDetails item={row} />
                </ProCard>
              ))}
            </Space>
          ),
        },
        {
          key: 'tasks',
          label: '执行记录',
          children: (
            <Table
              rowKey="name"
              pagination={{ pageSize: 10 }}
              dataSource={record.tasks || []}
              columns={[
                { title: '任务', dataIndex: 'name' },
                { title: '状态', dataIndex: 'status' },
                { title: '开始', dataIndex: 'starts_at', render: text },
                { title: '执行人', dataIndex: 'assigned_to' },
              ]}
              scroll={{ x: 500 }}
            />
          ),
        },
        {
          key: 'history',
          label: '操作记录',
          children: (
            <Table
              rowKey="name"
              pagination={{ pageSize: 10 }}
              dataSource={record.events || []}
              columns={[
                { title: '记录', dataIndex: 'name' },
                {
                  title: '动作',
                  dataIndex: 'action',
                  render: (value) =>
                    value === 'Booking Confirmed' ? '确认可预约' : text(value),
                },
                { title: '人员', dataIndex: 'actor' },
                { title: '时间', dataIndex: 'event_time', render: text },
                { title: '说明', dataIndex: 'comment' },
              ]}
              scroll={{ x: 500 }}
            />
          ),
        },
      ]}
    />
  );
}

function AssessmentDetails({ value }: { value: Record<string, unknown> }) {
  const task = (value.task || value) as Record<string, unknown>;
  const rules = task.rule_result as ScoreDetails | undefined;
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <ProDescriptions
        column={1}
        dataSource={task}
        columns={[
          { title: '患者', dataIndex: 'patient_name' },
          { title: '量表', dataIndex: 'assessment_template' },
          { title: '状态', dataIndex: 'status' },
          {
            title: '阶段',
            dataIndex: 'stage',
            renderText: (v) => stageNames[v] || v,
          },
          { title: '评估人', dataIndex: 'assigned_to' },
          { title: '实际评估时间', dataIndex: 'assessed_at' },
          { title: '总分', dataIndex: 'total_score' },
          { title: '结论', dataIndex: 'conclusion' },
          { title: '建议', dataIndex: 'recommendations' },
        ]}
      />
      {rules ? (
        <ScoreBreakdown value={rules} />
      ) : (
        <Table
          rowKey="idx"
          pagination={false}
          scroll={{ x: 500 }}
          dataSource={(task.responses || []) as Record<string, unknown>[]}
          columns={[
            { title: '评估项目', dataIndex: 'parameter' },
            {
              title: '是否已评',
              dataIndex: 'answered',
              render: (v) => (v ? '已评' : '未评'),
            },
            {
              title: '分值',
              dataIndex: 'score',
              render: (v, row) => (row.answered ? text(v) : '未评'),
            },
          ]}
        />
      )}
    </Space>
  );
}
