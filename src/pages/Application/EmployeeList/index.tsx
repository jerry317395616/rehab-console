import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Alert, App, Button, Descriptions, Form, Space, Tabs } from 'antd';
import { useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import {
  choices,
  type Detail,
  type Employee,
  get,
  type Impact,
  type Listing,
  post,
  type Status,
} from './service';

const states = {
  Active: { text: '在职', status: 'Success' },
  Inactive: { text: '停用', status: 'Default' },
  Suspended: { text: '停职', status: 'Warning' },
  Left: { text: '离职', status: 'Default' },
};
const editable = [
  'first_name',
  'middle_name',
  'last_name',
  'gender',
  'date_of_birth',
  'date_of_joining',
  'employee_number',
  'company',
  'department',
  'designation',
  'reports_to',
] as const;
const required = [{ required: true, message: '请填写此项' }];
type StatusValues = { status?: Status; relieving_date?: string };

export default function EmployeeList({
  userRoute,
  practitionerRoute,
}: {
  userRoute?: string;
  practitionerRoute?: string;
}) {
  const { message, modal } = App.useApp();
  const table = useRef<ActionType>(undefined);
  const working = useRef(false);
  const dirty = useRef(false);
  const [form] = Form.useForm<Employee>();
  const [statusForm] = Form.useForm<StatusValues>();
  const company = Form.useWatch('company', form);
  const targetStatus = Form.useWatch('status', statusForm);
  const [listing, setListing] = useState<Listing>();
  const [entry, setEntry] = useState<Detail>();
  const [impact, setImpact] = useState<Impact>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [statusError, setStatusError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const rights = entry || listing;
  const editableRecord = entry ? entry.can_edit : listing?.can_create;
  const has = (field: string) => Boolean(rights?.read_fields.includes(field));
  const writable = (field: string) =>
    Boolean(
      editableRecord && has(field) && rights?.write_fields.includes(field),
    );

  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的员工资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setOpen(false),
      });
    else setOpen(false);
  }
  async function openEditor(row?: Employee) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const next = row
        ? await get<Detail>('detail', { name: row.name })
        : undefined;
      setEntry(next);
      form.resetFields();
      form.setFieldsValue(next?.doc || {});
      setError(undefined);
      dirty.current = false;
      setOpen(true);
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function openStatus(name: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const result = await get<Impact>('preview_status', { name });
      statusForm.resetFields();
      setStatusError(undefined);
      setImpact(result);
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      {error && !open && <Alert type="error" showIcon title={error} />}
      <ProTable<Employee>
        actionRef={table}
        rowKey="name"
        scroll={{ x: 900 }}
        pagination={{ defaultPageSize: 20 }}
        request={async ({
          current,
          pageSize,
          name,
          employee_number,
          company,
          department,
          designation,
          status,
        }) => {
          const result = await get<Listing>('listing', {
            current,
            page_size: pageSize,
            keyword: name,
            employee_number,
            company,
            department,
            designation,
            status,
          });
          setListing(result);
          setError(undefined);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        columns={[
          {
            title: '员工姓名',
            dataIndex: 'name',
            render: (_, row) => row.employee_name || row.name,
          },
          {
            title: '工号',
            dataIndex: 'employee_number',
            search: has('employee_number'),
          },
          {
            title: '公司',
            dataIndex: 'company',
            valueType: 'select',
            search: has('company'),
            request: ({ keyWords }) => choices('company', keyWords),
          },
          {
            title: '组织部门',
            dataIndex: 'department',
            valueType: 'select',
            search: has('department'),
            request: ({ keyWords }) => choices('department', keyWords),
          },
          {
            title: '岗位',
            dataIndex: 'designation',
            valueType: 'select',
            search: has('designation'),
            request: ({ keyWords }) => choices('designation', keyWords),
          },
          {
            title: '入职日期',
            dataIndex: 'date_of_joining',
            valueType: 'date',
            search: false,
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: states,
            search: has('status'),
          },
          {
            title: '操作',
            valueType: 'option',
            width: 153,
            render: (_, row) => [
              <Button
                key="edit"
                type="link"
                disabled={busy}
                onClick={() => openEditor(row)}
              >
                {listing?.can_edit ? '编辑' : '查看'}
              </Button>,
              listing?.can_status && (
                <Button
                  key="status"
                  type="link"
                  disabled={busy}
                  onClick={() => openStatus(row.name)}
                >
                  变更状态
                </Button>
              ),
            ],
          },
        ]}
        toolBarRender={() =>
          listing?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={busy}
                  onClick={() => openEditor()}
                >
                  新增员工
                </Button>,
              ]
            : []
        }
      />
      <DrawerForm<Employee>
        name="employee-directory-editor"
        form={form}
        open={open}
        dateFormatter="string"
        title={
          entry
            ? `员工资料 · ${entry.doc.employee_name || entry.doc.name}`
            : '新增员工'
        }
        onOpenChange={(value) => {
          if (!value) close();
        }}
        drawerProps={{
          size: 'large',
          destroyOnHidden: true,
          closable: !busy,
          keyboard: !busy,
          mask: { closable: !busy },
          onClose: close,
        }}
        onValuesChange={(changed) => {
          dirty.current = true;
          setError(undefined);
          if ('company' in changed) {
            form.setFieldValue('department', undefined);
            form.setFieldValue('reports_to', undefined);
          }
        }}
        submitter={{
          searchConfig: { submitText: '保存' },
          render: (_, buttons) => [
            <Button key="close" disabled={busy} onClick={close}>
              关闭
            </Button>,
            ...(editableRecord ? [buttons[1]] : []),
          ],
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setBusy(true);
          try {
            const changes = Object.fromEntries(
              editable
                .filter(
                  (key) =>
                    writable(key) &&
                    (!entry || (values[key] || '') !== (entry.doc[key] || '')),
                )
                .map((key) => [key, values[key] || '']),
            );
            await post('save', {
              name: entry?.doc.name,
              modified: entry?.doc.modified,
              values: changes,
            });
            dirty.current = false;
            setOpen(false);
            table.current?.reload();
            message.success('员工档案已保存');
            return true;
          } catch (reason) {
            setError(errorMessage(reason));
            return false;
          } finally {
            working.current = false;
            setBusy(false);
          }
        }}
      >
        {error && <Alert type="error" showIcon title={error} />}
        <Tabs
          key={entry?.doc.name || 'new'}
          items={[
            {
              key: 'basic',
              label: '基本资料',
              children: (
                <>
                  {has('first_name') && (
                    <ProFormText
                      name="first_name"
                      label={
                        entry?.doc.last_name || entry?.doc.middle_name
                          ? '名字'
                          : '姓名'
                      }
                      readonly={!writable('first_name')}
                      rules={required}
                    />
                  )}
                  {entry?.doc.middle_name && (
                    <ProFormText
                      name="middle_name"
                      label="中间名"
                      readonly={!writable('middle_name')}
                    />
                  )}
                  {entry?.doc.last_name && (
                    <ProFormText
                      name="last_name"
                      label="姓氏"
                      readonly={!writable('last_name')}
                    />
                  )}
                  {has('gender') && (
                    <ProFormSelect
                      name="gender"
                      label="性别"
                      readonly={!writable('gender')}
                      rules={required}
                      request={({ keyWords }) => choices('gender', keyWords)}
                    />
                  )}
                  {has('date_of_birth') && (
                    <ProFormDatePicker
                      name="date_of_birth"
                      label="出生日期"
                      readonly={!writable('date_of_birth')}
                      rules={required}
                    />
                  )}
                  {has('employee_number') && (
                    <ProFormText
                      name="employee_number"
                      label="工号"
                      readonly={!writable('employee_number')}
                    />
                  )}
                </>
              ),
            },
            {
              key: 'appointment',
              label: '任职信息',
              forceRender: true,
              children: (
                <>
                  {has('company') && (
                    <ProFormSelect
                      name="company"
                      label="公司"
                      readonly={Boolean(entry) || !writable('company')}
                      rules={required}
                      request={({ keyWords }) => choices('company', keyWords)}
                    />
                  )}
                  {has('department') && (
                    <ProFormSelect
                      name="department"
                      label="组织部门"
                      readonly={!writable('department')}
                      params={{ company }}
                      request={({ keyWords, company: selected }) =>
                        selected
                          ? choices('department', keyWords, selected)
                          : Promise.resolve([])
                      }
                      fieldProps={{ disabled: !company }}
                    />
                  )}
                  {has('designation') && (
                    <ProFormSelect
                      name="designation"
                      label="岗位"
                      readonly={!writable('designation')}
                      request={({ keyWords }) =>
                        choices('designation', keyWords)
                      }
                    />
                  )}
                  {has('reports_to') && (
                    <ProFormSelect
                      name="reports_to"
                      label="直属上级"
                      readonly={!writable('reports_to')}
                      params={{ company, current: entry?.doc.name }}
                      request={({ keyWords, company: selected, current }) =>
                        choices('reports_to', keyWords, selected, current)
                      }
                      fieldProps={{
                        showSearch: { filterOption: false },
                        disabled: !company,
                      }}
                    />
                  )}
                  {has('date_of_joining') && (
                    <ProFormDatePicker
                      name="date_of_joining"
                      label="入职日期"
                      readonly={!writable('date_of_joining')}
                      rules={required}
                    />
                  )}
                </>
              ),
            },
            ...(entry
              ? [
                  {
                    key: 'links',
                    label: '账号与医务人员',
                    children: (
                      <Descriptions
                        column={1}
                        items={[
                          {
                            key: 'account',
                            label: '登录账号',
                            children: entry.account ? (
                              userRoute ? (
                                <Link to={userRoute}>{entry.account.name}</Link>
                              ) : (
                                entry.account.name
                              )
                            ) : (
                              '暂无可查看的账号'
                            ),
                          },
                          {
                            key: 'practitioner',
                            label: '医务人员档案',
                            children: entry.practitioners?.length ? (
                              <Space wrap>
                                {entry.practitioners.map((person) =>
                                  practitionerRoute ? (
                                    <Link
                                      key={person.name}
                                      to={practitionerRoute}
                                    >
                                      {person.practitioner_name || person.name}
                                    </Link>
                                  ) : (
                                    <span key={person.name}>
                                      {person.practitioner_name || person.name}
                                    </span>
                                  ),
                                )}
                              </Space>
                            ) : (
                              '暂无可查看的医务人员档案'
                            ),
                          },
                          ...(entry.doc.relieving_date
                            ? [
                                {
                                  key: 'relieving',
                                  label: '离职日期',
                                  children: entry.doc.relieving_date,
                                },
                              ]
                            : []),
                        ]}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </DrawerForm>
      <ModalForm<StatusValues>
        name="employee-directory-status"
        form={statusForm}
        title="变更员工状态"
        open={Boolean(impact)}
        dateFormatter="string"
        onOpenChange={(value) => {
          if (!value && !busy) setImpact(undefined);
        }}
        modalProps={{
          destroyOnHidden: true,
          closable: !busy,
          keyboard: !busy,
          mask: { closable: !busy },
        }}
        submitter={
          impact?.can_status
            ? { searchConfig: { submitText: '确认变更' } }
            : false
        }
        onFinish={async (values) => {
          if (!impact?.can_status || working.current) return false;
          working.current = true;
          setBusy(true);
          try {
            await post('set_status', {
              name: impact.name,
              modified: impact.modified,
              ...values,
              account_modified: impact.account?.modified,
              confirmed: true,
            });
            setImpact(undefined);
            table.current?.reload();
            message.success('员工状态已更新');
            return true;
          } catch (reason) {
            setStatusError(errorMessage(reason));
            return false;
          } finally {
            working.current = false;
            setBusy(false);
          }
        }}
      >
        {statusError && <Alert type="error" showIcon title={statusError} />}
        {impact && (
          <Space orientation="vertical">
            <Descriptions
              column={1}
              items={[
                {
                  key: 'state',
                  label: '当前状态',
                  children: states[impact.status].text,
                },
                {
                  key: 'account',
                  label: '关联账号',
                  children:
                    impact.account?.name ||
                    (impact.has_account ? '当前账号无权查看' : '未关联'),
                },
                {
                  key: 'person',
                  label: '可见医务人员',
                  children:
                    impact.practitioners
                      ?.map((person) => person.practitioner_name || person.name)
                      .join('、') || '无',
                },
                ...Object.entries(impact.counts || {}).map(
                  ([label, count]) => ({
                    key: label,
                    label,
                    children: `${count} 条`,
                  }),
                ),
              ]}
            />
            {impact.has_account && (
              <Alert
                type="warning"
                showIcon
                title={
                  targetStatus
                    ? `关联账号将同步${targetStatus === 'Active' ? '启用' : '停用'}`
                    : '员工状态变更会同步启停关联账号'
                }
              />
            )}
            {!impact.can_status && (
              <Alert
                type="info"
                showIcon
                title="请由具备员工及关联账号维护权限的人员办理。"
              />
            )}
            {impact.can_status && (
              <ProFormSelect
                name="status"
                label="新状态"
                rules={required}
                options={Object.entries(states)
                  .filter(
                    ([value]) =>
                      value !== impact.status &&
                      !(value === 'Left' && impact.has_active_reports),
                  )
                  .map(([value, state]) => ({ value, label: state.text }))}
              />
            )}
            {impact.has_active_reports && (
              <Alert
                type="info"
                showIcon
                title="办理离职前，请为仍在职的直属下属调整上级。"
              />
            )}
            {targetStatus === 'Left' && (
              <ProFormDatePicker
                name="relieving_date"
                label="离职日期"
                rules={required}
              />
            )}
          </Space>
        )}
      </ModalForm>
    </>
  );
}
