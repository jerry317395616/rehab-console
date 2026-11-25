import {
  DrawerForm,
  ProFormDateRangePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Space, Tabs } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { medicalOptions } from '../DepartmentList/medicalService';
import DetailDrawer from '../RosterSlots/DetailDrawer';
import { PersonEditor, SlotEditor, TeamImport } from './RuleEditors';
import {
  api,
  errorMessage,
  kinds,
  mutate,
  type Options,
  type Person,
  type Plan,
  type Slot,
  weekdays,
} from './service';

export default function PlanEditor({
  name,
  copy,
  readOnly,
  options,
  onClose,
  onSaved,
}: {
  name?: string;
  copy?: boolean;
  readOnly?: boolean;
  options: Options;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const company = Form.useWatch('company', form),
    department = Form.useWatch('department', form);
  const [plan, setPlan] = useState<Plan>();
  const [projectOptions, setProjectOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [people, setPeople] = useState<Person[]>([]),
    [slots, setSlots] = useState<Slot[]>([]);
  const [personEditor, setPersonEditor] = useState<{ index?: number }>(),
    [slotEditor, setSlotEditor] = useState<{ index?: number }>();
  const [teamImport, setTeamImport] = useState(false);
  const [slotDetail, setSlotDetail] = useState<string>();
  const [loading, setLoading] = useState(Boolean(name)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string>();
  const dirty = useRef(false),
    busy = useRef(false);
  const { message, modal } = App.useApp();
  const existing = Boolean(name && !copy);
  const editable =
    !readOnly &&
    !plan?.hidden_links &&
    (existing ? plan?.can_write : options.can_create);
  useEffect(() => {
    let active = true;
    if (name)
      api<Plan>('get_plan', { name })
        .then((value) => {
          if (!active) return;
          setPlan(value);
          setPeople(value.people);
          setSlots(value.slots);
          setProjectOptions(value.project_choices);
          form.setFieldsValue({
            plan_title: `${value.plan_title}${copy ? '（副本）' : ''}`,
            company: value.company,
            department: value.department,
            dates: copy
              ? [
                  dayjs(options.site_today).format('YYYY-MM-DD'),
                  dayjs(options.site_today).add(30, 'day').format('YYYY-MM-DD'),
                ]
              : [value.starts_on, value.ends_on],
          });
        })
        .catch((reason) => active && setError(errorMessage(reason)))
        .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [name, copy, form, options.site_today]);
  function close() {
    if (busy.current) return;
    if (dirty.current && editable)
      modal.confirm({
        title: '放弃尚未保存的排班计划？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  const mark = () => {
    dirty.current = true;
    setError(undefined);
  };
  return (
    <DrawerForm
      name="roster-plan-editor"
      title={
        readOnly
          ? '排班计划详情'
          : copy
            ? '复制排班计划'
            : existing
              ? '编辑排班计划'
              : '新增排班计划'
      }
      open
      form={form}
      initialValues={{
        dates: [
          dayjs(options.site_today).format('YYYY-MM-DD'),
          dayjs(options.site_today).add(30, 'day').format('YYYY-MM-DD'),
        ],
      }}
      loading={loading || saving}
      width="min(1050px, 100vw)"
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
        mark();
        if (!existing && Object.hasOwn(changed, 'company'))
          form.setFieldValue('department', undefined);
        if (
          !existing &&
          (changed.company || changed.department) &&
          (people.length || slots.length)
        ) {
          setPeople([]);
          setSlots([]);
          message.info('机构或科室已变化，请重新选择适用人员和每周班次。');
        }
      }}
      submitter={
        editable
          ? {
              searchConfig: { submitText: '保存计划', resetText: '取消' },
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
        if (!editable || busy.current) return false;
        if (!people.length || !slots.length) {
          setError('请在适用人员和每周班次中完成配置。');
          return false;
        }
        busy.current = true;
        setSaving(true);
        setError(undefined);
        try {
          await mutate('save_plan', {
            name: existing ? name : undefined,
            modified: existing ? plan?.modified : undefined,
            plan_title: values.plan_title,
            company: values.company,
            department: values.department,
            starts_on: values.dates[0],
            ends_on: values.dates[1],
            reason: values.reason,
            people: people.map(({ therapist, evidence }) => ({
              therapist,
              evidence,
            })),
            slots,
          });
          dirty.current = false;
          message.success('排班计划已保存；尚未生成实际班次');
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(errorMessage(reason));
          return false;
        } finally {
          busy.current = false;
          setSaving(false);
        }
      }}
    >
      {error && <Alert type="error" showIcon title={error} />}
      {plan?.hidden_links && (
        <Alert
          type="warning"
          title="部分关联人员或项目无权查看，当前计划仅供查看。"
        />
      )}
      {existing && (
        <Alert
          type="info"
          showIcon
          title={`当前版本 ${plan?.revision || '—'} · ${plan?.enabled ? '启用' : '停用'}`}
          description="保存产生新版本，已生成班次保留原版本；计划停用只阻止后续生成。"
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
                  name="plan_title"
                  label="计划名称"
                  disabled={!editable}
                  rules={[{ required: true }, { max: 140 }]}
                />
                <ProFormSelect
                  name="company"
                  label="机构"
                  options={options.companies}
                  disabled={existing || !editable}
                  fieldProps={{ showSearch: true }}
                  rules={[{ required: true }]}
                />
                <ProFormSelect
                  name="department"
                  label="医疗科室"
                  params={{ company, current: plan?.department }}
                  request={({ keyWords, current }) =>
                    company
                      ? medicalOptions(company, keyWords || '', current || '')
                      : Promise.resolve([])
                  }
                  disabled={existing || !editable}
                  fieldProps={{ showSearch: true }}
                  rules={[{ required: true }]}
                />
                <ProFormDateRangePicker
                  name="dates"
                  label="有效日期范围"
                  disabled={!editable}
                  rules={[{ required: true }]}
                />
              </>
            ),
          },
          {
            key: 'people',
            label: `适用人员（${people.length}）`,
            forceRender: true,
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  title="上班、值班需要逐人填写实际资质核验依据；生成时另行核验项目范围和已有资质。人员清单不会随治疗组自动变化。"
                />
                <ProTable<Person>
                  rowKey="therapist"
                  dataSource={people}
                  search={false}
                  options={false}
                  pagination={{ defaultPageSize: 10 }}
                  scroll={{ x: 700 }}
                  toolBarRender={() =>
                    editable
                      ? [
                          <Button
                            key="person"
                            disabled={!company || !department}
                            onClick={() => setPersonEditor({})}
                          >
                            添加人员
                          </Button>,
                          <Button
                            key="team"
                            disabled={!company || !department}
                            onClick={() => setTeamImport(true)}
                          >
                            从治疗组加入
                          </Button>,
                        ]
                      : []
                  }
                  columns={[
                    {
                      title: '人员',
                      dataIndex: 'person',
                      render: (_, r) => r.person || r.therapist || '无权查看',
                    },
                    { title: '账号', dataIndex: 'therapist' },
                    { title: '资质核验依据', dataIndex: 'evidence' },
                    {
                      title: '操作',
                      valueType: 'option',
                      width: 130,
                      render: (_, person) =>
                        editable
                          ? [
                              <Button
                                key="edit"
                                type="link"
                                onClick={() =>
                                  setPersonEditor({
                                    index: people.findIndex(
                                      (r) => r.therapist === person.therapist,
                                    ),
                                  })
                                }
                              >
                                编辑
                              </Button>,
                              <Button
                                key="remove"
                                type="link"
                                onClick={() => {
                                  setPeople((v) =>
                                    v.filter(
                                      (r) => r.therapist !== person.therapist,
                                    ),
                                  );
                                  mark();
                                }}
                              >
                                移除
                              </Button>,
                            ]
                          : [],
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'slots',
            label: `每周班次（${slots.length}）`,
            forceRender: true,
            children: (
              <>
                <Alert
                  type="info"
                  title="同一天的班次不能重叠；支持同日分段，单个时段最多 12 小时。"
                />
                <ProTable<Slot>
                  rowKey={(r) => `${r.weekday}:${r.start}:${r.end}`}
                  dataSource={slots}
                  search={false}
                  options={false}
                  pagination={false}
                  scroll={{ x: 800 }}
                  toolBarRender={() =>
                    editable
                      ? [
                          <Button
                            key="add"
                            disabled={!company || !department}
                            onClick={() => setSlotEditor({})}
                          >
                            添加每周班次
                          </Button>,
                        ]
                      : []
                  }
                  columns={[
                    {
                      title: '星期',
                      dataIndex: 'weekday',
                      valueEnum: weekdays,
                    },
                    { title: '开始时间', dataIndex: 'start' },
                    { title: '结束时间', dataIndex: 'end' },
                    { title: '工作类型', dataIndex: 'kind', valueEnum: kinds },
                    {
                      title: '可安排项目',
                      key: 'projects',
                      render: (_, r) => (
                        <Space wrap>
                          {r.projects.map((p) => (
                            <span key={p}>
                              {projectOptions.find((v) => v.value === p)
                                ?.label || p}
                            </span>
                          ))}
                        </Space>
                      ),
                    },
                    {
                      title: '操作',
                      valueType: 'option',
                      width: 130,
                      render: (_, __, index) =>
                        editable
                          ? [
                              <Button
                                key="edit"
                                type="link"
                                onClick={() => setSlotEditor({ index })}
                              >
                                编辑
                              </Button>,
                              <Button
                                key="remove"
                                type="link"
                                onClick={() => {
                                  setSlots((v) =>
                                    v.filter((_, i) => i !== index),
                                  );
                                  mark();
                                }}
                              >
                                移除
                              </Button>,
                            ]
                          : [],
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: 'generated',
            label: '生成记录',
            children:
              existing && plan?.can_view_generated ? (
                <ProTable<{
                  name: string;
                  person: string;
                  work_date: string;
                  starts_at: string;
                  ends_at: string;
                  work_kind: string;
                  projects: string[];
                  plan_revision: number;
                  enabled: number;
                }>
                  rowKey="name"
                  search={false}
                  options={false}
                  scroll={{ x: 900 }}
                  request={(params) =>
                    api('get_generated', {
                      name,
                      current: params.current,
                      page_size: params.pageSize,
                    })
                  }
                  columns={[
                    { title: '人员', dataIndex: 'person' },
                    { title: '日期', dataIndex: 'work_date' },
                    {
                      title: '开始',
                      dataIndex: 'starts_at',
                      valueType: 'dateTime',
                    },
                    {
                      title: '结束',
                      dataIndex: 'ends_at',
                      valueType: 'dateTime',
                    },
                    { title: '类型', dataIndex: 'work_kind', valueEnum: kinds },
                    {
                      title: '项目',
                      dataIndex: 'projects',
                      render: (_, r) => r.projects.join('、'),
                    },
                    { title: '原计划版本', dataIndex: 'plan_revision' },
                    {
                      title: '状态',
                      dataIndex: 'enabled',
                      valueEnum: { 0: '停用', 1: '启用' },
                    },
                    {
                      title: '操作',
                      valueType: 'option',
                      fixed: 'right',
                      width: 100,
                      render: (_, row) => (
                        <Button
                          type="link"
                          onClick={() => setSlotDetail(row.name)}
                        >
                          查看明细
                        </Button>
                      ),
                    },
                  ]}
                />
              ) : (
                <Alert
                  type="info"
                  title={
                    existing
                      ? '当前账号没有生成明细的读取权限。'
                      : '保存计划并明确生成后，可在这里查询实际班次。'
                  }
                />
              ),
          },
          {
            key: 'history',
            label: '操作记录',
            children: existing ? (
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
      {editable && (
        <ProFormTextArea
          name="reason"
          label="本次变更说明"
          rules={[{ required: true }, { max: 1000 }]}
        />
      )}
      {personEditor && (
        <PersonEditor
          person={
            personEditor.index === undefined
              ? undefined
              : people[personEditor.index]
          }
          company={company}
          department={department}
          onClose={() => setPersonEditor(undefined)}
          onSave={(person) => {
            if (
              people.some(
                (r, i) =>
                  r.therapist === person.therapist && i !== personEditor.index,
              )
            ) {
              message.warning('该人员已在计划中');
              return;
            }
            setPeople((v) =>
              personEditor.index === undefined
                ? [...v, person]
                : v.map((r, i) => (i === personEditor.index ? person : r)),
            );
            mark();
            setPersonEditor(undefined);
          }}
        />
      )}
      {slotEditor && (
        <SlotEditor
          slot={
            slotEditor.index === undefined ? undefined : slots[slotEditor.index]
          }
          company={company}
          department={department}
          projectOptions={projectOptions}
          onClose={() => setSlotEditor(undefined)}
          onSave={(rows, labels) => {
            setProjectOptions(labels);
            setSlots((v) =>
              [...v.filter((_, i) => i !== slotEditor.index), ...rows].sort(
                (a, b) =>
                  a.weekday - b.weekday || a.start.localeCompare(b.start),
              ),
            );
            mark();
            setSlotEditor(undefined);
          }}
        />
      )}
      {teamImport && (
        <TeamImport
          company={company}
          department={department}
          onClose={() => setTeamImport(false)}
          onSave={(rows) => {
            setPeople((v) => [
              ...v,
              ...rows.filter(
                (r) => !v.some((p) => p.therapist === r.therapist),
              ),
            ]);
            mark();
            setTeamImport(false);
          }}
        />
      )}
      {slotDetail && (
        <DetailDrawer
          name={slotDetail}
          onClose={() => setSlotDetail(undefined)}
        />
      )}
    </DrawerForm>
  );
}
