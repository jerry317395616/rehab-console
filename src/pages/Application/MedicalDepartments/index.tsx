import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Tabs } from 'antd';
import { useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import { get } from '../ChargeCatalog/service';
import MedicalMappings from '../DepartmentList/MedicalMappings';
import {
  type Detail,
  type Listing,
  load,
  type Medical,
  type Preview,
  preview,
  type Rights,
  run,
  save,
} from './service';

export default function MedicalDepartments() {
  const { message, modal } = App.useApp();
  const action = useRef<ActionType>(undefined);
  const [rights, setRights] = useState<Rights>();
  const [entry, setEntry] = useState<Detail>();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('basic');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const dirty = useRef(false);
  const [form] = Form.useForm();
  const [renameForm] = Form.useForm();
  const [renaming, setRenaming] = useState<Preview>();
  const active = entry || rights;
  const writable = entry ? entry.can_edit : rights?.can_create;
  const fields = active?.write_fields || [];
  const readable = active?.read_fields || [];

  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的医疗科室资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setOpen(false),
      });
    else setOpen(false);
  }
  async function edit(row?: Medical) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const result = row ? await load(row.name) : undefined;
      setEntry(result);
      form.resetFields();
      form.setFieldsValue(result?.doc || {});
      setTab('basic');
      dirty.current = false;
      setError(undefined);
      setOpen(true);
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function operate(
    row: Medical,
    operation: 'state' | 'rename' | 'delete',
  ) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const data = await preview(row.name, operation);
      if (operation === 'rename') {
        renameForm.resetFields();
        setRenaming(data);
      } else {
        modal.confirm({
          title:
            operation === 'delete'
              ? `删除医疗科室“${row.name}”？`
              : `${data.disabled ? '全局启用' : '全局停用'}医疗科室“${row.name}”？`,
          content: data.message,
          okText: '确认',
          cancelText: '取消',
          okButtonProps: { danger: operation === 'delete' || !data.disabled },
          onOk: async () => {
            if (working.current) return;
            working.current = true;
            setBusy(true);
            try {
              await run({
                name: data.name,
                modified: data.modified,
                action: operation,
                disabled: data.disabled ? 0 : 1,
                confirmed: true,
              });
              message.success('医疗科室已更新');
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
      }
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      {error && !open && <Alert showIcon type="error" title={error} />}
      <ProTable<Medical>
        actionRef={action}
        rowKey="name"
        scroll={{ x: 850 }}
        pagination={{ defaultPageSize: 20 }}
        request={async ({
          current,
          pageSize,
          name,
          patient_care_type,
          rehab_disabled,
        }) => {
          const result = await get<Listing>(
            'medical_departments',
            'get_entries',
            {
              current,
              page_size: pageSize,
              keyword: name,
              patient_care_type,
              disabled: rehab_disabled,
            },
          );
          setRights(result);
          setError(undefined);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        columns={[
          { title: '科室名称', dataIndex: 'name' },
          {
            title: '照护类型',
            dataIndex: 'patient_care_type',
            hideInTable: Boolean(
              rights && !rights.read_fields.includes('patient_care_type'),
            ),
            search: !(
              rights && !rights.read_fields.includes('patient_care_type')
            ),
          },
          {
            title: '全局状态',
            dataIndex: 'rehab_disabled',
            valueEnum: {
              0: { text: '启用', status: 'Success' },
              1: { text: '停用', status: 'Default' },
            },
            hideInTable: Boolean(
              rights && !rights.read_fields.includes('rehab_disabled'),
            ),
            search: !(rights && !rights.read_fields.includes('rehab_disabled')),
          },
          {
            title: '更新时间',
            dataIndex: 'modified',
            valueType: 'dateTime',
            search: false,
          },
          {
            title: '操作',
            valueType: 'option',
            width: 285,
            render: (_, row) => [
              <Button
                key="edit"
                type="link"
                disabled={busy}
                onClick={() => edit(row)}
              >
                {row.can_edit ? '编辑' : '查看'}
              </Button>,
              row.can_state && (
                <Button
                  key="state"
                  type="link"
                  disabled={busy}
                  onClick={() => operate(row, 'state')}
                >
                  {row.rehab_disabled ? '全局启用' : '全局停用'}
                </Button>
              ),
              row.can_edit && (
                <Button
                  key="rename"
                  type="link"
                  disabled={busy}
                  onClick={() => operate(row, 'rename')}
                >
                  改名
                </Button>
              ),
              row.can_delete && (
                <Button
                  key="delete"
                  type="link"
                  danger
                  disabled={busy}
                  onClick={() => operate(row, 'delete')}
                >
                  删除
                </Button>
              ),
            ],
          },
        ]}
        toolBarRender={() =>
          rights?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={busy}
                  onClick={() => edit()}
                >
                  新增医疗科室
                </Button>,
              ]
            : []
        }
      />
      <DrawerForm
        name="medical-department-editor"
        form={form}
        title={entry ? `医疗科室 · ${entry.doc.name}` : '新增医疗科室'}
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        drawerProps={{
          destroyOnHidden: true,
          resizable: false,
          closable: !busy,
          keyboard: !busy,
          mask: { closable: !busy },
          onClose: close,
          size: 'large',
        }}
        onValuesChange={() => {
          dirty.current = true;
          setError(undefined);
        }}
        submitter={{
          searchConfig: { submitText: '保存', resetText: '关闭' },
          render: (_, buttons) => [
            <Button key="close" disabled={busy} onClick={close}>
              关闭
            </Button>,
            ...(tab === 'basic' && writable ? [buttons[1]] : []),
          ],
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setBusy(true);
          try {
            const allowed = entry
              ? ['patient_care_type']
              : ['department', 'patient_care_type'];
            const data = Object.fromEntries(
              allowed
                .filter((key) => fields.includes(key))
                .map((key) => [key, values[key] ?? '']),
            );
            await save({
              name: entry?.doc.name,
              modified: entry?.doc.modified,
              values: data,
            });
            dirty.current = false;
            setOpen(false);
            action.current?.reload();
            message.success('医疗科室已保存');
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
        {error && <Alert showIcon type="error" title={error} />}
        <Tabs
          activeKey={tab}
          onChange={(key) => {
            if (dirty.current) {
              message.warning('请先保存或关闭未保存的基础资料。');
              return;
            }
            setTab(key);
          }}
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <>
                  <ProFormText
                    name="department"
                    label="科室名称"
                    readonly={
                      Boolean(entry) ||
                      !writable ||
                      !fields.includes('department')
                    }
                    rules={[
                      {
                        required: true,
                        whitespace: true,
                        message: '请输入科室名称',
                      },
                      { max: 140 },
                    ]}
                    extra={
                      entry
                        ? '科室名称同时是记录编号。未被引用时，可从列表执行改名。'
                        : undefined
                    }
                  />
                  {readable.includes('patient_care_type') && (
                    <ProFormSelect
                      name="patient_care_type"
                      label="照护类型"
                      readonly={
                        !writable || !fields.includes('patient_care_type')
                      }
                      request={({ keyWords }) =>
                        get('medical_departments', 'care_options', {
                          keyword: keyWords || '',
                        })
                      }
                      fieldProps={{ showSearch: { filterOption: false } }}
                    />
                  )}
                  {entry && readable.includes('rehab_disabled') && (
                    <ProFormText
                      label="全局状态"
                      readonly
                      fieldProps={{
                        value: entry.doc.rehab_disabled ? '停用' : '启用',
                      }}
                    />
                  )}
                </>
              ),
            },
            ...(entry
              ? [
                  {
                    key: 'relations',
                    label: '关联组织部门',
                    children: (
                      <MedicalMappings
                        key={entry.doc.name}
                        medicalDepartment={entry.doc.name}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      </DrawerForm>
      <ModalForm
        name="medical-department-rename"
        form={renameForm}
        title="医疗科室改名"
        open={Boolean(renaming)}
        onOpenChange={(value) => {
          if (!value && !busy) setRenaming(undefined);
        }}
        modalProps={{
          destroyOnHidden: true,
          closable: !busy,
          keyboard: !busy,
          mask: { closable: !busy },
        }}
        onFinish={async (values) => {
          if (!renaming || working.current) return false;
          working.current = true;
          setBusy(true);
          try {
            await run({
              name: renaming.name,
              modified: renaming.modified,
              action: 'rename',
              new_name: values.new_name,
              confirmed: true,
            });
            setRenaming(undefined);
            action.current?.reload();
            message.success('科室已改名');
            return true;
          } catch (reason) {
            message.error(errorMessage(reason));
            return false;
          } finally {
            working.current = false;
            setBusy(false);
          }
        }}
      >
        <Alert
          showIcon
          type="info"
          title={renaming?.name}
          description={renaming?.message}
        />
        <ProFormText
          name="new_name"
          label="新名称"
          rules={[
            { required: true, whitespace: true, message: '请输入新名称' },
            { max: 140 },
          ]}
        />
      </ModalForm>
    </>
  );
}
