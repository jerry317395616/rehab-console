import {
  DrawerForm,
  ProFormCheckbox,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Form, Select, Space } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { changePost } from './bookingService';
import { errorMessage } from './service';

type Task = {
  name: string;
  patient_name: string;
  modified: string;
  starts_at: string;
  ends_at: string;
  episodes: { name: string; title?: string }[];
};
type Context = {
  reference: string;
  modified: string;
  tasks: Task[];
  timezone: string;
};
type Preview = {
  preview_token: string;
  rows: {
    name: string;
    patient_name: string;
    starts_at?: string;
    ends_at?: string;
    targets: { name: string; role: string }[];
    impacts: { object: string; handling: string }[];
  }[];
};

export default function BookingChange({
  kind,
  reference,
  action,
  onClose,
  onSaved,
}: {
  kind: 'Series' | 'Group';
  reference: string;
  action: 'Reschedule' | 'Cancel';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [context, setContext] = useState<Context>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<React.Key[]>([]);
  const [episodes, setEpisodes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview>();
  const requestId = useRef(crypto.randomUUID());
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    changePost<Context>('get_context', { kind, reference })
      .then((value) => {
        if (!active) return;
        setContext(value);
        setSelected(value.tasks.map((t) => t.name));
        setEpisodes(
          Object.fromEntries(
            value.tasks
              .filter((t) => t.episodes.length === 1)
              .map((t) => [t.name, t.episodes[0].name]),
          ),
        );
        form.setFieldsValue({
          shift_days: 7,
          next_step: 'Replan',
          starts_at: value.tasks[0]?.starts_at,
          ends_at: value.tasks[0]?.ends_at,
        });
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [kind, reference, form]);
  function invalidate() {
    setPreview(undefined);
    requestId.current = crypto.randomUUID();
    form.setFieldsValue({ acknowledged: false, targets_confirmed: false });
  }
  return (
    <DrawerForm
      title={`${kind === 'Group' ? '团体场次' : '批量预约'}${action === 'Cancel' ? '取消' : '改约'}`}
      open
      form={form}
      width="min(1100px, 100vw)"
      drawerProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      loading={!context && !error}
      onValuesChange={(changes) => {
        if (
          Object.keys(changes).some(
            (key) =>
              !['acknowledged', 'targets_confirmed', 'reason'].includes(key),
          )
        )
          invalidate();
      }}
      submitter={{
        searchConfig: { submitText: preview ? '确认变更' : '预览影响' },
        submitButtonProps: {
          disabled: Boolean(error || !context?.tasks.length),
        },
      }}
      onFinish={async (values) => {
        if (!context || !selected.length) return false;
        if (selected.some((name) => !episodes[String(name)])) {
          message.warning('请为每个所选任务选择关联疗程');
          return false;
        }
        const data = {
          kind,
          reference,
          expected_modified: context.modified,
          action,
          tasks: context.tasks
            .filter((t) => selected.includes(t.name))
            .map((t) => ({
              name: t.name,
              modified: t.modified,
              episode: episodes[t.name],
            })),
          ...(action === 'Cancel'
            ? { next_step: values.next_step }
            : kind === 'Series'
              ? { shift_days: values.shift_days }
              : {
                  starts_at: dayjs(values.starts_at).format(
                    'YYYY-MM-DD HH:mm:00',
                  ),
                  ends_at: dayjs(values.ends_at).format('YYYY-MM-DD HH:mm:00'),
                }),
        };
        try {
          if (!preview) {
            setPreview(await changePost<Preview>('preview', { data }));
            return false;
          }
          if (!values.acknowledged || !values.targets_confirmed) {
            message.warning('请确认影响范围和通知对象');
            return false;
          }
          await changePost('confirm', {
            data,
            preview_token: preview.preview_token,
            reason: values.reason,
            request_id: requestId.current,
            acknowledged: values.acknowledged,
            targets_confirmed: values.targets_confirmed,
          });
          message.success('变更已保存，原预约及处理记录已保留');
          onSaved();
          return true;
        } catch (reason) {
          setPreview(undefined);
          message.error(errorMessage(reason));
          return false;
        }
      }}
    >
      {error && <Alert type="error" showIcon title={error} />}
      <Alert
        type="info"
        showIcon
        title={
          kind === 'Group'
            ? '统一处理本场全部尚未执行的预约；任一患者不满足条件时，本次全部不保存。'
            : '仅处理勾选的未来未执行预约；已完成任务继续保留。'
        }
      />
      {context && !context.tasks.length && (
        <Alert type="warning" title="没有可统一处理的预约。" />
      )}
      <ProTable<Task>
        rowKey="name"
        search={false}
        options={false}
        pagination={false}
        dataSource={context?.tasks}
        scroll={{ x: 700 }}
        rowSelection={
          kind === 'Series'
            ? {
                selectedRowKeys: selected,
                onChange: (keys) => {
                  setSelected(keys);
                  invalidate();
                },
              }
            : false
        }
        columns={[
          { title: '患者', dataIndex: 'patient_name' },
          { title: '原开始', dataIndex: 'starts_at', valueType: 'dateTime' },
          {
            title: '关联疗程',
            render: (_, row) => (
              <Select
                value={episodes[row.name]}
                placeholder="选择关联疗程"
                options={row.episodes.map((e) => ({
                  value: e.name,
                  label: e.title || e.name,
                }))}
                onChange={(value) => {
                  setEpisodes((current) => ({ ...current, [row.name]: value }));
                  invalidate();
                }}
              />
            ),
          },
        ]}
      />
      {action === 'Reschedule' &&
        (kind === 'Series' ? (
          <ProFormDigit
            name="shift_days"
            label="整体平移天数（正数延后，负数提前）"
            min={-366}
            max={366}
            rules={[{ required: true }]}
          />
        ) : (
          <Space wrap>
            <ProFormDateTimePicker
              name="starts_at"
              label={`新开始时间（${context?.timezone || '站点时间'}）`}
              fieldProps={{
                format: 'YYYY-MM-DD HH:mm',
                showTime: { format: 'HH:mm' },
              }}
              rules={[{ required: true }]}
            />
            <ProFormDateTimePicker
              name="ends_at"
              label="新结束时间"
              fieldProps={{
                format: 'YYYY-MM-DD HH:mm',
                showTime: { format: 'HH:mm' },
              }}
              rules={[{ required: true }]}
            />
          </Space>
        ))}
      {action === 'Cancel' && (
        <ProFormSelect
          name="next_step"
          label="取消后的去向"
          rules={[{ required: true }]}
          options={[
            { value: 'Replan', label: '待重新排程' },
            { value: 'MedicalReview', label: '交医师复核' },
            { value: 'NoFurther', label: '本次无需继续安排' },
          ]}
        />
      )}
      <ProFormTextArea
        name="reason"
        label="实际变更原因"
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 2000 }}
      />
      {preview && (
        <>
          <ProTable
            rowKey="name"
            search={false}
            options={false}
            pagination={false}
            dataSource={preview.rows}
            columns={[
              { title: '患者', dataIndex: 'patient_name' },
              { title: '新开始', dataIndex: 'starts_at' },
              {
                title: '通知对象',
                render: (_, row) =>
                  row.targets.map((t) => `${t.name}（${t.role}）`).join('、') ||
                  '无符合范围的站内接收人',
              },
              {
                title: '影响处理',
                render: (_, row) =>
                  row.impacts
                    .map((i) => `${i.object}：${i.handling}`)
                    .join('；'),
              },
            ]}
          />
          <Alert
            type="info"
            showIcon
            title="仅生成站内处理记录；尚未配置的外部短信等不会自动发送。变更不会生成实际治疗或收费。"
          />
          <ProFormCheckbox name="acknowledged">
            已核对逐位患者的预约、签到和处理影响
          </ProFormCheckbox>
          <ProFormCheckbox name="targets_confirmed">
            已核对逐位患者的站内通知对象
          </ProFormCheckbox>
        </>
      )}
    </DrawerForm>
  );
}
