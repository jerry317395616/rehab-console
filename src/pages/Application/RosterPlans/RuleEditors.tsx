import {
  ModalForm,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTimePicker,
} from '@ant-design/pro-components';
import { Alert, App } from 'antd';
import { useRef } from 'react';
import {
  api,
  choices,
  errorMessage,
  kinds,
  type Person,
  type Slot,
  weekdays,
} from './service';

export function SlotEditor({
  slot,
  company,
  department,
  projectOptions,
  onClose,
  onSave,
}: {
  slot?: Slot;
  company: string;
  department: string;
  projectOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (rows: Slot[], labels: { value: string; label: string }[]) => void;
}) {
  const labels = useRef(projectOptions);
  return (
    <ModalForm
      name="roster-week-slot"
      title={slot ? '编辑每周班次' : '添加每周班次'}
      open
      initialValues={
        slot
          ? { ...slot, weekdays: [slot.weekday] }
          : {
              weekdays: [0, 1, 2, 3, 4],
              start: '08:00',
              end: '12:00',
              kind: 'Work',
              projects: [],
            }
      }
      modalProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onFinish={async (values) => {
        onSave(
          values.weekdays.map((weekday: number) => ({
            weekday: Number(weekday),
            start: String(values.start).slice(0, 5),
            end: String(values.end).slice(0, 5),
            kind: values.kind,
            projects: ['Work', 'Duty'].includes(values.kind)
              ? values.projects || []
              : [],
          })),
          labels.current,
        );
        return true;
      }}
    >
      <ProFormSelect
        name="weekdays"
        label="星期"
        options={Object.entries(weekdays).map(([value, label]) => ({
          value: Number(value),
          label,
        }))}
        fieldProps={{ mode: 'multiple' }}
        rules={[{ required: true }]}
      />
      <ProFormTimePicker
        name="start"
        label="开始时间"
        fieldProps={{ format: 'HH:mm' }}
        rules={[{ required: true }]}
      />
      <ProFormTimePicker
        name="end"
        label="结束时间"
        fieldProps={{ format: 'HH:mm' }}
        rules={[{ required: true }]}
      />
      <ProFormSelect
        name="kind"
        label="工作类型"
        valueEnum={kinds}
        rules={[{ required: true }]}
      />
      <ProFormDependency name={['kind']}>
        {({ kind }) =>
          ['Work', 'Duty'].includes(kind) ? (
            <ProFormSelect
              name="projects"
              label="可安排治疗项目"
              rules={[{ required: true }]}
              params={{ company, department }}
              options={projectOptions}
              request={async ({ keyWords }) => {
                const values = await choices(
                  company,
                  department,
                  'project',
                  keyWords || '',
                );
                labels.current = [
                  ...new Map(
                    [...labels.current, ...values].map((v) => [v.value, v]),
                  ).values(),
                ];
                return values;
              }}
              fieldProps={{
                mode: 'multiple',
                showSearch: true,
                filterOption: false,
              }}
            />
          ) : (
            <Alert
              type="info"
              title="请假、调休和出差只生成不可用时段，不产生可预约班次。"
            />
          )
        }
      </ProFormDependency>
    </ModalForm>
  );
}

export function PersonEditor({
  person,
  company,
  department,
  onClose,
  onSave,
}: {
  person?: Person;
  company: string;
  department: string;
  onClose: () => void;
  onSave: (person: Person) => void;
}) {
  const selectedLabel = useRef(person?.person);
  return (
    <ModalForm
      name="roster-plan-person"
      title={person ? '编辑适用人员' : '添加适用人员'}
      open
      initialValues={person}
      modalProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onFinish={async (values) => {
        onSave({
          therapist: values.therapist,
          evidence: values.evidence || '',
          person: selectedLabel.current || values.therapist,
        });
        return true;
      }}
    >
      <ProFormSelect
        name="therapist"
        label="治疗师"
        disabled={Boolean(person)}
        rules={[{ required: true }]}
        options={
          person
            ? [
                {
                  value: person.therapist,
                  label: person.person || person.therapist,
                },
              ]
            : []
        }
        params={{ company, department }}
        request={({ keyWords }) =>
          choices(company, department, 'person', keyWords || '')
        }
        fieldProps={{
          showSearch: true,
          filterOption: false,
          onChange: (_, option) => {
            if (option && !Array.isArray(option))
              selectedLabel.current = String(option.label);
          },
        }}
      />
      <ProFormText
        name="evidence"
        label="资质核验依据"
        tooltip="上班、值班计划必须填写医院实际核验依据；排班不会授予项目权限或专业资格。"
        fieldProps={{ maxLength: 140 }}
      />
    </ModalForm>
  );
}

export function TeamImport({
  company,
  department,
  onClose,
  onSave,
}: {
  company: string;
  department: string;
  onClose: () => void;
  onSave: (people: Person[]) => void;
}) {
  const { message } = App.useApp();
  return (
    <ModalForm
      name="roster-plan-team-import"
      title="从治疗组加入当前成员"
      open
      modalProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onFinish={async (values) => {
        try {
          const rows = await api<Person[]>('team_people', {
            company,
            department,
            team: values.team,
          });
          onSave(rows);
          return true;
        } catch (reason) {
          message.error(errorMessage(reason));
          return false;
        }
      }}
    >
      <Alert
        type="info"
        showIcon
        title="加入的是当前成员清单，之后治疗组变更不会自动改写计划。请逐人补充真实的资质核验依据。"
      />
      <ProFormSelect
        name="team"
        label="治疗组"
        rules={[{ required: true }]}
        params={{ company, department }}
        request={({ keyWords }) =>
          choices(company, department, 'team', keyWords || '')
        }
        fieldProps={{ showSearch: true, filterOption: false }}
      />
    </ModalForm>
  );
}
