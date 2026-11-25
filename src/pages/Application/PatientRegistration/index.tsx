import {
  type ActionType,
  DrawerForm,
  ModalForm,
  ProDescriptions,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Drawer,
  Empty,
  Form,
  Grid,
  Space,
  Table,
  Tabs,
  Tag,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import PatientVisits from '../PatientVisits';
import * as S from './service';

const labels: Record<string, string> = {
  first_name: '姓名／名',
  middle_name: '中间名',
  last_name: '姓氏',
  sex: '性别',
  dob: '出生日期',
  uid: '证件号码',
  mobile: '手机号',
  phone: '联系电话',
  email: '电子邮箱',
  rehab_id_type: '证件类型',
  rehab_id_country: '证件签发国家或地区',
  rehab_contact_name: '联系人姓名',
  rehab_contact_relation: '联系人关系',
  rehab_contact_phone: '联系人电话',
  rehab_registration_address: '登记住址',
  rehab_registration_source: '登记来源',
  rehab_registration_note: '登记备注',
};
const columns = [
  {
    title: '属性',
    dataIndex: 'label',
    render: (_: unknown, r: S.Change) => r.label || labels[r.field],
  },
  { title: '原值', dataIndex: 'before', render: (v: string) => v || '—' },
  { title: '新值', dataIndex: 'after', render: (v: string) => v || '—' },
];

export default function PatientRegistration() {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const table = useRef<ActionType>(undefined);
  const [form] = Form.useForm();
  const [opts, setOpts] = useState<S.Options>();
  const [loadError, setLoadError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [editing, setEditing] = useState<S.Patient>();
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [allowed, setAllowed] = useState<string[]>([]);
  const [preview, setPreview] = useState<S.Preview>();
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestId = useRef('');
  const detailRequest = useRef(0);
  const [selected, setSelected] = useState<S.Detail>();
  const [revealed, setRevealed] = useState<Record<string, string>>();
  const [revealOpen, setRevealOpen] = useState(false);
  const [tab, setTab] = useState('basic');
  const [visitPatient, setVisitPatient] = useState<{
    name: string;
    key?: string;
  }>();

  const fail = (e: unknown) => message.error(errorMessage(e));
  const load = () => {
    setLoadError('');
    S.options()
      .then(setOpts)
      .catch((e) => setLoadError(errorMessage(e)));
  };
  useEffect(load, []);
  async function view(name: string) {
    const current = ++detailRequest.current;
    try {
      setRevealed(undefined);
      const result = await S.detail(name);
      if (current !== detailRequest.current) return;
      setSelected(result);
      setTab('basic');
    } catch (e) {
      fail(e);
    }
  }
  function closeDetail() {
    detailRequest.current += 1;
    setSelected(undefined);
    setRevealed(undefined);
    setRevealOpen(false);
  }
  async function edit(row?: S.Patient) {
    if (busyRef.current || !opts) return;
    try {
      const ctx = row ? await S.editContext(row.name) : undefined;
      form.resetFields();
      if (ctx) form.setFieldsValue(ctx.values);
      else
        form.setFieldsValue({
          rehab_registration_source: '人工登记',
          reason: '患者首次建档',
        });
      setEditing(ctx?.row);
      setSaved(ctx?.saved_sensitive || {});
      setAllowed(ctx?.write_fields || opts.write_fields);
      requestId.current = crypto.randomUUID();
      setPreview(undefined);
      setAck(false);
      setDrawer(true);
    } catch (e) {
      fail(e);
    }
  }
  async function check(values: Record<string, unknown>) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const clear = (values.clear_fields || []) as string[];
      const patch = Object.fromEntries(
        allowed
          .filter((k) =>
            !editing ? values[k] !== undefined : form.isFieldTouched(k),
          )
          .map((k) => [k, values[k] ?? null]),
      );
      for (const key of clear) patch[key] = null;
      const result = await S.preview({
        name: editing?.name,
        modified: editing?.modified,
        values: patch,
        reason: values.reason,
        request_id: requestId.current,
      });
      setPreview(result);
      setAck(false);
    } catch (e) {
      fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    return false;
  }
  async function save() {
    if (!preview || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let name: string;
      try {
        name = (await S.confirm(preview.token, ack)).name;
      } catch (e) {
        // Recover an acknowledged server receipt after an uncertain connection.
        const result = await S.receipt(requestId.current).catch(
          () => undefined,
        );
        if (!result?.name) throw e;
        name = result.name;
      }
      setDrawer(false);
      setPreview(undefined);
      table.current?.reload();
      message.success(editing ? '患者资料已保存' : '患者建档成功');
      await view(name);
    } catch (e) {
      fail(e);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const input = (key: string) => allowed.includes(key);
  const read = (key: string) => opts?.read_fields.includes(key);
  const description = (keys: string[], row: S.Patient) => (
    <ProDescriptions
      column={screens.md ? 2 : 1}
      dataSource={{
        ...row,
        ...revealed,
        sex: opts?.genders.find((g) => g.value === row.sex)?.label || row.sex,
      }}
      columns={keys.filter(read).map((k) => ({
        title: labels[k],
        dataIndex: k,
        render: (_, r) => String(r[k] ?? '') || '—',
      }))}
    />
  );
  if (loadError)
    return (
      <Alert
        type="error"
        title={loadError}
        action={<Button onClick={load}>重试</Button>}
      />
    );
  return (
    <>
      <ProTable<S.Patient>
        actionRef={table}
        rowKey="name"
        loading={!opts ? true : undefined}
        headerTitle="患者档案"
        scroll={{ x: 1050 }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() =>
          opts?.can_create
            ? [
                <Button key="new" type="primary" onClick={() => edit()}>
                  新增患者
                </Button>,
              ]
            : []
        }
        request={async (p) => {
          try {
            return await S.patients({
              keyword: p.keyword,
              status: p.status,
              current: p.current,
              page_size: p.pageSize,
            });
          } catch (e) {
            fail(e);
            return { data: [], total: 0, success: false };
          }
        }}
        columns={[
          {
            title: '姓名、编号、证件或完整电话',
            dataIndex: 'keyword',
            hideInTable: true,
          },
          { title: '患者编号', dataIndex: 'name', search: false, width: 200 },
          {
            title: '患者姓名',
            dataIndex: 'patient_name',
            search: false,
            width: 140,
          },
          {
            title: '性别',
            dataIndex: 'sex',
            search: false,
            hideInTable: !read('sex'),
            width: 90,
            renderText: (v) =>
              opts?.genders.find((g) => g.value === v)?.label || v,
          },
          {
            title: '年龄',
            dataIndex: 'age',
            search: false,
            hideInTable: !read('dob'),
            width: 90,
            render: (_, r) => (r.age == null ? '—' : `${r.age} 岁`),
          },
          {
            title: '手机号',
            dataIndex: 'mobile',
            search: false,
            hideInTable: !read('mobile'),
            width: 130,
          },
          {
            title: '身份信息',
            dataIndex: 'identity_state',
            search: false,
            hideInTable: !read('uid'),
            width: 150,
          },
          {
            title: '档案状态',
            dataIndex: 'status',
            valueType: 'select',
            valueEnum: {
              Active: { text: '在用', status: 'Success' },
              Disabled: { text: '停用／待办理', status: 'Default' },
            },
            width: 130,
          },
          {
            title: '操作',
            valueType: 'option',
            width: 145,
            render: (_, r) => [
              <Button key="view" type="link" onClick={() => view(r.name)}>
                查看
              </Button>,
              r.can_edit && (
                <Button key="edit" type="link" onClick={() => edit(r)}>
                  修改
                </Button>
              ),
            ],
          },
        ]}
      />
      <DrawerForm
        key={screens.md ? 'desktop' : 'mobile'}
        title={editing ? '修改患者资料' : '新增患者'}
        form={form}
        open={drawer}
        onOpenChange={(v) => {
          if (!busyRef.current) {
            setDrawer(v);
            if (!v) setPreview(undefined);
          }
        }}
        grid
        width={screens.md ? 760 : '100%'}
        rowProps={{ gutter: 16 }}
        onValuesChange={() => {
          setPreview(undefined);
          setAck(false);
        }}
        onFinish={check}
        drawerProps={{
          destroyOnHidden: true,
          maskClosable: !busy,
          closable: !busy,
        }}
        submitter={{
          searchConfig: { submitText: '查重并预览', resetText: '取消' },
          submitButtonProps: { loading: busy, disabled: busy },
          resetButtonProps: { disabled: busy },
        }}
      >
        <Col span={24}>
          <Alert
            type="info"
            title={
              editing
                ? '敏感字段留空表示保留原值；填写新值表示替换，清空请使用下方选项。'
                : '先查重并核对资料，再确认建档。出生日期未知可留空。'
            }
          />
        </Col>
        {['first_name', 'middle_name', 'last_name'].filter(input).map((k) => (
          <ProFormText
            key={k}
            name={k}
            label={labels[k]}
            colProps={{ md: 8 }}
            rules={k === 'first_name' ? [{ required: true }] : []}
            fieldProps={{ maxLength: 140 }}
          />
        ))}
        {input('sex') && (
          <ProFormSelect
            name="sex"
            label="性别"
            colProps={{ md: 12 }}
            options={opts?.genders}
            rules={[{ required: true }]}
          />
        )}
        {input('dob') && (
          <ProFormDatePicker
            name="dob"
            label="出生日期"
            colProps={{ md: 12 }}
          />
        )}
        {input('rehab_id_type') && (
          <ProFormSelect
            name="rehab_id_type"
            label={labels.rehab_id_type}
            colProps={{ md: 12 }}
            options={opts?.identity_types}
          />
        )}
        {input('rehab_id_country') && (
          <ProFormSelect
            name="rehab_id_country"
            label={labels.rehab_id_country}
            colProps={{ md: 12 }}
            options={opts?.countries}
            showSearch
          />
        )}
        {[
          'uid',
          'mobile',
          'phone',
          'email',
          'rehab_contact_name',
          'rehab_contact_relation',
          'rehab_contact_phone',
        ]
          .filter(input)
          .map((k) => (
            <ProFormText
              key={k}
              name={k}
              label={labels[k]}
              colProps={{ md: k === 'uid' ? 24 : 12 }}
              placeholder={
                saved[k] ? `已保存：${saved[k]}；填写以替换` : undefined
              }
              fieldProps={{ maxLength: 140 }}
            />
          ))}
        {input('rehab_registration_address') && (
          <ProFormTextArea
            name="rehab_registration_address"
            label={labels.rehab_registration_address}
            placeholder={
              saved.rehab_registration_address
                ? '已登记；填写以替换'
                : undefined
            }
            fieldProps={{ maxLength: 1000, rows: 2 }}
          />
        )}
        {input('rehab_registration_source') && (
          <ProFormSelect
            name="rehab_registration_source"
            label={labels.rehab_registration_source}
            options={opts?.sources}
          />
        )}
        {input('rehab_registration_note') && (
          <ProFormTextArea
            name="rehab_registration_note"
            label={labels.rehab_registration_note}
            fieldProps={{ maxLength: 1000, rows: 2 }}
          />
        )}
        {editing && (
          <ProFormSelect
            name="clear_fields"
            label="明确清空以下已保存资料"
            mode="multiple"
            options={allowed
              .filter((k) => !['first_name', 'sex'].includes(k))
              .map((k) => ({ value: k, label: labels[k] }))}
          />
        )}
        <ProFormTextArea
          name="reason"
          label={editing ? '修改原因' : '登记说明'}
          rules={[{ required: true, whitespace: true }]}
          fieldProps={{ maxLength: 1000, rows: 2 }}
        />
        {preview && (
          <Col span={24}>
            <Space
              orientation="vertical"
              size="middle"
              style={{ width: '100%' }}
            >
              <Alert
                type={
                  preview.blocked
                    ? 'error'
                    : preview.has_possible_duplicates
                      ? 'warning'
                      : 'success'
                }
                title={preview.notice}
              />
              {!!preview.candidates.length && (
                <Table
                  size="small"
                  rowKey="name"
                  pagination={false}
                  scroll={{ x: 600 }}
                  dataSource={preview.candidates}
                  columns={[
                    { title: '患者编号', dataIndex: 'name' },
                    { title: '姓名', dataIndex: 'patient_name' },
                    { title: '匹配原因', dataIndex: 'match' },
                    { title: '电话', dataIndex: 'mobile' },
                    {
                      title: '核实',
                      render: (_, r) => (
                        <Button type="link" onClick={() => view(r.name)}>
                          查看已有档案
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
              <Table
                size="small"
                rowKey="field"
                dataSource={preview.changes}
                columns={columns}
                pagination={false}
                scroll={{ x: 500 }}
              />
              {preview.has_possible_duplicates && !preview.blocked && (
                <Checkbox
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                >
                  已核实候选档案，确认本次登记属于另一位患者或本次资料修改正确
                </Checkbox>
              )}
              <Button
                type="primary"
                loading={busy}
                disabled={
                  !preview.can_confirm ||
                  (preview.has_possible_duplicates && !ack)
                }
                onClick={save}
              >
                确认{preview.action}
              </Button>
            </Space>
          </Col>
        )}
      </DrawerForm>
      <Drawer
        title="患者档案详情"
        open={!!selected}
        size={screens.md ? 860 : '100%'}
        onClose={closeDetail}
        extra={<Button onClick={closeDetail}>关闭</Button>}
        destroyOnHidden
      >
        {selected && (
          <>
            <Space wrap>
              <strong>{selected.row.patient_name}</strong>
              <Tag>{selected.row.name}</Tag>
              {selected.row.can_reveal && (
                <Button onClick={() => setRevealOpen(true)}>
                  查看敏感资料
                </Button>
              )}
            </Space>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                {
                  key: 'basic',
                  label: '基本资料',
                  children: (
                    <>
                      {description(
                        [
                          'first_name',
                          'middle_name',
                          'last_name',
                          'sex',
                          'dob',
                          'rehab_id_type',
                          'rehab_id_country',
                          'uid',
                          'rehab_registration_source',
                          'rehab_registration_note',
                        ],
                        selected.row,
                      )}
                      <Alert
                        type="info"
                        title="证件登记不等同于身份已核验。档案启停状态沿用原生患者管理规则。"
                      />
                    </>
                  ),
                },
                {
                  key: 'contact',
                  label: '联系方式',
                  children: description(
                    [
                      'mobile',
                      'phone',
                      'email',
                      'rehab_contact_name',
                      'rehab_contact_relation',
                      'rehab_contact_phone',
                      'rehab_registration_address',
                    ],
                    selected.row,
                  ),
                },
                {
                  key: 'visits',
                  label: '就诊来源',
                  children: (
                    <>
                      <Alert type="info" title={selected.notice} />
                      {opts?.can_read_visits && (
                        <Button
                          onClick={() =>
                            setVisitPatient({ name: selected.row.name })
                          }
                        >
                          管理本患者就诊
                        </Button>
                      )}
                      <Table
                        size="small"
                        rowKey={(r) => `${r.kind}:${r.name}`}
                        scroll={{ x: 650 }}
                        dataSource={selected.visits}
                        columns={[
                          {
                            title: '类型',
                            dataIndex: 'kind',
                            render: (v) =>
                              v === 'Patient Encounter' ? '门诊' : '住院',
                          },
                          { title: '记录编号', dataIndex: 'name' },
                          { title: '机构', dataIndex: 'company' },
                          { title: '科室', dataIndex: 'department' },
                          { title: '日期', dataIndex: 'date' },
                          {
                            title: '操作',
                            render: (_, r) => (
                              <Button
                                type="link"
                                onClick={() =>
                                  setVisitPatient({
                                    name: selected.row.name,
                                    key:
                                      (r.kind === 'Patient Encounter'
                                        ? 'pe:'
                                        : 'ip:') + r.name,
                                  })
                                }
                              >
                                查看就诊
                              </Button>
                            ),
                          },
                        ]}
                        locale={{
                          emptyText: (
                            <Empty description="暂无可读取的就诊来源" />
                          ),
                        }}
                      />
                    </>
                  ),
                },
                {
                  key: 'history',
                  label: '操作记录',
                  children: (
                    <Table
                      size="small"
                      rowKey="name"
                      scroll={{ x: 650 }}
                      dataSource={selected.history}
                      columns={[
                        { title: '操作', dataIndex: 'action' },
                        { title: '操作人', dataIndex: 'actor' },
                        { title: '时间', dataIndex: 'creation' },
                        { title: '原因', dataIndex: 'reason' },
                      ]}
                      expandable={{
                        expandedRowRender: (r) => (
                          <Table
                            size="small"
                            rowKey="field"
                            columns={columns}
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
        title="查看敏感资料"
        open={revealOpen}
        onOpenChange={setRevealOpen}
        modalProps={{ destroyOnHidden: true }}
        onFinish={async (v) => {
          try {
            if (!selected) return false;
            const current = detailRequest.current;
            const result = await S.reveal(selected.row.name, v.reason);
            if (current !== detailRequest.current) return false;
            setRevealed(result);
            setRevealOpen(false);
            return true;
          } catch (e) {
            fail(e);
            return false;
          }
        }}
      >
        <Alert
          type="info"
          title="本次查看将记录操作人、时间和理由。关闭患者详情后恢复脱敏。"
        />
        <ProFormTextArea
          name="reason"
          label="查看理由"
          rules={[{ required: true, whitespace: true }]}
          fieldProps={{ maxLength: 1000 }}
        />
      </ModalForm>
      <Drawer
        title="本患者就诊"
        size={screens.md ? 1200 : '100%'}
        open={!!visitPatient}
        onClose={() => setVisitPatient(undefined)}
        destroyOnHidden
      >
        {visitPatient && (
          <PatientVisits
            key={`${visitPatient.name}:${visitPatient.key}`}
            patient={visitPatient.name}
            initialKey={visitPatient.key}
          />
        )}
      </Drawer>
    </>
  );
}
