import {
  ModalForm,
  ProFormDateRangePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormTimePicker,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import {
  type Action,
  actions,
  api,
  type Choice,
  errorMessage,
  mutate,
  type Preview,
  type Row,
} from './service';

export default function ChangeModal({
  row,
  action,
  timezone,
  onClose,
  onSaved,
}: {
  row: Row;
  action: Action;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const range = Form.useWatch('candidate_dates', form);
  const candidateStart = range?.[0]
    ? dayjs(range[0]).format('YYYY-MM-DD')
    : undefined;
  const candidateEnd = range?.[1]
    ? dayjs(range[1]).format('YYYY-MM-DD')
    : undefined;
  const [preview, setPreview] = useState<Preview>(),
    [error, setError] = useState<string>(),
    [working, setWorking] = useState(false);
  const secondVersion = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const { message } = App.useApp();
  const close = () => {
    if (!busy.current) onClose();
  };
  return (
    <ModalForm
      name="roster-detail-change"
      title={`${actions[action]} · 预览与确认`}
      open
      form={form}
      width="min(1150px, 100vw)"
      initialValues={{
        start: row.starts_at.slice(11, 16),
        end: row.ends_at.slice(11, 16),
        evidence: action === 'enable' ? row.credential_reference : '',
        candidate_dates: [
          row.work_date,
          dayjs(row.work_date).add(30, 'day').format('YYYY-MM-DD'),
        ],
      }}
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
        if ('candidate_dates' in changed) {
          form.setFieldValue('second_name', undefined);
          secondVersion.current = undefined;
        }
        setPreview(undefined);
        setError(undefined);
      }}
      submitter={{
        render: (props) => [
          <Button key="close" disabled={working} onClick={close}>
            关闭
          </Button>,
          <Button
            key="preview"
            disabled={working}
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
                message.success(`${actions[action]}已完成，班次历史已保留`);
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
          action,
          reason: values.reason,
        };
        if (action === 'adjust') {
          data.starts_at = `${row.work_date} ${String(values.start).slice(0, 5)}:00`;
          data.ends_at = `${row.work_date} ${String(values.end).slice(0, 5)}:00`;
        }
        if (action === 'replace') {
          data.therapist = values.therapist;
          data.evidence = values.evidence;
        }
        if (action === 'swap') {
          data.second_name = values.second_name;
          data.second_modified = secondVersion.current;
          data.evidence = values.evidence;
          data.second_evidence = values.second_evidence;
        }
        if (action === 'enable') data.evidence = values.evidence;
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
        title={`${row.work_date} ${row.person} ${row.starts_at.slice(11, 16)}–${row.ends_at.slice(11, 16)} · ${row.projects.map((p) => p.label).join('、') || '无预约项目'}`}
        description={`时间按站点设置（${timezone}）。确认前检查人员、项目和占用；变更不自动调整患者预约或治疗任务。`}
      />
      {error && <Alert type="error" showIcon title={error} />}
      {action === 'adjust' && (
        <>
          <ProFormTimePicker
            name="start"
            label="调整后开始时间"
            fieldProps={{ format: 'HH:mm' }}
            rules={[{ required: true }]}
            disabled={working}
          />
          <ProFormTimePicker
            name="end"
            label="调整后结束时间"
            fieldProps={{ format: 'HH:mm' }}
            rules={[{ required: true }]}
            disabled={working}
          />
        </>
      )}
      {action === 'replace' && (
        <ProFormSelect
          name="therapist"
          label="接替治疗师"
          rules={[{ required: true }]}
          params={{ name: row.name }}
          request={({ keyWords }) =>
            api<Choice[]>('people', { name: row.name, keyword: keyWords || '' })
          }
          fieldProps={{ showSearch: true, filterOption: false }}
          disabled={working}
        />
      )}
      {action === 'swap' && (
        <>
          <ProFormDateRangePicker
            name="candidate_dates"
            label="候选班次日期范围"
            disabled={working}
          />
          <ProFormSelect
            name="second_name"
            label="交换的另一班次"
            rules={[{ required: true }]}
            params={{
              name: row.name,
              start: candidateStart,
              end: candidateEnd,
            }}
            request={({ keyWords }) =>
              api<Choice[]>('swap_options', {
                name: row.name,
                keyword: keyWords || '',
                starts_on: candidateStart,
                ends_on: candidateEnd,
              })
            }
            fieldProps={{
              showSearch: true,
              filterOption: false,
              onChange: (_, option) => {
                secondVersion.current =
                  option && !Array.isArray(option)
                    ? String(option.modified || '')
                    : undefined;
              },
            }}
            disabled={working}
          />
        </>
      )}
      {(action === 'replace' || action === 'swap' || action === 'enable') && (
        <ProFormText
          name="evidence"
          label={
            action === 'swap'
              ? '接替第一班次的资质核验依据'
              : '接替或恢复的资质核验依据'
          }
          rules={
            row.projects.length
              ? [{ required: true }, { max: 140 }]
              : [{ max: 140 }]
          }
          disabled={working}
        />
      )}
      {action === 'swap' && (
        <ProFormText
          name="second_evidence"
          label="接替另一班次的资质核验依据"
          rules={[{ required: true }, { max: 140 }]}
          disabled={working}
        />
      )}
      <ProFormTextArea
        name="reason"
        label="变更原因"
        rules={[{ required: true }, { max: 1000 }]}
        disabled={working}
      />
      {preview && (
        <>
          <Alert
            type={preview.can_confirm ? 'success' : 'warning'}
            showIcon
            title={
              preview.can_confirm
                ? '校验通过，请核对前后对照后确认。'
                : '存在冲突，尚未保存任何变更。'
            }
            description={preview.issues.map((i) => i.message).join('；')}
          />
          <ProTable
            rowKey="name"
            dataSource={preview.changes}
            search={false}
            options={false}
            pagination={false}
            scroll={{ x: 950 }}
            columns={[
              {
                title: '日期',
                key: 'date',
                render: (_, r) => r.before.work_date,
              },
              {
                title: '原人员',
                key: 'before_person',
                render: (_, r) => r.before.person,
              },
              {
                title: '变更后人员',
                key: 'after_person',
                render: (_, r) => r.after.person,
              },
              {
                title: '原时段',
                key: 'before_time',
                render: (_, r) =>
                  `${r.before.starts_at.slice(11, 16)}–${r.before.ends_at.slice(11, 16)}`,
              },
              {
                title: '变更后时段',
                key: 'after_time',
                render: (_, r) =>
                  `${r.after.starts_at.slice(11, 16)}–${r.after.ends_at.slice(11, 16)}`,
              },
              {
                title: '可安排项目',
                key: 'projects',
                render: (_, r) =>
                  r.after.projects.map((p) => p.label).join('、') || '—',
              },
              {
                title: '状态变化',
                key: 'state',
                render: (_, r) =>
                  `${r.before.enabled ? '启用' : '停用'} → ${r.after.enabled ? '启用' : '停用'}`,
              },
            ]}
          />
        </>
      )}
    </ModalForm>
  );
}
