import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
} from '@ant-design/pro-components';
import { Alert, Form, type FormInstance } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api, type Choice, type Member, roles } from './service';

export default function MemberEditor({
  member,
  company,
  department,
  members,
  onClose,
  onSave,
}: {
  member?: Member;
  company: string;
  department: string;
  members: Member[];
  onClose: () => void;
  onSave: (value: Member, formal: boolean) => void;
}) {
  const [form] = Form.useForm();
  const [people, setPeople] = useState<Choice[]>([]);
  const [person, setPerson] = useState<Choice>();
  const mentors = members
    .filter(
      (r) =>
        r.member_role === 'Mentor' &&
        !r.ended &&
        r.therapist !== member?.therapist,
    )
    .map((r) => ({ value: r.therapist, label: r.person || r.therapist }));
  return (
    <ModalForm
      name="therapy-team-member"
      title={member ? '调整成员' : '添加成员'}
      open
      form={form}
      initialValues={
        member || {
          member_role: 'Member',
          valid_from: dayjs().format('YYYY-MM-DD'),
        }
      }
      modalProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onFinish={async (values) => {
        onSave(
          {
            ...member,
            ...values,
            person: person?.label || member?.person,
            mentor_label: mentors.find((r) => r.value === values.mentor)?.label,
          },
          Boolean(person?.formal),
        );
        return true;
      }}
    >
      <Alert
        type="info"
        showIcon
        title="结束日期包含当天；已保存的成员记录保留历史。带教关系只适用于实习成员。"
      />
      <ProFormSelect
        name="therapist"
        label="人员"
        disabled={Boolean(member?.name)}
        rules={[{ required: true }]}
        initialValue={member?.therapist}
        params={{ company, department }}
        request={async ({ keyWords }) => {
          const values = await api<Choice[]>('people', {
            company,
            department,
            keyword: keyWords || '',
          });
          setPeople(values);
          return values;
        }}
        fieldProps={{
          showSearch: true,
          filterOption: false,
          options: member
            ? [
                {
                  value: member.therapist,
                  label: member.person || member.therapist,
                },
                ...people,
              ]
            : people,
          onChange: (value) => setPerson(people.find((r) => r.value === value)),
        }}
      />
      <ProFormSelect
        name="member_role"
        label="组内角色"
        valueEnum={roles}
        rules={[{ required: true }]}
      />
      <ProFormDatePicker
        name="valid_from"
        label="开始日期"
        disabled={Boolean(member?.name)}
        rules={[{ required: true }]}
      />
      <ProFormDatePicker
        name="valid_to"
        label="结束日期（含当天）"
        dependencies={['valid_from']}
        rules={[
          ({ getFieldValue }: FormInstance) => ({
            validator: async (_: unknown, value: string) => {
              if (
                value &&
                dayjs(value).isBefore(dayjs(getFieldValue('valid_from')), 'day')
              )
                throw new Error('结束日期不能早于开始日期');
            },
          }),
        ]}
      />
      <ProFormSelect
        name="mentor"
        label="组内带教老师"
        options={mentors}
        fieldProps={{ allowClear: true }}
      />
    </ModalForm>
  );
}
