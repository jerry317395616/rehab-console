import {
  type ActionType,
  DrawerForm,
  ModalForm,
  type ProColumns,
  ProDescriptions,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
  ProFormTimePicker,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Drawer,
  Form,
  Grid,
  Result,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import * as S from './service';

const labels: Record<string, string> = {
  patient: '患者',
  company: '机构',
  practitioner: '接诊医生',
  appointment_type: '接诊类型',
  appointment: '关联预约',
  encounter_date: '接诊日期',
  encounter_time: '接诊时间',
  rehab_visit_type: '初诊／复诊',
  rehab_visit_reason: '就诊原因',
  symptoms: '主诉',
  diagnosis: '诊断',
  encounter_comment: '接诊说明',
};
const changeColumns = [
  {
    title: '属性',
    dataIndex: 'label',
    render: (_: unknown, r: S.Change) => r.label || labels[r.field],
  },
  { title: '原值', dataIndex: 'before' },
  { title: '新值', dataIndex: 'after' },
];

export default function PatientVisits({
  patient: fixedPatient,
  initialKey,
  initialKind = 'all',
}: {
  patient?: string;
  initialKey?: string;
  initialKind?: string;
}) {
  const { message } = App.useApp(),
    screens = Grid.useBreakpoint();
  const table = useRef<ActionType>(undefined),
    busyRef = useRef(false),
    requestId = useRef(''),
    detailId = useRef(0);
  const [form] = Form.useForm();
  const [opts, setOpts] = useState<S.Options>(),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [view, setView] = useState('all'),
    [selected, setSelected] = useState<S.Detail>(),
    [tab, setTab] = useState('base');
  const [editing, setEditing] = useState<S.Row>(),
    [editOpen, setEditOpen] = useState(false),
    [allowed, setAllowed] = useState<string[]>([]);
  const [preview, setPreview] = useState<S.Preview>(),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{
      row: S.Row;
      action: 'complete' | 'cancel';
    }>(),
    [actionPreview, setActionPreview] = useState<S.Preview>();
  const [appointments, setAppointments] = useState<S.Choice[]>([]);
  const patient = Form.useWatch('patient', form),
    company = Form.useWatch('company', form),
    department = Form.useWatch('department', form),
    doctor = Form.useWatch('practitioner', form),
    date = Form.useWatch('encounter_date', form);
  const fail = (e: unknown) => message.error(errorMessage(e));
  useEffect(() => {
    let active = true;
    S.options()
      .then((v) => {
        if (active) {
          setOpts(v);
          setError('');
        }
      })
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [attempt]);
  async function openDetail(key: string) {
    const id = ++detailId.current;
    try {
      const result = await S.detail(key);
      if (id === detailId.current) {
        setSelected(result);
        setTab('base');
      }
    } catch (e) {
      fail(e);
    }
  }
  useEffect(() => {
    if (initialKey) void openDetail(initialKey);
  }, [initialKey]);
  function closeDetail() {
    detailId.current++;
    setSelected(undefined);
  }
  async function edit(row?: S.Row) {
    if (busyRef.current || !opts) return;
    try {
      const ctx = row ? await S.editContext(row.key) : undefined;
      const current = ctx ? opts : await S.options();
      if (!ctx) {
        setOpts(current);
        if (!current.can_create) {
          message.warning('新增门诊权限已变化，请核对授权。');
          return;
        }
      }
      form.resetFields();
      setPreview(undefined);
      setAck(false);
      setAppointments([]);
      form.setFieldsValue(
        ctx
          ? { ...ctx.values, department: ctx.row.department }
          : {
              patient: fixedPatient,
              encounter_date: current.site_now.slice(0, 10),
              encounter_time: current.site_now.slice(11, 19),
              rehab_visit_type: '初诊',
              reason: '门诊登记',
            },
      );
      setEditing(ctx?.row);
      setAllowed(ctx?.write_fields || current.write_fields);
      requestId.current = crypto.randomUUID();
      setEditOpen(true);
    } catch (e) {
      fail(e);
    }
  }
  const enabled = (k: string) => allowed.includes(k);
  async function check(values: Record<string, unknown>) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const fields = allowed.filter((k) =>
        !editing ? values[k] !== undefined : form.isFieldTouched(k),
      );
      const patch = Object.fromEntries(
        fields.map((k) => [k, values[k] ?? null]),
      );
      setPreview(
        await S.preview({
          key: editing?.key,
          modified: editing?.modified,
          values: patch,
          reason: values.reason,
          request_id: requestId.current,
        }),
      );
      setAck(false);
    } catch (e) {
      fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    return false;
  }
  async function confirm() {
    if (!preview || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let key: string;
      try {
        key = (await S.confirm(preview.token, ack)).key;
      } catch (e) {
        const found = await S.receipt(requestId.current).catch(() => undefined);
        if (!found?.key) throw e;
        key = found.key;
      }
      setEditOpen(false);
      setPreview(undefined);
      table.current?.reload();
      message.success('接诊资料已保存');
      await openDetail(key);
    } catch (e) {
      fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const request = (kind: string, extra: Record<string, unknown> = {}) => ({
    request: ({ keyWords }: { keyWords?: string }) =>
      S.references(kind, { keyword: keyWords || '', ...extra }),
    fieldProps: {
      showSearch: true,
      filterOption: false,
      'aria-label': (
        {
          patient: '患者',
          practitioner: '接诊医生',
          diagnosis: '诊断',
          complaint: '主诉',
        } as Record<string, string>
      )[kind],
    },
  });
  async function loadAppointments() {
    try {
      const list = await S.references('appointment', {
        patient: editing?.patient || patient,
        company: editing?.company || company,
        practitioner: doctor,
        date: typeof date === 'string' ? date : date?.format?.('YYYY-MM-DD'),
      });
      setAppointments(list);
      if (!list.length) message.info('暂无匹配的可用预约');
    } catch (e) {
      fail(e);
    }
  }
  function doAction(row: S.Row, value: 'complete' | 'cancel') {
    requestId.current = crypto.randomUUID();
    setActionPreview(undefined);
    setAction({ row, action: value });
  }
  const columns: ProColumns<S.Row>[] = [
    {
      title: '患者或就诊编号',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { 'aria-label': '患者或就诊编号' },
    },
    {
      title: '类型',
      dataIndex: 'kind',
      valueType: 'select',
      initialValue: initialKind,
      valueEnum: {
        all: { text: '全部' },
        outpatient: { text: '门诊' },
        inpatient: { text: '住院' },
      },
      width: 80,
    },
    { title: '患者姓名', dataIndex: 'patient_name', search: false, width: 140 },
    { title: '性别', dataIndex: 'sex', search: false, width: 80 },
    {
      title: '年龄',
      dataIndex: 'age',
      search: false,
      width: 80,
      render: (_, r) => (r.age == null ? '—' : `${r.age} 岁`),
    },
    { title: '就诊编号', dataIndex: 'name', search: false, width: 205 },
    {
      title: '机构',
      dataIndex: 'company',
      valueType: 'select',
      fieldProps: { options: opts?.companies, showSearch: true },
      width: 150,
    },
    {
      title: '科室',
      dataIndex: 'department',
      valueType: 'select',
      fieldProps: { options: opts?.departments, showSearch: true },
      width: 130,
    },
    {
      title: '接诊医生',
      dataIndex: 'practitioner',
      valueType: 'select',
      ...request('practitioner'),
      render: (_, r) => r.practitioner_name || '—',
      width: 120,
    },
    {
      title: '日期范围',
      dataIndex: 'dates',
      valueType: 'dateRange',
      hideInTable: true,
    },
    {
      title: '就诊时间',
      dataIndex: 'date',
      search: false,
      width: 170,
      render: (_, r) => (r.date ? `${r.date} ${r.time || ''}` : '—'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(S.states).map(([value, text]) => [value, { text }]),
      ),
      width: 100,
      render: (_, r) => (
        <Tag>{S.states[r.status] || r.status || '未登记状态'}</Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 210,
      fixed: 'right',
      render: (_, r) => [
        <Button key="view" type="link" onClick={() => openDetail(r.key)}>
          查看
        </Button>,
        r.can_edit && (
          <Button key="edit" type="link" onClick={() => edit(r)}>
            修改
          </Button>
        ),
        r.can_complete && (
          <Button
            key="complete"
            type="link"
            onClick={() => doAction(r, 'complete')}
          >
            完成接诊
          </Button>
        ),
        r.can_cancel && (
          <Button
            key="cancel"
            type="link"
            danger
            onClick={() => doAction(r, 'cancel')}
          >
            作废
          </Button>
        ),
      ],
    },
  ];
  if (error)
    return (
      <Result
        status="warning"
        title="暂时无法读取患者就诊"
        subTitle={error}
        extra={<Button onClick={() => setAttempt((x) => x + 1)}>重试</Button>}
      />
    );
  const related = (bucket: string) => {
    const section = selected?.related[bucket];
    return !section?.available ? (
      <Alert
        type="info"
        title={section?.notice || '当前账号未获得此类关联来源的访问权限。'}
      />
    ) : (
      <>
        <Table<S.RelatedRow>
          rowKey="name"
          size="small"
          scroll={{ x: 600 }}
          dataSource={section.rows}
          columns={[
            { title: '记录编号', dataIndex: 'name' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (v: string) =>
                (
                  ({
                    ...S.states,
                    Authorized: '已临床确认',
                    'Pending Review': '待审核',
                    'Awaiting Signature': '待核对原确认',
                    Scheduled: '已预约',
                    Accepted: '已接收',
                    Assigned: '已分配',
                    'In Progress': '进行中',
                    Active: '进行中',
                    Closed: '已结束',
                    Completed: '已完成',
                    Cancelled: '已取消',
                    Draft: '草稿',
                  }) as Record<string, string>
                )[v] || v,
            },
            { title: '日期', dataIndex: 'date' },
            ...(bucket === 'treatments'
              ? [{ title: '关联医嘱', dataIndex: 'order' }]
              : []),
            ...(bucket === 'consultations'
              ? [
                  { title: '接诊医生', dataIndex: 'doctor' },
                  { title: '接诊说明', dataIndex: 'note' },
                ]
              : []),
            ...(bucket === 'episodes'
              ? [{ title: '诊疗过程', dataIndex: 'title' }]
              : []),
          ]}
        />
        {section.truncated && (
          <Alert
            type="warning"
            title="当前展示最近100条可读关联记录；请在相应业务列表中继续核对。"
          />
        )}
      </>
    );
  };
  const values = selected?.values;
  return (
    <>
      <ProTable<S.Row>
        form={{ name: `visit-search-${fixedPatient || 'all'}` }}
        actionRef={table}
        rowKey="key"
        columns={columns}
        loading={!opts ? true : undefined}
        params={{ view, patient: fixedPatient }}
        scroll={{ x: 1400 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        headerTitle="就诊记录"
        toolbar={{
          menu: {
            type: 'tab',
            activeKey: view,
            items: [
              { key: 'all', label: '全部就诊' },
              { key: 'today', label: '今日就诊' },
              { key: 'current', label: '进行中／在院' },
              { key: 'history', label: '历史就诊' },
            ],
            onChange: (key) => setView(key as string),
          },
        }}
        toolBarRender={() =>
          opts?.can_create
            ? [
                <Button key="create" type="primary" onClick={() => edit()}>
                  新建门诊
                </Button>,
              ]
            : []
        }
        request={async (p) => {
          try {
            return await S.visits({
              ...p,
              dates: undefined,
              pageSize: undefined,
              page_size: p.pageSize,
              date_from: p.dates?.[0],
              date_to: p.dates?.[1],
            });
          } catch (e) {
            fail(e);
            return { data: [], total: 0, success: false };
          }
        }}
      />
      <DrawerForm
        name="patient-visit-edit"
        disabled={busy}
        key={screens.md ? 'desktop' : 'mobile'}
        title={editing ? '修改门诊接诊' : '新建门诊接诊'}
        width={screens.md ? 760 : '100%'}
        form={form}
        open={editOpen}
        onOpenChange={(v) => {
          if (!busyRef.current) setEditOpen(v);
        }}
        grid
        rowProps={{ gutter: 16 }}
        drawerProps={{
          destroyOnHidden: true,
          closable: !busy,
          maskClosable: !busy,
        }}
        onFinish={check}
        onValuesChange={(changed) => {
          setPreview(undefined);
          setAck(false);
          if ('company' in changed || 'department' in changed) {
            form.setFieldValue('practitioner', undefined);
            form.setFieldValue('appointment', undefined);
            setAppointments([]);
          }
          if (
            'patient' in changed ||
            'practitioner' in changed ||
            'encounter_date' in changed
          ) {
            if ('patient' in changed)
              form.setFieldValue('practitioner', undefined);
            form.setFieldValue('appointment', undefined);
            setAppointments([]);
          }
        }}
        submitter={{
          searchConfig: { submitText: '核对并预览', resetText: '取消' },
          submitButtonProps: { loading: busy, disabled: busy },
          resetButtonProps: { disabled: busy },
        }}
      >
        <Col span={24}>
          <Alert
            type="info"
            title="登记保存接诊草稿；完成接诊需由本次接诊医生按权限另行确认。"
          />
        </Col>
        {enabled('patient') && (
          <ProFormSelect
            name="patient"
            label="患者"
            {...request('patient')}
            rules={[{ required: true }]}
            disabled={!!fixedPatient}
          />
        )}
        {editing && (
          <Col span={24}>
            <Typography.Paragraph>
              {editing.patient_name} · {editing.patient}
            </Typography.Paragraph>
          </Col>
        )}
        {enabled('company') && (
          <ProFormSelect
            name="company"
            label="机构"
            options={opts?.companies}
            showSearch
            rules={[{ required: true }]}
            colProps={{ md: 12 }}
          />
        )}
        {enabled('practitioner') && (
          <>
            <ProFormSelect
              name="department"
              label="科室（筛选医生）"
              options={opts?.departments}
              showSearch
              colProps={{ md: 12 }}
            />
            <ProFormSelect
              key={`${editing?.company || company}:${department}:${editing?.patient || patient}`}
              name="practitioner"
              label="接诊医生"
              {...request('practitioner', {
                company: editing?.company || company,
                department,
                patient: editing?.patient || patient,
              })}
              rules={[{ required: true }]}
              colProps={{ md: 12 }}
              tooltip="接诊科室取所选医生档案中的科室。"
            />
          </>
        )}
        {enabled('appointment_type') && (
          <ProFormSelect
            name="appointment_type"
            label="接诊类型"
            options={opts?.appointment_types}
            showSearch
            rules={[{ required: true }]}
            colProps={{ md: 12 }}
          />
        )}
        {enabled('encounter_date') && (
          <ProFormDatePicker
            name="encounter_date"
            label="接诊日期"
            rules={[{ required: true }]}
            colProps={{ md: 12 }}
          />
        )}
        {enabled('encounter_time') && (
          <ProFormTimePicker
            name="encounter_time"
            label="接诊时间"
            rules={[{ required: true }]}
            colProps={{ md: 12 }}
          />
        )}
        {enabled('rehab_visit_type') && (
          <ProFormSelect
            name="rehab_visit_type"
            label="初诊／复诊"
            options={['初诊', '复诊']}
            rules={[{ required: true }]}
          />
        )}
        {enabled('rehab_visit_reason') && (
          <ProFormTextArea
            name="rehab_visit_reason"
            label="就诊原因"
            rules={[{ required: true, whitespace: true }]}
            fieldProps={{ maxLength: 2000, rows: 2 }}
          />
        )}
        {enabled('appointment') && (
          <>
            <Col span={24}>
              <Button
                onClick={loadAppointments}
                disabled={!patient || !company || !doctor}
              >
                查找匹配预约
              </Button>
            </Col>
            <ProFormSelect
              name="appointment"
              label="关联预约（可选）"
              options={appointments}
              fieldProps={{
                onChange: (v) => {
                  const item = appointments.find((a) => a.value === v);
                  if (item) {
                    form.setFields([
                      {
                        name: 'appointment_type',
                        value: item.appointment_type,
                        touched: true,
                      },
                    ]);
                    setPreview(undefined);
                  }
                },
              }}
            />
          </>
        )}
        {enabled('symptoms') && (
          <ProFormSelect
            name="symptoms"
            label="主诉"
            mode="multiple"
            {...request('complaint')}
          />
        )}
        {enabled('diagnosis') && (
          <ProFormSelect
            name="diagnosis"
            label="诊断"
            mode="multiple"
            {...request('diagnosis')}
          />
        )}
        {enabled('encounter_comment') && (
          <ProFormTextArea
            name="encounter_comment"
            label="接诊说明"
            fieldProps={{ maxLength: 2000, rows: 3 }}
          />
        )}
        <ProFormTextArea
          name="reason"
          label="操作说明"
          rules={[{ required: true, whitespace: true }]}
          fieldProps={{ maxLength: 2000, rows: 2 }}
        />
        {preview && (
          <Col span={24}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Alert
                type={preview.has_possible_duplicates ? 'warning' : 'success'}
                title={preview.notice}
              />
              {!!preview.candidates?.length && (
                <Table<S.Row>
                  rowKey="key"
                  size="small"
                  scroll={{ x: 500 }}
                  dataSource={preview.candidates}
                  columns={[
                    { title: '已有就诊', dataIndex: 'name' },
                    { title: '时间', dataIndex: 'date' },
                    {
                      title: '操作',
                      render: (_, r) => (
                        <Button type="link" onClick={() => openDetail(r.key)}>
                          查看已有接诊
                        </Button>
                      ),
                    },
                  ]}
                  pagination={false}
                />
              )}
              <Table
                rowKey="field"
                size="small"
                scroll={{ x: 500 }}
                dataSource={preview.changes}
                columns={changeColumns}
                pagination={false}
              />
              {preview.has_possible_duplicates && (
                <Checkbox
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                >
                  已核实已有接诊，确认本次操作
                </Checkbox>
              )}
              <Button
                type="primary"
                loading={busy}
                disabled={!!preview.has_possible_duplicates && !ack}
                onClick={confirm}
              >
                确认保存接诊
              </Button>
            </Space>
          </Col>
        )}
      </DrawerForm>
      <Drawer
        title="患者就诊详情"
        size={screens.md ? 900 : '100%'}
        open={!!selected}
        onClose={closeDetail}
        extra={<Button onClick={closeDetail}>关闭</Button>}
        destroyOnHidden
      >
        {selected && (
          <>
            <Space wrap>
              <Typography.Text strong>
                {selected.row.patient_name}
              </Typography.Text>
              <Tag>{selected.row.name}</Tag>
              <Tag>{S.states[selected.row.status] || selected.row.status}</Tag>
            </Space>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                {
                  key: 'base',
                  label: '就诊资料',
                  children: (
                    <>
                      <ProDescriptions<S.Row>
                        column={screens.md ? 2 : 1}
                        dataSource={selected.row}
                        columns={[
                          { title: '患者编号', dataIndex: 'patient' },
                          { title: '机构', dataIndex: 'company' },
                          { title: '科室', dataIndex: 'department' },
                          { title: '接诊医生', dataIndex: 'practitioner_name' },
                          { title: '就诊日期', dataIndex: 'date' },
                          { title: '时间', dataIndex: 'time' },
                          {
                            title: '初诊／复诊',
                            render: () =>
                              String(values?.rehab_visit_type || '—'),
                          },
                          {
                            title: '就诊原因',
                            render: () =>
                              String(values?.rehab_visit_reason || '—'),
                          },
                          {
                            title: '关联预约',
                            render: () => String(values?.appointment || '—'),
                          },
                        ]}
                      />
                      {selected.row.limitation && (
                        <Alert type="info" title={selected.row.limitation} />
                      )}
                    </>
                  ),
                },
                {
                  key: 'clinical',
                  label: '接诊记录',
                  children: (
                    <>
                      <ProDescriptions
                        column={1}
                        columns={['symptoms', 'diagnosis', 'encounter_comment']
                          .filter((k) => k in (values || {}))
                          .map((k) => ({
                            title: labels[k],
                            render: () =>
                              Array.isArray(values?.[k])
                                ? (values[k] as string[]).join('、') || '—'
                                : String(values?.[k] || '—'),
                          }))}
                      />
                      {selected.row.kind === 'inpatient' &&
                        related('consultations')}
                    </>
                  ),
                },
                {
                  key: 'orders',
                  label: '评估与医嘱',
                  children: (
                    <>
                      <Typography.Title level={5}>评估</Typography.Title>
                      {related('assessments')}
                      <Typography.Title level={5}>医嘱</Typography.Title>
                      {related('orders')}
                    </>
                  ),
                },
                {
                  key: 'treatments',
                  label: '治疗安排',
                  children: related('treatments'),
                },
                {
                  key: 'episodes',
                  label: '康复诊疗过程',
                  children: related('episodes'),
                },
                {
                  key: 'history',
                  label: '操作历史',
                  children: (
                    <Table
                      rowKey="name"
                      size="small"
                      scroll={{ x: 600 }}
                      dataSource={selected.history}
                      columns={[
                        {
                          title: '操作',
                          dataIndex: 'action',
                          render: (v) => S.actions[v] || v,
                        },
                        { title: '操作人', dataIndex: 'actor' },
                        { title: '时间', dataIndex: 'date' },
                        { title: '说明', dataIndex: 'reason' },
                      ]}
                      expandable={{
                        expandedRowRender: (r) => (
                          <Table
                            rowKey="field"
                            columns={changeColumns}
                            dataSource={r.changes}
                            pagination={false}
                          />
                        ),
                      }}
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
      <ModalForm
        name="patient-visit-action"
        disabled={busy}
        key={`${action?.row.key}:${action?.action}`}
        title={action?.action === 'cancel' ? '作废接诊' : '完成接诊'}
        open={!!action}
        onOpenChange={(v) => {
          if (!v && !busyRef.current) setAction(undefined);
        }}
        modalProps={{
          destroyOnHidden: true,
          maskClosable: !busy,
          closable: !busy,
        }}
        submitter={{
          searchConfig: { submitText: '预览操作' },
          submitButtonProps: { loading: busy },
        }}
        onFinish={async (v) => {
          if (!action || busyRef.current) return false;
          busyRef.current = true;
          setBusy(true);
          try {
            setActionPreview(
              await S.previewAction({
                key: action.row.key,
                modified: action.row.modified,
                action: action.action,
                reason: v.reason,
                request_id: requestId.current,
              }),
            );
          } catch (e) {
            fail(e);
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
          return false;
        }}
        onValuesChange={() => setActionPreview(undefined)}
      >
        <ProFormTextArea
          name="reason"
          label="操作依据"
          rules={[{ required: true, whitespace: true }]}
          fieldProps={{ maxLength: 2000 }}
        />
        {actionPreview && (
          <Space orientation="vertical">
            <Alert type="warning" title={actionPreview.notice} />
            <Button
              type="primary"
              danger={action?.action === 'cancel'}
              loading={busy}
              onClick={async () => {
                if (busyRef.current) return;
                busyRef.current = true;
                setBusy(true);
                try {
                  const result = await S.confirmAction(actionPreview.token);
                  setAction(undefined);
                  table.current?.reload();
                  await openDetail(result.key);
                  message.success('接诊状态已更新');
                } catch (e) {
                  fail(e);
                } finally {
                  busyRef.current = false;
                  setBusy(false);
                }
              }}
            >
              确认{action?.action === 'cancel' ? '作废' : '完成'}接诊
            </Button>
          </Space>
        )}
      </ModalForm>
    </>
  );
}
