import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Alert, App, Button, Descriptions, Form, Space, Tabs } from 'antd';
import { useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import {
  type Counts,
  detail,
  list,
  options,
  type Person,
  preview,
  type Rights,
  relations,
  save,
  setStatus,
} from './service';

const kinds = {
  Doctor: '医生',
  Therapist: '治疗师',
  Nurse: '护士',
  Other: '其他医务人员',
};
const states = {
  Active: { text: '启用', status: 'Success' },
  Disabled: { text: '停用', status: 'Default' },
};
const companyField = 'rehab_staff_company';
const kindField = 'rehab_staff_kind';
const editable = [
  'first_name',
  'last_name',
  kindField,
  companyField,
  'department',
  'rehab_staff_post',
  'employee',
  'user_id',
] as const;
type Entry = Awaited<ReturnType<typeof detail>>;

export default function MedicalStaff({
  links,
}: {
  links: Record<string, string>;
}) {
  const { message, modal } = App.useApp();
  const action = useRef<ActionType>(undefined);
  const working = useRef(false);
  const dirty = useRef(false);
  const [form] = Form.useForm<Person>();
  const company = Form.useWatch(companyField, form);
  const [rights, setRights] = useState<Rights>();
  const [entry, setEntry] = useState<Entry>();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<Counts>();
  const [relationsError, setRelationsError] = useState<string>();

  const base = entry || rights;
  const canEdit = entry ? entry.can_edit : rights?.can_create;
  const has = (field: string) => Boolean(base?.read_fields.includes(field));
  const canWrite = (field: string) =>
    Boolean(canEdit && has(field) && base?.write_fields.includes(field));

  function close() {
    if (working.current) return;
    if (dirty.current) {
      modal.confirm({
        title: '放弃尚未保存的人员资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setOpen(false),
      });
    } else setOpen(false);
  }
  async function openEditor(row?: Person) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const next = row ? await detail(row.name) : undefined;
      setEntry(next);
      form.resetFields();
      form.setFieldsValue(next?.doc || {});
      setError(undefined);
      setCounts(undefined);
      setRelationsError(undefined);
      dirty.current = false;
      setOpen(true);
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function onStatus(row: Person) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const result = await preview(row.name);
      const stopping = result.status === 'Active';
      const impact = Object.entries(result.counts).filter(
        ([label]) => label === '未来班次' || label === '未完成治疗任务',
      );
      modal.confirm({
        title: `${stopping ? '停用' : '启用'}医务人员「${row.practitioner_name || row.name}」？`,
        content: stopping ? (
          <Space orientation="vertical">
            <span>
              停用后退出新的接诊、排班及治疗分派候选。已有班次和任务请在相应页面核对。
            </span>
            {impact.map(([label, count]) => (
              <span key={label}>
                {label} {count} 条（当前可见）
              </span>
            ))}
          </Space>
        ) : (
          '启用后按人员类别、账号权限及机构范围参加新业务。'
        ),
        okText: '确认',
        cancelText: '取消',
        okButtonProps: { danger: stopping },
        onOk: async () => {
          if (working.current) return;
          working.current = true;
          setBusy(true);
          try {
            await setStatus({
              name: result.name,
              modified: result.modified,
              status: stopping ? 'Disabled' : 'Active',
              confirmed: true,
            });
            message.success('医务人员状态已更新');
            action.current?.reload();
          } catch (reason) {
            message.error(errorMessage(reason));
            throw reason;
          } finally {
            working.current = false;
            setBusy(false);
          }
        },
      });
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
      <ProTable<Person>
        actionRef={action}
        rowKey="name"
        scroll={{ x: 1040 }}
        pagination={{ defaultPageSize: 20 }}
        request={async ({
          current,
          pageSize,
          name,
          employee_number,
          rehab_staff_company,
          department,
          rehab_staff_kind,
          status,
        }) => {
          const result = await list({
            current,
            page_size: pageSize,
            keyword: name,
            employee_number,
            company: rehab_staff_company,
            department,
            kind: rehab_staff_kind,
            status,
          });
          setRights(result);
          setError(undefined);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        columns={[
          {
            title: '姓名',
            dataIndex: 'name',
            render: (_, row) => row.practitioner_name || row.name,
          },
          {
            title: '工号',
            dataIndex: 'employee_number',
            search: Boolean(rights?.can_search_code),
          },
          {
            title: '机构',
            dataIndex: companyField,
            valueType: 'select',
            request: ({ keyWords }) => options(companyField, keyWords),
            search: has(companyField),
            render: (_, row) =>
              row.employee_company || row.rehab_staff_company || '待补全',
          },
          {
            title: '医疗科室',
            dataIndex: 'department',
            valueType: 'select',
            request: ({ keyWords }) => options('department', keyWords),
            search: has('department'),
          },
          {
            title: '人员类别',
            dataIndex: kindField,
            valueEnum: kinds,
            search: has(kindField),
            renderText: (value) => value || '待分类',
          },
          {
            title: '岗位',
            dataIndex: 'designation',
            search: false,
            render: (_, row) => row.designation || row.rehab_staff_post || '—',
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
            width: 156,
            render: (_, row) => [
              <Button
                key="edit"
                type="link"
                disabled={busy}
                onClick={() => openEditor(row)}
              >
                {row.can_edit ? '编辑' : '查看'}
              </Button>,
              row.can_edit &&
                row.status &&
                rights?.write_fields.includes('status') && (
                  <Button
                    key="status"
                    type="link"
                    disabled={busy}
                    onClick={() => onStatus(row)}
                  >
                    {row.status === 'Active' ? '停用' : '启用'}
                  </Button>
                ),
            ],
          },
        ]}
        toolBarRender={() =>
          rights?.can_create
            ? [
                <Button
                  key="new"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={busy}
                  onClick={() => openEditor()}
                >
                  新增医务人员
                </Button>,
              ]
            : []
        }
      />
      <DrawerForm<Person>
        name="medical-staff-editor"
        form={form}
        title={
          entry
            ? `医务人员 · ${entry.doc.practitioner_name || entry.doc.name}`
            : '新增医务人员'
        }
        open={open}
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
        onValuesChange={(values) => {
          dirty.current = true;
          setError(undefined);
          if (companyField in values) {
            form.setFieldValue('department', undefined);
            if (!entry?.doc.employee) form.setFieldValue('employee', undefined);
          }
        }}
        submitter={{
          searchConfig: { submitText: '保存', resetText: '关闭' },
          render: (_, buttons) => [
            <Button key="close" disabled={busy} onClick={close}>
              关闭
            </Button>,
            ...(canEdit ? [buttons[1]] : []),
          ],
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setBusy(true);
          try {
            const data = Object.fromEntries(
              editable
                .filter(
                  (key) =>
                    canWrite(key) &&
                    (!entry || (values[key] || '') !== (entry.doc[key] || '')),
                )
                .map((key) => [key, values[key] || '']),
            );
            await save({
              name: entry?.doc.name,
              modified: entry?.doc.modified,
              values: data,
            });
            dirty.current = false;
            setOpen(false);
            action.current?.reload();
            message.success('医务人员档案已保存');
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
          onChange={async (key) => {
            if (key !== 'relations' || !entry || counts) return;
            setRelationsError(undefined);
            try {
              setCounts(await relations(entry.doc.name));
            } catch (reason) {
              setRelationsError(errorMessage(reason));
            }
          }}
          items={[
            {
              key: 'base',
              label: '基本资料',
              children: (
                <>
                  {has('first_name') && (
                    <ProFormText
                      label="姓名"
                      name="first_name"
                      readonly={!canWrite('first_name')}
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: '请输入姓名',
                        },
                      ]}
                    />
                  )}
                  {entry?.doc.last_name && (
                    <ProFormText
                      label="姓氏补充"
                      name="last_name"
                      readonly={!canWrite('last_name')}
                    />
                  )}
                  {has(kindField) && (
                    <ProFormSelect
                      label="人员类别"
                      name={kindField}
                      valueEnum={kinds}
                      readonly={!canWrite(kindField)}
                      rules={[{ required: true, message: '请选择人员类别' }]}
                    />
                  )}
                  {has(companyField) && (
                    <ProFormSelect
                      label="服务机构"
                      name={companyField}
                      request={({ keyWords }) =>
                        options(companyField, keyWords)
                      }
                      readonly={
                        !canWrite(companyField) ||
                        Boolean(
                          entry?.doc.employee && entry.doc.rehab_staff_company,
                        )
                      }
                      rules={[{ required: true, message: '请选择机构' }]}
                    />
                  )}
                  {has('department') && (
                    <ProFormSelect
                      label="医疗科室"
                      name="department"
                      params={{ company }}
                      request={({ keyWords, company: selected }) =>
                        options('department', keyWords, selected)
                      }
                      readonly={!canWrite('department')}
                      rules={[{ required: true, message: '请选择医疗科室' }]}
                    />
                  )}
                  {has('rehab_staff_post') && (
                    <ProFormText
                      label="院内岗位"
                      name="rehab_staff_post"
                      readonly={!canWrite('rehab_staff_post')}
                    />
                  )}
                </>
              ),
            },
            {
              key: 'identity',
              label: '账号与人事',
              forceRender: true,
              children: (
                <>
                  {has('user_id') && (
                    <ProFormSelect
                      name="user_id"
                      label="登录账号"
                      readonly={
                        !canWrite('user_id') ||
                        !base?.can_select_user ||
                        Boolean(entry?.doc.user_id)
                      }
                      request={({ keyWords }) => options('user_id', keyWords)}
                      fieldProps={{ showSearch: { filterOption: false } }}
                      extra="选择已有个人账号。角色和登录权限在用户管理维护。"
                    />
                  )}
                  {has('employee') && (
                    <ProFormSelect
                      name="employee"
                      label="人事档案"
                      readonly={
                        !canWrite('employee') ||
                        !base?.can_select_employee ||
                        Boolean(entry?.doc.employee)
                      }
                      params={{ company }}
                      request={({ keyWords, company: selected }) =>
                        options('employee', keyWords, selected)
                      }
                      fieldProps={{
                        showSearch: { filterOption: false },
                        disabled: !company && !entry?.doc.employee,
                      }}
                      extra="先选择服务机构，再选择该机构的在职员工。"
                    />
                  )}
                  {entry?.doc.employee && (
                    <Descriptions
                      column={1}
                      items={[
                        {
                          key: 'code',
                          label: '工号',
                          children: entry.doc.employee_number || '—',
                        },
                        {
                          key: 'org',
                          label: '组织部门',
                          children: entry.doc.organization_department || '—',
                        },
                        {
                          key: 'post',
                          label: '人事岗位',
                          children: entry.doc.designation || '—',
                        },
                      ]}
                    />
                  )}
                </>
              ),
            },
            ...(entry
              ? [
                  {
                    key: 'relations',
                    label: '业务关联',
                    children: (
                      <Space orientation="vertical">
                        {relationsError ? (
                          <Alert type="error" showIcon title={relationsError} />
                        ) : (
                          <Descriptions
                            column={1}
                            items={Object.entries(counts || {}).map(
                              ([label, count]) => ({
                                key: label,
                                label,
                                children: `${count} 条`,
                              }),
                            )}
                          />
                        )}
                        {counts && !Object.keys(counts).length && (
                          <Alert
                            type="info"
                            showIcon
                            title="暂无可查看的业务关联"
                          />
                        )}
                        <Space wrap>
                          {Object.entries(links).map(([label, route]) => (
                            <Link key={label} to={route}>
                              {label}
                            </Link>
                          ))}
                        </Space>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </DrawerForm>
    </>
  );
}
