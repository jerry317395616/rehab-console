import {
  ModalForm,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App } from 'antd';
import { useRef, useState } from 'react';
import {
  type Choice,
  choices,
  errorMessage,
  mutate,
  type Row,
} from './service';

export function PersonPicker({
  company,
  onClose,
  onPick,
}: {
  company: string;
  onClose: () => void;
  onPick: (person: string) => void;
}) {
  return (
    <ModalForm<{ person: string }>
      name="staff-project-person-picker"
      title="选择人员"
      open
      width={520}
      modalProps={{ destroyOnHidden: true }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onFinish={async ({ person }) => {
        onPick(person);
        onClose();
        return true;
      }}
    >
      <ProFormSelect
        name="person"
        label="人员"
        rules={[{ required: true }]}
        request={({ keyWords }) => choices(company, 'person', keyWords || '')}
        fieldProps={{ showSearch: true, filterOption: false }}
      />
    </ModalForm>
  );
}

export function BatchAdd({
  company,
  project,
  onClose,
  onSaved,
}: {
  company: string;
  project: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const candidates = useRef(new Map<string, Choice>());
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  return (
    <ModalForm<{ people: string[]; reason: string }>
      name="staff-project-batch"
      title="批量建立人员项目对照"
      open
      width={600}
      modalProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      submitter={{ resetButtonProps: { disabled: saving } }}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      onFinish={async ({ people, reason }) => {
        if (saving) return false;
        setSaving(true);
        setError(undefined);
        try {
          if (people.some((p) => !candidates.current.has(p)))
            throw new Error('请重新选择人员后保存。');
          await mutate('add_people', {
            company,
            therapy_type: project,
            reason,
            people: people.map((therapist) => ({
              therapist,
              modified: candidates.current.get(therapist)?.modified,
            })),
          });
          message.success('人员项目对照已建立');
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(errorMessage(reason));
          return false;
        } finally {
          setSaving(false);
        }
      }}
    >
      <Alert
        type="info"
        showIcon
        title="新人员范围仅包含本次所选项目；已有范围和带教设置会保留。有任务受到影响时整批不保存。"
      />
      {error && <Alert type="error" showIcon title={error} />}
      <ProFormSelect
        name="people"
        label="人员"
        mode="multiple"
        rules={[{ required: true }]}
        request={async ({ keyWords }) => {
          const result = await choices(company, 'person', keyWords || '');
          for (const row of result) candidates.current.set(row.value, row);
          return result;
        }}
        disabled={saving}
        fieldProps={{ showSearch: true, filterOption: false, maxCount: 100 }}
      />
      <ProFormTextArea
        name="reason"
        label="变更原因"
        disabled={saving}
        rules={[{ required: true, whitespace: true }]}
        fieldProps={{ maxLength: 1000 }}
      />
    </ModalForm>
  );
}

export function PairChange({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: () => void;
}) {
  const removing = row.status === 'Allowed';
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  return (
    <ModalForm<{ reason: string }>
      name="staff-project-pair"
      title={removing ? '解除人员项目对照' : '恢复人员项目对照'}
      open
      width={560}
      modalProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      submitter={{ resetButtonProps: { disabled: saving } }}
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      onFinish={async ({ reason }) => {
        if (saving) return false;
        setSaving(true);
        setError(undefined);
        try {
          await mutate('change_pair', {
            company: row.company,
            therapist: row.therapist,
            modified: row.modified,
            therapy_type: row.therapy_type,
            action: removing ? 'remove' : 'allow',
            reason,
          });
          message.success(removing ? '对照关系已解除' : '对照关系已恢复');
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(errorMessage(reason));
          return false;
        } finally {
          setSaving(false);
        }
      }}
    >
      <Alert
        type={removing ? 'warning' : 'info'}
        showIcon
        title={
          removing
            ? `解除 ${row.person} 的当前项目对照。已有待执行任务受到影响时无法解除；历史记录保留。`
            : `恢复 ${row.person} 的当前项目对照。实际执行仍需满足资质和班次条件。`
        }
      />
      {error && <Alert type="error" showIcon title={error} />}
      <ProFormTextArea
        name="reason"
        label="变更原因"
        disabled={saving}
        rules={[{ required: true, whitespace: true }]}
        fieldProps={{ maxLength: 1000 }}
      />
    </ModalForm>
  );
}
