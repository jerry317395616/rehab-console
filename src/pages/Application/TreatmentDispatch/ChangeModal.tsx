import {
  ModalForm,
  ProDescriptions,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import {
  type Action,
  actions,
  api,
  type Choice,
  errorMessage,
  mutate,
  type Options,
  type Preview,
  type Row,
} from './service';

export default function ChangeModal({
  row,
  action,
  options,
  onClose,
  onSaved,
}: {
  row: Row;
  action: Action;
  options: Options;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const choose = action === 'assign' || action === 'adjust';
  const [loadingTime, setLoadingTime] = useState(choose);
  const [clockAttempt, setClockAttempt] = useState(0);
  const [lookupError, setLookupError] = useState<string>();
  const team = Form.useWatch('team', form),
    effective = Form.useWatch('effective_from', form);
  const at =
    effective && !loadingTime
      ? dayjs(effective).format('YYYY-MM-DD HH:mm:00')
      : undefined;
  const [preview, setPreview] = useState<Preview>(),
    [error, setError] = useState<string>(),
    [working, setWorking] = useState(false);
  const [candidate, setCandidate] = useState<Choice>();
  const busy = useRef(false);
  const lookup = useRef(0);
  const { message } = App.useApp();
  const close = () => {
    if (!busy.current) onClose();
  };
  useEffect(() => {
    if (!choose) return;
    let active = true;
    api<Options>('get_options')
      .then(({ site_now }) => {
        if (!active) return;
        const earliest = dayjs(site_now).add(5, 'minute');
        form.setFieldValue(
          'effective_from',
          dayjs(row.starts_on).isAfter(earliest)
            ? `${row.starts_on} 00:00:00`
            : earliest.format('YYYY-MM-DD HH:mm:00'),
        );
      })
      .catch((reason) => active && setLookupError(errorMessage(reason)))
      .finally(() => active && setLoadingTime(false));
    return () => {
      active = false;
    };
  }, [choose, clockAttempt, form, row.starts_on]);
  return (
    <ModalForm
      name="treatment-dispatch-change"
      title={`${actions[action]} · 预览与确认`}
      open
      form={form}
      width="min(900px, 100vw)"
      initialValues={{ team: row.team }}
      modalProps={{
        destroyOnHidden: true,
        closable: !working,
        keyboard: !working,
        mask: { closable: !working },
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onValuesChange={(changed) => {
        setPreview(undefined);
        setError(undefined);
        if ('team' in changed || 'effective_from' in changed) {
          lookup.current += 1;
          setLookupError(undefined);
          form.setFieldValue('therapist', undefined);
          setCandidate(undefined);
        }
      }}
      submitter={{
        render: (props) => [
          <Button key="close" disabled={working} onClick={close}>
            关闭
          </Button>,
          <Button
            key="preview"
            disabled={working || loadingTime}
            loading={working && !preview}
            onClick={() => props.form?.submit()}
          >
            {preview ? '重新预览' : '预览变更'}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            disabled={!preview?.can_confirm || working}
            loading={working && Boolean(preview)}
            onClick={async () => {
              if (!preview?.can_confirm || busy.current) return;
              busy.current = true;
              setWorking(true);
              setError(undefined);
              try {
                await mutate('confirm_change', { token: preview.token });
                message.success(`${actions[action]}已完成，已有预约保持原安排`);
                onSaved();
                onClose();
              } catch (reason) {
                setError(errorMessage(reason));
                setPreview(undefined);
              } finally {
                busy.current = false;
                setWorking(false);
              }
            }}
          >
            确认变更
          </Button>,
        ],
      }}
      onFinish={async (values) => {
        if (busy.current) return false;
        busy.current = true;
        setWorking(true);
        setError(undefined);
        setPreview(undefined);
        const data: Record<string, unknown> = {
          name: row.name,
          modified: row.modified,
          assignment_token: row.assignment_token,
          action,
          reason: values.reason,
        };
        if (choose || action === 'enqueue') data.team = values.team;
        if (choose) {
          data.therapist = values.therapist;
          data.effective_from = dayjs(values.effective_from).format(
            'YYYY-MM-DD HH:mm:00',
          );
        }
        try {
          setPreview(await mutate<Preview>('preview_change', data));
        } catch (reason) {
          setError(errorMessage(reason));
        } finally {
          busy.current = false;
          setWorking(false);
        }
        return false;
      }}
    >
      <Alert
        type="info"
        showIcon
        title={`${row.patient_name} · ${row.therapy_type}`}
        description={`仅维护这条医嘱的责任分派。时间按站点设置（${options.timezone}）；已有预约、治疗任务和收费不随本次操作改变。`}
      />
      {error && <Alert type="error" showIcon title={error} />}
      {lookupError && (
        <Alert
          type="warning"
          showIcon
          title={lookupError}
          action={
            <Button
              size="small"
              disabled={working || loadingTime}
              onClick={() => {
                lookup.current += 1;
                setLookupError(undefined);
                setLoadingTime(true);
                setPreview(undefined);
                setCandidate(undefined);
                form.setFieldsValue({
                  effective_from: undefined,
                  therapist: undefined,
                });
                setClockAttempt((attempt) => attempt + 1);
              }}
            >
              刷新生效时间
            </Button>
          }
        />
      )}
      {(choose || action === 'enqueue') && (
        <ProFormSelect
          name="team"
          label="治疗组"
          rules={[{ required: true }]}
          params={{ name: row.name }}
          request={({ keyWords }) =>
            api<Choice[]>('teams', { name: row.name, keyword: keyWords || '' })
          }
          fieldProps={{ showSearch: true, filterOption: false }}
          disabled={working}
        />
      )}
      {choose && (
        <>
          <ProFormDateTimePicker
            name="effective_from"
            label="分派生效时间"
            rules={[{ required: true }]}
            fieldProps={{
              format: 'YYYY-MM-DD HH:mm',
              placeholder: loadingTime ? '正在读取站点时间' : '请选择生效时间',
            }}
            disabled={working || loadingTime}
          />
          <ProFormSelect
            name="therapist"
            label="责任治疗师"
            rules={[{ required: true }]}
            params={{ team, at }}
            request={async ({ keyWords }) => {
              if (!team || !at) return [];
              const requestId = ++lookup.current;
              setLookupError(undefined);
              try {
                return await api<Choice[]>('people', {
                  name: row.name,
                  team,
                  effective_from: at,
                  keyword: keyWords || '',
                });
              } catch (reason) {
                if (requestId === lookup.current)
                  setLookupError(errorMessage(reason));
                return [];
              }
            }}
            fieldProps={{
              showSearch: true,
              filterOption: false,
              notFoundContent: lookupError ? '候选人查询失败' : undefined,
              onChange: (_, option) =>
                setCandidate(
                  option && !Array.isArray(option)
                    ? (option as Choice)
                    : undefined,
                ),
            }}
            disabled={working || loadingTime || !team || !at}
          />
          {candidate && (
            <Alert
              type="info"
              showIcon
              title={
                candidate.has_shift === true
                  ? '未来7天可读取到该项目班次，具体预约时段仍须校验。'
                  : '未来7天尚未核实可预约班次，本次可以先确定责任人。'
              }
              description={
                candidate.visible_booked_minutes == null
                  ? '当前权限下未核实预约工作量。'
                  : `未来7天可见的主责预约工作量：${candidate.visible_booked_minutes} 分钟；协作占用和其他冲突在具体预约时再次校验。`
              }
            />
          )}
        </>
      )}
      <ProFormTextArea
        name="reason"
        label="办理说明"
        rules={[{ required: true }, { max: 1000 }]}
        disabled={working}
      />
      {preview && (
        <>
          <Alert
            type="success"
            showIcon
            title="预览通过，请核对责任变更后确认。"
          />
          {preview.warnings.map((warning) => (
            <Alert key={warning} type="warning" showIcon title={warning} />
          ))}
          <ProDescriptions
            column={1}
            columns={[
              {
                title: '原责任治疗师',
                render: () => preview.before.responsibility,
              },
              { title: '原治疗组', render: () => preview.before.team_label },
              {
                title: '变更后责任',
                render: () => preview.after.responsibility || '撤回待办',
              },
              {
                title: '变更后治疗组',
                render: () => preview.after.team_label || '—',
              },
              {
                title: '生效时间',
                render: () => preview.after.effective_from || '确认后生效',
              },
            ]}
          />
        </>
      )}
    </ModalForm>
  );
}
