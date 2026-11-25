import {
  ModalForm,
  ProFormDateRangePicker,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  errorMessage,
  kinds,
  mutate,
  type Plan,
  type Preview,
  type PreviewRow,
  statuses,
} from './service';

export default function Generation({
  name,
  onClose,
  onSaved,
}: {
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [plan, setPlan] = useState<Plan>();
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<Preview>();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const busy = useRef(false);
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    api<Plan>('get_plan', { name })
      .then((value) => {
        if (!active) return;
        setPlan(value);
        const start = dayjs(value.starts_on).isAfter(
          dayjs(value.site_today),
          'day',
        )
          ? dayjs(value.starts_on)
          : dayjs(value.site_today);
        const proposedEnd = start.add(6, 'day');
        form.setFieldsValue({
          dates: [
            start.format('YYYY-MM-DD'),
            (proposedEnd.isAfter(value.ends_on, 'day')
              ? dayjs(value.ends_on)
              : proposedEnd
            ).format('YYYY-MM-DD'),
          ],
          therapists: value.people.map((p) => p.therapist),
        });
      })
      .catch((reason) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [name, form]);
  const close = () => {
    if (!busy.current) onClose();
  };
  return (
    <ModalForm
      name="roster-generation"
      title="生成排班 · 预览与确认"
      open
      form={form}
      loading={loading}
      width="min(1100px, 100vw)"
      modalProps={{
        destroyOnHidden: true,
        closable: !working,
        keyboard: !working,
        mask: { closable: !working },
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onValuesChange={() => {
        setPreview(undefined);
        setError(undefined);
      }}
      submitter={{
        render: (props) => [
          <Button key="cancel" disabled={working || loading} onClick={close}>
            关闭
          </Button>,
          <Button
            key="preview"
            loading={working && !preview}
            disabled={!plan?.can_generate || working}
            onClick={() => props.form?.submit()}
          >
            {preview ? '重新预览' : '预览排班'}
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
                const result = await mutate<{
                  created: number;
                  skipped: number;
                }>('confirm_generation', { token: preview.token });
                message.success(
                  `已生成 ${result.created} 条排班明细，跳过 ${result.skipped} 条`,
                );
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
            确认生成
          </Button>,
        ],
      }}
      onFinish={async (values) => {
        if (!plan || busy.current) return false;
        busy.current = true;
        setWorking(true);
        setError(undefined);
        setPreview(undefined);
        try {
          const value = await mutate<Preview>('preview_generation', {
            name,
            modified: plan.modified,
            starts_on: values.dates[0],
            ends_on: values.dates[1],
            therapists: values.therapists,
            reason: values.reason,
          });
          setPreview(value);
        } catch (reason) {
          setError(errorMessage(reason));
        } finally {
          busy.current = false;
          setWorking(false);
        }
        return false;
      }}
    >
      {error && <Alert type="error" showIcon title={error} />}
      {plan && (
        <Alert
          type="info"
          showIcon
          title={`${plan.plan_title} · 版本 ${plan.revision} · 有效期 ${plan.starts_on} 至 ${plan.ends_on}`}
          description={`时间按站点设置（${plan.site_timezone || '本地时间'}）。仅生成实际班次，不生成患者预约或治疗任务。每次最多 31 天、300 条明细；已有日期保留原记录。`}
        />
      )}
      <ProFormDateRangePicker
        name="dates"
        label="生成日期范围"
        rules={[{ required: true }]}
        disabled={working || loading}
      />
      <ProFormSelect
        name="therapists"
        label="生成适用人员"
        options={plan?.staff_choices}
        fieldProps={{ mode: 'multiple' }}
        rules={[{ required: true }]}
        disabled={working || loading}
      />
      <ProFormTextArea
        name="reason"
        label="生成说明"
        rules={[{ required: true }, { max: 1000 }]}
        disabled={working || loading}
      />
      {preview && (
        <>
          <Alert
            type={preview.counts.Blocked ? 'warning' : 'success'}
            showIcon
            title={`可生成 ${preview.counts.Ready} 条，已生成跳过 ${preview.counts.Existing} 条，已开始跳过 ${preview.counts.Past} 条，存在问题 ${preview.counts.Blocked} 条`}
            description={
              preview.counts.Blocked
                ? '请先处理存在的问题，再重新预览。此时没有生成任何排班。'
                : '请核对下表后确认；提交时会再次检查权限、人员范围及时间冲突。'
            }
          />
          <ProTable<PreviewRow>
            rowKey="key"
            dataSource={preview.rows}
            search={false}
            options={false}
            pagination={{ defaultPageSize: 10 }}
            scroll={{ x: 1000 }}
            columns={[
              { title: '人员', dataIndex: 'person', width: 130 },
              { title: '日期', dataIndex: 'work_date', width: 110 },
              {
                title: '开始',
                dataIndex: 'starts_at',
                render: (_, r) => r.starts_at.slice(11, 16),
              },
              {
                title: '结束',
                dataIndex: 'ends_at',
                render: (_, r) => r.ends_at.slice(11, 16),
              },
              { title: '类型', dataIndex: 'work_kind', valueEnum: kinds },
              {
                title: '项目',
                dataIndex: 'projects',
                render: (_, r) => r.projects.join('、') || '—',
              },
              {
                title: '结果',
                dataIndex: 'status',
                width: 130,
                render: (_, r) => (
                  <Tag
                    color={
                      r.status === 'Blocked'
                        ? 'error'
                        : r.status === 'Ready'
                          ? 'success'
                          : 'default'
                    }
                  >
                    {statuses[r.status as keyof typeof statuses]}
                  </Tag>
                ),
              },
              {
                title: '说明',
                dataIndex: 'issue',
                width: 280,
                render: (_, r) =>
                  `${r.issue}${r.previous_revisions.length ? `（原版本 ${r.previous_revisions.join('、')}）` : ''}`,
              },
            ]}
          />
        </>
      )}
    </ModalForm>
  );
}
