import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Modal, Space, Spin, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { medicalOptions } from '../DepartmentList/medicalService';
import MemberEditor from './MemberEditor';
import {
  api,
  errorMessage,
  type Member,
  type Options,
  roles,
  saveTeam,
  type Team,
} from './service';

export default function TeamEditor({
  name,
  readOnly,
  options,
  onClose,
  onSaved,
}: {
  name?: string;
  readOnly?: boolean;
  options: Options;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const company = Form.useWatch('company', form);
  const department = Form.useWatch('department', form);
  const [team, setTeam] = useState<Team>();
  const [members, setMembers] = useState<Member[]>([]);
  const [formal, setFormal] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(name));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [member, setMember] = useState<{ index?: number }>();
  const [projects, setProjects] = useState<{
    person: string;
    loading?: boolean;
    error?: string;
    rows?: { value: string; label: string; allowed: number }[];
    mode?: string;
    hidden?: boolean;
  }>();
  const dirty = useRef(false);
  const working = useRef(false);
  const { modal, message } = App.useApp();
  const canSave = !readOnly && (name ? team?.can_edit : options.can_create);
  const locked = Boolean(readOnly || (name && !team?.can_edit));
  useEffect(() => {
    let active = true;
    if (name)
      api<Team>('get_team', { name })
        .then((value) => {
          if (!active) return;
          setTeam(value);
          setMembers(value.members);
          setFormal(value.formal_users || []);
          form.setFieldsValue({ ...value, enabled: Boolean(value.enabled) });
        })
        .catch((reason) => active && setError(errorMessage(reason)))
        .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [name, form]);
  function close() {
    if (working.current) return;
    if (dirty.current && canSave)
      modal.confirm({
        title: '放弃尚未保存的治疗组资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  const active = (row: Member) =>
    row.valid_from <= dayjs().format('YYYY-MM-DD') &&
    (!row.valid_to || row.valid_to >= dayjs().format('YYYY-MM-DD'));
  return (
    <DrawerForm
      name="therapy-team-editor"
      title={name ? (readOnly ? '治疗组详情' : '编辑治疗组') : '新增治疗组'}
      open
      form={form}
      initialValues={{ enabled: true }}
      loading={loading}
      width="min(960px, 100vw)"
      drawerProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onValuesChange={(changed) => {
        dirty.current = true;
        setError(undefined);
        if (!name && Object.hasOwn(changed, 'company'))
          form.setFieldValue('department', undefined);
        if (!name && (changed.company || changed.department)) {
          setMembers([]);
          setFormal([]);
          form.setFieldValue('team_lead', undefined);
        }
      }}
      submitter={
        canSave
          ? {
              searchConfig: { submitText: '保存治疗组', resetText: '取消' },
              render: (_, buttons) => [
                <Button key="cancel" disabled={saving} onClick={close}>
                  取消
                </Button>,
                buttons[1],
              ],
            }
          : { render: () => <Button onClick={close}>关闭</Button> }
      }
      onFinish={async (values) => {
        if (!canSave || working.current) return false;
        if (!members.length) {
          setError('请在成员管理中至少添加一名成员。');
          return false;
        }
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          await saveTeam({
            name,
            modified: team?.modified,
            ...values,
            enabled: values.enabled ? 1 : 0,
            members: members.map(
              ({
                name: memberName,
                therapist,
                member_role,
                mentor,
                valid_from,
                valid_to,
              }) => ({
                name: memberName,
                therapist,
                member_role,
                mentor,
                valid_from,
                valid_to,
              }),
            ),
          });
          dirty.current = false;
          message.success('治疗组已保存');
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
      {team?.hidden_links && (
        <Alert
          type="warning"
          showIcon
          title="部分关联人员无权查看，当前资料仅供查看。"
        />
      )}
      <Tabs
        items={[
          {
            key: 'basic',
            label: '基本信息',
            forceRender: true,
            children: (
              <>
                <ProFormText
                  name="team_name"
                  disabled={locked}
                  label="治疗组名称"
                  rules={[{ required: true }, { max: 140 }]}
                />
                <ProFormSelect
                  name="company"
                  label="机构"
                  options={options.companies}
                  disabled={Boolean(name) || locked}
                  fieldProps={{ showSearch: true }}
                  rules={[{ required: true }]}
                />
                <ProFormSelect
                  name="department"
                  label="医疗科室"
                  params={{ company, current: team?.department }}
                  request={({ keyWords, current }) =>
                    company
                      ? medicalOptions(company, keyWords || '', current || '')
                      : Promise.resolve([])
                  }
                  disabled={Boolean(name) || locked}
                  fieldProps={{ showSearch: true }}
                  rules={[{ required: true }]}
                />
                <ProFormSelect
                  name="team_lead"
                  disabled={locked}
                  label="组长"
                  tooltip="先在成员管理中添加当前在组的正式治疗师，再选择组长。"
                  options={members
                    .filter((r) => active(r) && formal.includes(r.therapist))
                    .map((r) => ({
                      value: r.therapist,
                      label: r.person || r.therapist,
                    }))}
                />
                <ProFormSwitch
                  name="enabled"
                  label="启用状态"
                  disabled={locked}
                />
                <ProFormTextArea
                  name="notes"
                  disabled={locked}
                  label="备注"
                  fieldProps={{ maxLength: 1000, showCount: true }}
                />
              </>
            ),
          },
          {
            key: 'members',
            label: `成员管理（${members.length}）`,
            forceRender: true,
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  title="成员日期包含起止当天；退组请填写结束日期。项目授权沿用人员项目对照。"
                />
                <ProTable<Member>
                  rowKey={(r) => r.name || `${r.therapist}:${r.valid_from}`}
                  dataSource={members}
                  search={false}
                  options={false}
                  pagination={false}
                  scroll={{ x: 850 }}
                  toolBarRender={() =>
                    canSave
                      ? [
                          <Button
                            key="add"
                            disabled={!company || !department}
                            onClick={() => setMember({})}
                          >
                            添加成员
                          </Button>,
                        ]
                      : []
                  }
                  columns={[
                    {
                      title: '人员',
                      dataIndex: 'person',
                      width: 140,
                      render: (_, row) =>
                        row.person || row.therapist || '无权查看',
                    },
                    {
                      title: '组内角色',
                      dataIndex: 'member_role',
                      valueEnum: roles,
                    },
                    { title: '开始日期', dataIndex: 'valid_from', width: 110 },
                    { title: '结束日期', dataIndex: 'valid_to', width: 110 },
                    {
                      title: '带教老师',
                      dataIndex: 'mentor_label',
                      render: (_, row) => row.mentor_label || row.mentor || '—',
                    },
                    {
                      title: '状态',
                      key: 'state',
                      render: (_, row) => (
                        <Tag>
                          {active(row)
                            ? '当前在组'
                            : row.valid_from > dayjs().format('YYYY-MM-DD')
                              ? '待入组'
                              : '已结束'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      valueType: 'option',
                      width: 200,
                      render: (_, row, index) => [
                        canSave && !row.ended && (
                          <Button
                            key="edit"
                            type="link"
                            onClick={() => setMember({ index })}
                          >
                            调整
                          </Button>
                        ),
                        canSave && !row.name && (
                          <Button
                            key="remove"
                            type="link"
                            onClick={() => {
                              setMembers((v) =>
                                v.filter((_, i) => i !== index),
                              );
                              dirty.current = true;
                            }}
                          >
                            移除
                          </Button>
                        ),
                        name && row.therapist && (
                          <Button
                            key="projects"
                            type="link"
                            onClick={async () => {
                              setProjects({
                                person: row.person || row.therapist,
                                loading: true,
                              });
                              try {
                                const value = await api<{
                                  projects: {
                                    value: string;
                                    label: string;
                                    allowed: number;
                                  }[];
                                  scope_mode: string;
                                  hidden_links: boolean;
                                }>('member_projects', {
                                  name,
                                  therapist: row.therapist,
                                });
                                setProjects({
                                  person: row.person || row.therapist,
                                  rows: value.projects,
                                  mode: value.scope_mode,
                                  hidden: value.hidden_links,
                                });
                              } catch (reason) {
                                setProjects({
                                  person: row.person || row.therapist,
                                  error: errorMessage(reason),
                                });
                              }
                            }}
                          >
                            项目范围
                          </Button>
                        ),
                      ],
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'history',
            label: '操作记录',
            children: name ? (
              <ProTable<{
                name: string;
                creation: string;
                actor: string;
                content: string;
              }>
                rowKey="name"
                search={false}
                options={false}
                pagination={false}
                request={async () => ({
                  data: await api('get_history', { name }),
                  success: true,
                })}
                columns={[
                  {
                    title: '时间',
                    dataIndex: 'creation',
                    valueType: 'dateTime',
                  },
                  { title: '操作账号', dataIndex: 'actor' },
                  { title: '记录', dataIndex: 'content' },
                ]}
              />
            ) : (
              <Alert type="info" title="首次保存后生成操作记录。" />
            ),
          },
        ]}
      />
      {canSave && (
        <ProFormTextArea
          name="reason"
          label="本次变更说明"
          rules={[{ required: true }, { max: 1000 }]}
        />
      )}
      {member && (
        <MemberEditor
          member={
            member.index === undefined ? undefined : members[member.index]
          }
          company={company}
          department={department}
          members={members}
          onClose={() => setMember(undefined)}
          onSave={(value, isFormal) => {
            setMembers((v) =>
              member.index === undefined
                ? [...v, value]
                : v.map((r, i) => (i === member.index ? value : r)),
            );
            if (isFormal)
              setFormal((v) => [...new Set([...v, value.therapist])]);
            dirty.current = true;
            setMember(undefined);
          }}
        />
      )}
      <Modal
        title={`${projects?.person || ''} · 项目范围`}
        open={Boolean(projects)}
        footer={<Button onClick={() => setProjects(undefined)}>关闭</Button>}
        onCancel={() => setProjects(undefined)}
      >
        {projects?.loading ? (
          <Spin />
        ) : projects?.error ? (
          <Alert type="warning" title={projects.error} />
        ) : (
          <Space orientation="vertical">
            <span>
              {projects?.mode === 'Exceptions'
                ? '历史开放范围：下列为已登记例外配置，实际执行仍需资格校验。'
                : '仅允许已对照项目，实际执行仍需资格校验。'}
            </span>
            {projects?.hidden && (
              <Alert type="warning" title="部分项目无权查看。" />
            )}
            {projects?.rows?.map((r) => (
              <span key={r.value}>
                {r.label} · {r.allowed ? '允许' : '已解除'}
              </span>
            ))}
            {!projects?.rows?.length && <span>暂无已登记项目。</span>}
          </Space>
        )}
      </Modal>
    </DrawerForm>
  );
}
