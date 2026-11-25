import {
  ModalForm,
  ProFormCheckbox,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Descriptions } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import { errorMessage } from './service';
import { type Planning, type Task, taskPost } from './taskService';

type ChangeOptions = {
  episodes: { name: string; title: string }[];
  planning?: Planning;
  timezone: string;
};
type Preview = {
  preview_token: string;
  impacts: { object: string; current: string; handling: string }[];
  targets: { user: string; name: string; role: string }[];
};
export default function TaskChange({
  task,
  action,
  initialSlot,
  onClose,
  onSaved,
}: {
  task: Task;
  action: 'Reschedule' | 'Cancel';
  initialSlot?: Pick<
    Task,
    'starts_at' | 'ends_at' | 'room' | 'therapy_team'
  > & {
    equipment_list: string[];
    collaborators: string[];
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<ChangeOptions>();
  const [preview, setPreview] = useState<Preview>();
  const [error, setError] = useState<string>();
  const requestId = useRef(crypto.randomUUID());
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    taskPost<ChangeOptions>('schedule_change_api', 'get_options', {
      name: task.name,
    })
      .then((value) => {
        if (active) setOptions(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [task.name]);
  return (
    <ModalForm
      open
      title={action === 'Cancel' ? '取消预约与影响确认' : '改约与影响确认'}
      loading={!options && !error}
      width={760}
      modalProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      initialValues={{
        starts_at: dayjs(initialSlot?.starts_at || task.starts_at),
        ends_at: dayjs(initialSlot?.ends_at || task.ends_at),
        room: initialSlot?.room || task.room,
        equipment_list:
          initialSlot?.equipment_list ||
          task.rehab_equipments?.map((r) => r.equipment) ||
          (task.equipment ? [task.equipment] : []),
        collaborators:
          initialSlot?.collaborators ||
          task.rehab_collaborators?.map((r) => r.therapist) ||
          [],
        therapy_team: initialSlot?.therapy_team || task.therapy_team,
        booking_mode: task.rehab_booking_mode || 'Advance',
      }}
      onValuesChange={(changes) => {
        if (
          Object.keys(changes).some(
            (key) => !['acknowledged', 'targets_confirmed'].includes(key),
          )
        )
          setPreview(undefined);
      }}
      submitter={{
        searchConfig: {
          submitText: preview ? '确认影响并保存' : '预览实际影响',
        },
      }}
      onFinish={async (values) => {
        const {
          reason,
          notice_text,
          acknowledged,
          targets_confirmed,
          ...proposal
        } = values;
        const data: Record<string, unknown> = {
          ...proposal,
          action,
          name: task.name,
          expected_modified: task.modified,
        };
        if (action === 'Reschedule') {
          data.starts_at = dayjs(values.starts_at).format(
            'YYYY-MM-DD HH:mm:00',
          );
          data.ends_at = dayjs(values.ends_at).format('YYYY-MM-DD HH:mm:00');
          data.equipment = [...(values.equipment_list || [])].sort()[0] || null;
        }
        try {
          if (!preview) {
            setPreview(
              await taskPost<Preview>('schedule_change_api', 'preview', data),
            );
            return false;
          }
          await taskPost('schedule_change_api', 'confirm', {
            ...data,
            preview_token: preview.preview_token,
            reason,
            notice_text,
            acknowledged,
            targets_confirmed,
            request_id: requestId.current,
          });
          message.success('预约变更已保存');
          onSaved();
          return true;
        } catch (failure) {
          setError(errorMessage(failure));
          return false;
        }
      }}
    >
      {error && <Alert type="error" showIcon title={error} />}
      {initialSlot && (
        <Descriptions
          size="small"
          column={1}
          items={[
            {
              key: 'prior',
              label: '原预约',
              children: `${task.starts_at.slice(0, 16)} – ${task.ends_at.slice(11, 16)} · ${task.room}`,
            },
            {
              key: 'next',
              label: '所选新时段',
              children: `${initialSlot.starts_at.slice(0, 16)} – ${initialSlot.ends_at.slice(11, 16)} · ${initialSlot.room}`,
            },
          ]}
        />
      )}
      <ProFormSelect
        name="episode"
        label="关联康复疗程"
        options={options?.episodes.map((r) => ({
          value: r.name,
          label: r.title || r.name,
        }))}
        rules={[{ required: true }]}
      />
      {action === 'Cancel' ? (
        <ProFormSelect
          name="next_step"
          label="取消后去向"
          options={[
            { value: 'Replan', label: '待重新安排' },
            { value: 'MedicalReview', label: '医师复核' },
            { value: 'NoFurther', label: '本次无需安排' },
          ]}
          rules={[{ required: true }]}
        />
      ) : (
        <>
          <ProFormDateTimePicker
            name="starts_at"
            label={`开始时间（${options?.timezone || '站点时间'}）`}
            fieldProps={{
              format: 'YYYY-MM-DD HH:mm',
              showTime: { format: 'HH:mm' },
            }}
            rules={[{ required: true }]}
          />
          <ProFormDateTimePicker
            name="ends_at"
            label="结束时间（站点时间）"
            fieldProps={{
              format: 'YYYY-MM-DD HH:mm',
              showTime: { format: 'HH:mm' },
            }}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="collaborators"
            label="协作治疗师"
            mode="multiple"
            options={options?.planning?.therapists.map((r) => ({
              value: r.name,
              label: r.full_name || r.name,
            }))}
          />
          <ProFormSelect
            name="room"
            label="治疗场地"
            options={options?.planning?.resources
              .filter((r) => r.resource_type === 'Room')
              .map((r) => ({ value: r.name, label: r.resource_name }))}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="equipment_list"
            label="全部治疗设备"
            mode="multiple"
            options={options?.planning?.resources
              .filter((r) => r.resource_type === 'Equipment')
              .map((r) => ({ value: r.name, label: r.resource_name }))}
          />
          <ProFormSelect
            name="therapy_team"
            label="治疗组"
            options={options?.planning?.teams.map((r) => ({
              value: r.name,
              label: r.team_name,
            }))}
          />
          <ProFormSelect
            name="booking_mode"
            label="安排方式"
            options={[
              { value: 'Advance', label: '提前预约' },
              { value: 'Onsite', label: '现场安排' },
            ]}
          />
        </>
      )}
      <ProFormTextArea
        name="reason"
        label="变更原因"
        rules={[{ required: true }]}
        fieldProps={{ maxLength: 2000 }}
      />
      <ProFormTextArea
        name="notice_text"
        label="通知说明"
        fieldProps={{ maxLength: 2000 }}
      />
      {preview && (
        <>
          <ProTable
            rowKey="object"
            dataSource={preview.impacts}
            search={false}
            options={false}
            pagination={false}
            columns={[
              { title: '影响对象', dataIndex: 'object' },
              { title: '处理方式', dataIndex: 'handling' },
            ]}
          />
          <Alert
            type="info"
            showIcon
            title="站内通知对象"
            description={
              preview.targets.map((r) => `${r.name}（${r.role}）`).join('、') ||
              '当前没有可通知对象'
            }
          />
          <ProFormCheckbox
            name="acknowledged"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) throw new Error('请确认影响范围');
                },
              },
            ]}
          >
            已核对影响范围
          </ProFormCheckbox>
          <ProFormCheckbox
            name="targets_confirmed"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) throw new Error('请确认通知对象');
                },
              },
            ]}
          >
            已核对通知对象
          </ProFormCheckbox>
        </>
      )}
    </ModalForm>
  );
}
