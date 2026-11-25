import {
  ProDescriptions,
  ProForm,
  ProFormCheckbox,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Drawer,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { chargeProgressText } from '../ChargeCatalog/executionChargeService';
import { errorMessage } from '../ChargeCatalog/feedback';
import { type Choice, call, command, load, type TaskDetail } from './service';

const titles = {
  arrival: '登记到诊',
  claim: '确认接单',
  identity: '核对患者身份',
  risk: '核对治疗风险',
  start: '开始治疗',
  observe: '记录过程观察',
  finish: '结束治疗',
  interrupt: '登记中断并交接',
  unfinished: '登记未完成',
  finalize: '提交治疗记录并完成任务',
} as const;
type Mode = keyof typeof titles;
const required = [{ required: true }];
const acknowledged = [
  {
    validator: (_: unknown, value: unknown) =>
      value === true
        ? Promise.resolve()
        : Promise.reject(new Error('请核对后勾选确认')),
  },
];
const arrived = new Set(['Arrived', 'Waiting', 'Called', 'Present']);

export default function TaskDrawer({
  name,
  onClose,
  onChanged,
}: {
  name: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [version, setVersion] = useState(0);
  const [episode, setEpisode] = useState('');
  const [content, setContent] = useState<TaskDetail>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<Mode>();
  const [notice, setNotice] = useState<string>();
  const lastRequest = useRef<{ key: string; id: string }>(undefined);
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    setContent(undefined);
    setError(undefined);
    load<TaskDetail>('detail', { name, episode })
      .then((value) => {
        if (active) setContent(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [episode, name, version]);

  const reload = () => {
    setVersion((value) => value + 1);
    onChanged();
  };

  const run = content?.run.execution;
  const task = content?.task;
  const onsite = content?.onsite;
  const effectiveEpisode = episode || content?.episode;
  const clinicalReady = Boolean(
    content?.own && onsite?.can_verify && onsite.clinical_ready,
  );
  const atClinic = Boolean(
    content &&
      (arrived.has(content.arrival.status) ||
        content.identity.care_setting === 'Bedside'),
  );
  const startBlocker = content?.start_window?.reason;

  useEffect(() => {
    const refreshAfter = content?.start_window?.refresh_after_ms;
    if (!refreshAfter || mode || busy) return;
    const timer = window.setTimeout(
      () => setVersion((value) => value + 1),
      Math.min(refreshAfter + 100, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [content, mode, busy]);

  async function perform(operation: string, payload: Record<string, unknown>) {
    const key = JSON.stringify([operation, payload]);
    if (lastRequest.current?.key !== key)
      lastRequest.current = { key, id: crypto.randomUUID() };
    const result = await command(operation, lastRequest.current.id, payload);
    lastRequest.current = undefined;
    return result;
  }

  async function submit(values: Record<string, unknown>) {
    if (!content || !task || !mode || busy) return false;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const base = { name: task.name, expected_modified: task.modified };
    const procedure = {
      ...base,
      episode: effectiveEpisode,
      patient: task.patient,
      encounter_key: content.visit.key,
    };
    try {
      switch (mode) {
        case 'arrival':
          await perform('checkin_arrive', {
            ...base,
            ...values,
            actual_at: values.actual_at,
          });
          break;
        case 'claim':
          await perform('execution_claim', {
            ...procedure,
            note: values.note || '',
          });
          break;
        case 'identity': {
          const result = await perform('execution_identity', {
            ...procedure,
            ...values,
            method: 'Manual',
            face_confirmed: values.face_confirmed ? 1 : 0,
            encounter: content.visit.key,
            episode_id: effectiveEpisode,
            task_id: task.name,
          });
          if (result.matched !== true)
            setNotice('现场身份核对未通过，请重新核实患者身份和本次安排。');
          break;
        }
        case 'risk':
          await perform('execution_risk', {
            ...procedure,
            identity_check: onsite?.identity?.name,
            keys: values.keys || [],
            onsite_clear: values.onsite_clear ? 1 : 0,
          });
          break;
        case 'start':
          await perform('execution_start', {
            ...procedure,
            ...values,
            location_confirmed: values.location_confirmed ? 1 : 0,
            identity_check: onsite?.identity?.name,
            risk_check: onsite?.risk_check?.name,
          });
          break;
        case 'observe':
          await perform('execution_observe', {
            ...base,
            expected_modified: run?.modified,
            content: values.content,
          });
          break;
        case 'finish':
          await perform('execution_finish', {
            ...base,
            ...values,
            expected_modified: run?.modified,
            amount: String(values.amount),
            time_mode: 'Now',
            draft_revision: content.run.draft?.name || '',
          });
          break;
        case 'interrupt':
          await perform('interrupt_submit', {
            ...base,
            ...values,
            expected_modified: run?.modified,
            amount: String(values.amount),
            time_mode: 'Now',
          });
          break;
        case 'unfinished':
          await perform('treatment_not_completed', {
            ...base,
            reason: values.reason,
          });
          break;
        case 'finalize':
          await call('execution_document_api', 'register_native', {
            ...base,
            therapy_plan: values.therapy_plan,
            expected_execution_modified: run?.modified,
            confirmed: values.confirmed,
          });
          break;
      }
      if (mode !== 'identity') message.success('操作已保存');
      setMode(undefined);
      reload();
      return true;
    } catch (reason) {
      setError(errorMessage(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const button = (key: Mode, primary = false) => (
    <Button
      type={primary ? 'primary' : 'default'}
      disabled={busy}
      onClick={() => {
        setMode(key);
        setError(undefined);
        setNotice(undefined);
      }}
    >
      {titles[key]}
    </Button>
  );

  return (
    <Drawer
      title="治疗任务"
      open
      size="min(920px, 100vw)"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {error && (
          <Alert
            type="error"
            showIcon
            title={error}
            action={
              <Button
                size="small"
                disabled={busy}
                onClick={() => {
                  setMode(undefined);
                  reload();
                }}
              >
                刷新任务
              </Button>
            }
          />
        )}
        {notice && <Alert type="warning" showIcon title={notice} />}
        {!content && !error && <Spin />}
        {content && task && (
          <>
            <ProDescriptions
              column={2}
              dataSource={task}
              columns={[
                { title: '患者', render: () => content.identity.patient_name },
                { title: '本次就诊', render: () => content.visit.name || '—' },
                { title: '治疗项目', dataIndex: 'therapy_type' },
                { title: '康复医嘱', dataIndex: 'rehab_order' },
                { title: '责任治疗师', render: () => content.responsible_name },
                {
                  title: '预约时段',
                  render: () => `${task.starts_at} 至 ${task.ends_at}`,
                },
                { title: '治疗场地', dataIndex: 'room_label' },
                { title: '治疗设备', dataIndex: 'equipment_label' },
                {
                  title: '到诊状态',
                  render: () =>
                    [content.arrival.label, content.arrival.actual_at]
                      .filter(Boolean)
                      .join(' · '),
                },
                { title: '医院时区', render: () => content.timezone },
                ...(content.billing
                  ? [
                      {
                        title: '收费进度',
                        render: () =>
                          content.billing &&
                          chargeProgressText(content.billing),
                      },
                    ]
                  : []),
              ]}
            />
            {task.clinical_notes_snapshot && (
              <Alert
                type="info"
                showIcon
                title="医嘱注意事项"
                description={task.clinical_notes_snapshot}
              />
            )}
            {task.execution.order_ready === false && !run && (
              <Alert
                type="warning"
                showIcon
                title={task.execution.label}
                description={task.execution.reason}
              />
            )}
            {content.arrival.reason && (
              <Alert type="warning" showIcon title={content.arrival.reason} />
            )}
            {content.arrival_blocker && (
              <Alert
                type="warning"
                showIcon
                title="暂不可登记到诊"
                description={content.arrival_blocker}
              />
            )}
            {content.own &&
              task.status === 'Scheduled' &&
              !content.qualification.passed &&
              content.qualification.reason && (
                <Alert
                  type="warning"
                  showIcon
                  title={content.qualification.reason}
                />
              )}
            {task.status === 'Accepted' && !run && content.own && (
              <>
                {content.episodes.length > 0 ? (
                  <Space wrap>
                    <Typography.Text>康复疗程</Typography.Text>
                    <Select
                      aria-label="康复疗程"
                      value={effectiveEpisode}
                      onChange={(value) => {
                        setMode(undefined);
                        setEpisode(value);
                      }}
                      options={content.episodes.map((item) => ({
                        value: item.name,
                        label: item.title,
                      }))}
                    />
                  </Space>
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    title="本医嘱尚无可用的康复疗程关联"
                  />
                )}
                {onsite?.reason && (
                  <Alert type="info" showIcon title={onsite.reason} />
                )}
                {startBlocker && (
                  <Alert type="info" showIcon title={startBlocker} />
                )}
                <Space wrap>
                  {onsite?.identity && <Tag color="success">身份已核对</Tag>}
                  {onsite?.risk_check && <Tag color="success">风险已核对</Tag>}
                </Space>
              </>
            )}
            {run && (
              <ProDescriptions
                column={2}
                dataSource={run}
                columns={[
                  { title: '实际开始', dataIndex: 'actual_start' },
                  { title: '实际结束', dataIndex: 'actual_end' },
                  { title: '实际地点', dataIndex: 'actual_location' },
                  {
                    title: '执行量',
                    render: () =>
                      run.amount === undefined
                        ? '—'
                        : `${run.amount ?? '—'} ${run.unit || ''}`,
                  },
                  { title: '执行结局', dataIndex: 'result' },
                  { title: '患者反应', dataIndex: 'reaction' },
                ]}
              />
            )}
            {run?.clinical_notice && (
              <Alert type="warning" showIcon title={run.clinical_notice} />
            )}
            {content.run.observations?.length > 0 && (
              <Space orientation="vertical">
                <Typography.Text strong>过程观察</Typography.Text>
                {content.run.observations.map((item) => (
                  <Typography.Text key={item.name}>
                    {item.observed_at} · {item.actor_name} · {item.content}
                  </Typography.Text>
                ))}
              </Space>
            )}
            {!mode && (
              <Space wrap>
                {content.can_arrive && button('arrival', true)}
                {atClinic &&
                  content.capabilities.can_accept &&
                  button('claim', true)}
                {atClinic &&
                  clinicalReady &&
                  !onsite?.identity &&
                  button('identity', true)}
                {atClinic &&
                  clinicalReady &&
                  onsite?.identity &&
                  onsite.risk &&
                  !onsite.risk_check &&
                  button('risk', true)}
                {atClinic &&
                  clinicalReady &&
                  onsite?.identity &&
                  onsite.risk_check &&
                  !startBlocker &&
                  button('start', true)}
                {content.run.can_record && (
                  <>
                    {button('observe')}
                    {button('finish', true)}
                    {button('interrupt')}
                  </>
                )}
                {content.capabilities.can_not_complete &&
                  !run &&
                  button('unfinished')}
                {content.own &&
                  content.can_finalize &&
                  content.plans.length > 0 &&
                  button('finalize', true)}
              </Space>
            )}
            {content.own && content.can_finalize && !content.plans.length && (
              <Alert
                type="warning"
                showIcon
                title="缺少本医嘱可用的原生治疗计划或读取权限"
              />
            )}
            {mode && (
              <ModeForm
                key={mode}
                mode={mode}
                content={content}
                busy={busy}
                submit={submit}
                close={() => setMode(undefined)}
              />
            )}
          </>
        )}
      </Space>
    </Drawer>
  );
}

function ModeForm({
  mode,
  content,
  busy,
  submit,
  close,
}: {
  mode: Mode;
  content: TaskDetail;
  busy: boolean;
  submit: (value: Record<string, unknown>) => Promise<boolean>;
  close: () => void;
}) {
  const risks = content.onsite?.risk;
  const units = content.run.units.map((unit) => ({ value: unit, label: unit }));
  const plans = content.plans.map((row) => ({
    value: row.name,
    label: row.name,
  }));
  return (
    <>
      <Typography.Title level={5}>{titles[mode]}</Typography.Title>
      <ProForm<Record<string, unknown>>
        disabled={busy}
        initialValues={{
          method: '证件与本人核对',
          actual_at: dayjs(content.now),
          ...(mode === 'finish' ? content.run.draft?.content : undefined),
          therapy_plan: plans.length === 1 ? plans[0].value : undefined,
        }}
        onFinish={submit}
        submitter={{
          searchConfig: { submitText: '确认保存', resetText: '返回' },
          onReset: close,
          submitButtonProps: { loading: busy },
          resetButtonProps: { disabled: busy },
        }}
      >
        {(mode === 'arrival' || mode === 'identity') && (
          <>
            <ProFormText
              name="patient_id"
              label="现场核对的患者编号"
              rules={required}
            />
            <ProFormText
              name="patient_name"
              label="现场核对的患者姓名"
              rules={required}
            />
          </>
        )}
        {mode === 'arrival' && (
          <>
            <ProFormDateTimePicker
              name="actual_at"
              label="实际到达时间"
              rules={required}
              fieldProps={{ format: 'YYYY-MM-DD HH:mm:ss' }}
              transform={(value) => ({
                actual_at: dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
              })}
            />
            <ProFormSelect
              name="method"
              label="核对方式"
              rules={required}
              options={['证件与本人核对', '腕带与本人核对', '离线补登记']}
            />
            <ProFormTextArea
              name="reason"
              label="到诊登记说明"
              rules={required}
            />
            <ProFormCheckbox name="identity_confirmed" rules={acknowledged}>
              已当面核对患者身份和本次预约
            </ProFormCheckbox>
          </>
        )}
        {mode === 'claim' && (
          <ProFormTextArea name="note" label="接单交接说明" />
        )}
        {mode === 'identity' && (
          <>
            <ProFormTextArea
              name="note"
              label="现场核验依据"
              rules={required}
            />
            <ProFormCheckbox name="face_confirmed" rules={acknowledged}>
              已当面确认患者身份及本次治疗
            </ProFormCheckbox>
          </>
        )}
        {mode === 'risk' && risks && (
          <>
            {(risks.precautions || risks.allergies) && (
              <Alert
                type="info"
                showIcon
                title="注意事项和过敏信息"
                description={[risks.precautions, risks.allergies]
                  .filter(Boolean)
                  .join('；')}
              />
            )}
            <ProFormCheckbox.Group
              name="keys"
              label="逐项核对"
              rules={[
                { type: 'array', min: risks.checks.length, required: true },
              ]}
              options={risks.checks.map((item) => ({
                value: item.key,
                label: [item.label, item.finding].filter(Boolean).join(' · '),
              }))}
            />
            <ProFormCheckbox name="onsite_clear" rules={acknowledged}>
              已核对现场风险，符合本次治疗条件
            </ProFormCheckbox>
          </>
        )}
        {mode === 'start' && (
          <>
            <ProFormText
              name="actual_location"
              label="实际执行地点"
              rules={required}
            />
            <ProFormCheckbox name="location_confirmed" rules={acknowledged}>
              已确认实际执行地点和治疗准备情况
            </ProFormCheckbox>
          </>
        )}
        {mode === 'observe' && (
          <ProFormTextArea name="content" label="过程观察" rules={required} />
        )}
        {(mode === 'finish' || mode === 'interrupt') && (
          <>
            <ProFormDigit
              name="amount"
              label="实际执行量"
              min={0}
              rules={required}
            />
            <ProFormSelect
              name="unit"
              label="执行量单位"
              options={units}
              rules={required}
            />
            <ProFormTextArea
              name="result"
              label="实际治疗结果"
              rules={required}
            />
            <ProFormTextArea
              name="reaction"
              label="患者反应"
              rules={required}
            />
          </>
        )}
        {mode === 'interrupt' && (
          <>
            <ProFormSelect
              name="receiver"
              label="负责医护接收人"
              rules={required}
              showSearch
              request={async ({ keyWords }) => {
                const people = await call<Choice[]>(
                  'treatment_v9_api',
                  'directory',
                  { company: content.task.company, search: keyWords || '' },
                );
                return people;
              }}
              fieldProps={{ filterOption: false }}
            />
            <ProFormTextArea name="reason" label="中断原因" rules={required} />
            <ProFormTextArea
              name="handling"
              label="现场处理及待交接事项"
              rules={required}
            />
          </>
        )}
        {mode === 'unfinished' && (
          <ProFormTextArea name="reason" label="未完成原因" rules={required} />
        )}
        {mode === 'finalize' && (
          <>
            <ProFormSelect
              name="therapy_plan"
              label="本次医嘱对应的治疗计划"
              options={plans}
              rules={required}
            />
            <ProFormCheckbox name="confirmed" rules={acknowledged}>
              本人已核对并确认本次实际治疗记录
            </ProFormCheckbox>
          </>
        )}
      </ProForm>
    </>
  );
}
