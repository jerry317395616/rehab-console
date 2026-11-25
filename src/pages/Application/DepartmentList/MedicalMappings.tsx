import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  ModalForm,
  ProFormSelect,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form } from 'antd';
import { useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import { get, post } from '../ChargeCatalog/service';
import type { MedicalChoice } from './medicalService';

type Mapping = {
  name: string;
  modified: string;
  company: string;
  department: string;
  medical_department: string;
  disabled: number;
  can_edit: boolean;
  can_enable: boolean;
};
type MappingResult = {
  data: Mapping[];
  total: number;
  success: boolean;
  company: string;
  can_create: boolean;
  organization_active: boolean;
  company_configured: boolean;
};
export default function MedicalMappings({
  department,
  medicalDepartment,
}: {
  department?: string;
  medicalDepartment?: string;
}) {
  const action = useRef<ActionType>(undefined);
  const [form] = Form.useForm();
  const [context, setContext] = useState<MappingResult>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const dirty = useRef(false);
  const { message, modal } = App.useApp();
  function close() {
    if (working.current) return;
    if (dirty.current)
      modal.confirm({
        title: '放弃尚未保存的科室对应关系？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setOpen(false),
      });
    else setOpen(false);
  }
  return (
    <>
      {error && !open && <Alert showIcon type="error" title={error} />}
      {context && (
        <Alert
          showIcon
          type="info"
          title={
            medicalDepartment
              ? '对应关系按机构生效。建立某机构首条关系后，新的执行科室选择按启用关系筛选。'
              : context.company_configured
                ? '本机构新的执行科室选择按启用的对应关系筛选。停用关系保留历史，不改写已有资料。'
                : '建立首条对应关系后，本机构新的执行科室选择将按启用关系筛选。历史资料不会自动匹配或改写。'
          }
          description={
            medicalDepartment
              ? '停用对应关系只影响该机构；医疗科室全局停用则影响所有机构。'
              : `所属机构：${context.company}${context.organization_active ? '' : '。当前部门已停用，仅可查看及停用已有关系。'}`
          }
        />
      )}
      <ProTable<Mapping>
        actionRef={action}
        rowKey="name"
        search={false}
        options={false}
        scroll={{ x: 550 }}
        pagination={{ defaultPageSize: 10 }}
        request={async ({ current, pageSize }) => {
          const result = await get<MappingResult>(
            'department_mapping',
            'get_mappings',
            {
              department,
              medical_department: medicalDepartment,
              current,
              page_size: pageSize,
            },
          );
          setContext(result);
          setError(undefined);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        columns={[
          ...(medicalDepartment
            ? [
                { title: '所属机构', dataIndex: 'company' },
                { title: '组织部门', dataIndex: 'department' },
              ]
            : [{ title: '医疗科室', dataIndex: 'medical_department' }]),
          {
            title: '状态',
            dataIndex: 'disabled',
            width: 85,
            valueEnum: { 0: '启用', 1: '停用' },
          },
          {
            title: '更新时间',
            dataIndex: 'modified',
            valueType: 'dateTime',
            width: 160,
          },
          {
            title: '操作',
            valueType: 'option',
            width: 90,
            render: (_, row) =>
              row.can_edit && (
                <Button
                  type="link"
                  disabled={saving || Boolean(row.disabled && !row.can_enable)}
                  onClick={() =>
                    modal.confirm({
                      title: `${row.disabled ? '启用' : '停用'}医疗科室对应关系？`,
                      content: row.medical_department,
                      okText: '确认',
                      cancelText: '取消',
                      onOk: async () => {
                        if (working.current) return;
                        working.current = true;
                        setSaving(true);
                        try {
                          await post('department_mapping', 'save_mapping', {
                            name: row.name,
                            modified: row.modified,
                            department: row.department,
                            disabled: row.disabled ? 0 : 1,
                          });
                          action.current?.reload();
                          message.success('科室对应关系已更新');
                        } catch (reason) {
                          message.error(errorMessage(reason));
                          throw reason;
                        } finally {
                          working.current = false;
                          setSaving(false);
                        }
                      },
                    })
                  }
                >
                  {row.disabled ? '启用' : '停用'}
                </Button>
              ),
          },
        ]}
        toolBarRender={() =>
          context?.can_create
            ? [
                <Button
                  key="add"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    form.resetFields();
                    dirty.current = false;
                    setError(undefined);
                    setOpen(true);
                  }}
                >
                  {medicalDepartment ? '关联组织部门' : '关联医疗科室'}
                </Button>,
              ]
            : []
        }
      />
      <ModalForm
        name="department-medical-mapping"
        form={form}
        title={medicalDepartment ? '关联组织部门' : '关联医疗科室'}
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
          onCancel: close,
        }}
        onValuesChange={() => {
          dirty.current = true;
          setError(undefined);
        }}
        submitter={{
          searchConfig: { submitText: '保存对应关系', resetText: '取消' },
          render: (_, buttons) => [
            <Button key="cancel" disabled={saving} onClick={close}>
              取消
            </Button>,
            buttons[1],
          ],
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setSaving(true);
          try {
            await post('department_mapping', 'save_mapping', {
              department: department || values.department,
              medical_department:
                medicalDepartment || values.medical_department,
              disabled: 0,
            });
            dirty.current = false;
            setOpen(false);
            action.current?.reload();
            message.success('科室对应关系已保存');
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
        {error && <Alert showIcon type="error" title={error} />}
        <ProFormSelect
          name={medicalDepartment ? 'department' : 'medical_department'}
          label={medicalDepartment ? '组织部门' : '医疗科室'}
          params={{ department, medicalDepartment }}
          request={({ keyWords }) =>
            get<MedicalChoice[]>(
              'department_mapping',
              medicalDepartment
                ? 'search_organizations'
                : 'search_medical_departments',
              {
                department,
                medical_department: medicalDepartment,
                keyword: keyWords || '',
              },
            )
          }
          fieldProps={{ showSearch: { filterOption: false } }}
          rules={[{ required: true, message: '请选择关联资料' }]}
          extra={
            medicalDepartment
              ? '仅可选择有维护权限、所属机构可见且启用的组织部门。'
              : '关联已有的医疗科室资料，不会按组织部门名称自动创建医疗科室。'
          }
        />
      </ModalForm>
    </>
  );
}
