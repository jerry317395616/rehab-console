import {
  DrawerForm,
  ProDescriptions,
  ProFormSelect,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Tabs } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  choices,
  errorMessage,
  modes,
  mutate,
  type Profile,
} from './service';

export default function ProfileEditor({
  company,
  therapist,
  readOnly,
  onClose,
  onSaved,
}: {
  company: string;
  therapist: string;
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const mode = Form.useWatch('scope_mode', form);
  const [profile, setProfile] = useState<Profile>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const dirty = useRef(false);
  const working = useRef(false);
  const { message, modal } = App.useApp();
  const canSave = Boolean(
    profile?.can_edit && !profile.hidden_links && !readOnly,
  );
  useEffect(() => {
    let active = true;
    api<Profile>('get_profile', { company, therapist })
      .then((value) => {
        if (!active) return;
        setProfile(value);
        form.setFieldsValue({
          scope_mode: value.scope_mode,
          mentor: value.mentor,
          projects: value.projects.filter((r) => r.allowed).map((r) => r.value),
          reason: '',
        });
      })
      .catch((reason) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [company, therapist, form]);
  function close() {
    if (working.current) return;
    if (canSave && dirty.current)
      modal.confirm({
        title: '放弃尚未保存的对照配置？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  return (
    <DrawerForm
      name="staff-project-profile"
      title={readOnly ? '人员项目对照详情' : '配置人员项目'}
      open
      form={form}
      width="min(900px, 100vw)"
      loading={loading}
      drawerProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onValuesChange={() => {
        dirty.current = true;
        setError(undefined);
      }}
      submitter={
        canSave
          ? {
              searchConfig: { submitText: '保存对照', resetText: '取消' },
              render: (_, buttons) => [
                <Button key="cancel" onClick={close} disabled={saving}>
                  取消
                </Button>,
                buttons[1],
              ],
            }
          : { render: () => <Button onClick={close}>关闭</Button> }
      }
      onFinish={async (values) => {
        if (!canSave || !profile || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          await mutate('save_profile', {
            company,
            therapist,
            modified: profile.modified,
            ...values,
          });
          dirty.current = false;
          message.success('人员项目对照已保存');
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(errorMessage(reason));
          return false;
        } finally {
          working.current = false;
          setSaving(false);
        }
      }}
    >
      {error && <Alert type="error" showIcon title={error} />}
      {profile && (
        <>
          <ProDescriptions
            column={1}
            dataSource={profile}
            columns={[
              { title: '机构', dataIndex: 'company' },
              { title: '人员', dataIndex: 'person' },
              { title: '账号', dataIndex: 'therapist' },
              {
                title: '科室',
                key: 'department',
                render: () => profile.departments?.join('、') || '—',
              },
            ]}
          />
          {profile.hidden_links && (
            <Alert
              type="warning"
              showIcon
              title="部分项目超出当前账号读取范围，完整配置暂不可修改。"
            />
          )}
          <Tabs
            items={[
              {
                key: 'scope',
                label: '项目范围',
                forceRender: true,
                children: (
                  <>
                    {profile.scope_mode === 'Exceptions' && (
                      <Alert
                        type="warning"
                        showIcon
                        title="这是历史开放范围。未列出的项目仍按原有规则判断；切换为“仅允许所选项目”后，范围将收窄到所选项目。"
                      />
                    )}
                    {!profile.name && (
                      <Alert
                        type="info"
                        showIcon
                        title="新配置仅允许所选项目。保存前请完整核对人员范围；此操作不会生成排班或任务。"
                      />
                    )}
                    <ProFormSelect
                      name="scope_mode"
                      label="范围方式"
                      disabled={!canSave}
                      options={Object.entries(modes)
                        .filter(
                          ([key]) =>
                            key === 'Restricted' ||
                            profile.scope_mode === 'Exceptions',
                        )
                        .map(([value, label]) => ({ value, label }))}
                      rules={[{ required: true }]}
                    />
                    <ProFormSelect
                      name="projects"
                      label="可开展治疗项目"
                      mode="multiple"
                      disabled={!canSave}
                      request={async ({ keyWords }) => {
                        const result = await choices(
                          company,
                          'project',
                          keyWords || '',
                        );
                        return [
                          ...profile.projects.filter(
                            (r) =>
                              r.allowed &&
                              !result.some((c) => c.value === r.value),
                          ),
                          ...result,
                        ];
                      }}
                      fieldProps={{ showSearch: true, filterOption: false }}
                      tooltip={
                        mode === 'Exceptions'
                          ? '历史开放范围中，未列出的项目仍按原规则判断；所选列表维护明确允许的项目，解除记录可按项目查询。'
                          : '未选择任何项目表示该人员在此机构的项目范围为空。实际安排仍需满足资质、班次和资源条件。'
                      }
                    />
                    {(profile.is_intern || profile.mentor) && (
                      <ProFormSelect
                        name="mentor"
                        label="带教老师"
                        disabled={!canSave}
                        request={async ({ keyWords }) => {
                          const result = await choices(
                            company,
                            'mentor',
                            keyWords || '',
                          );
                          return profile.mentor &&
                            !result.some((r) => r.value === profile.mentor)
                            ? [
                                {
                                  value: profile.mentor,
                                  label: profile.mentor,
                                },
                                ...result,
                              ]
                            : result;
                        }}
                        fieldProps={{ showSearch: true, filterOption: false }}
                        rules={profile.is_intern ? [{ required: true }] : []}
                      />
                    )}
                    {canSave && (
                      <ProFormTextArea
                        name="reason"
                        label="变更原因"
                        rules={[{ required: true, whitespace: true }]}
                        fieldProps={{ maxLength: 1000 }}
                      />
                    )}
                  </>
                ),
              },
              ...(profile.name
                ? [
                    {
                      key: 'history',
                      label: '操作记录',
                      children: (
                        <ProTable<{
                          name: string;
                          creation: string;
                          actor: string;
                          detail: string;
                        }>
                          rowKey="name"
                          search={false}
                          options={false}
                          pagination={{ pageSize: 10 }}
                          columns={[
                            {
                              title: '时间',
                              dataIndex: 'creation',
                              valueType: 'dateTime',
                            },
                            { title: '操作人', dataIndex: 'actor' },
                            { title: '内容', dataIndex: 'detail' },
                          ]}
                          request={async () => ({
                            data: await api('get_history', {
                              company,
                              therapist,
                            }),
                            success: true,
                          })}
                          onRequestError={(reason) =>
                            setError(errorMessage(reason))
                          }
                          scroll={{ x: 650 }}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </>
      )}
    </DrawerForm>
  );
}
