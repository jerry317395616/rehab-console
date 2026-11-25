import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Grid, Tabs } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';
import MedicalMappings from './MedicalMappings';
import {
  createDepartment,
  type DepartmentContext,
  type DepartmentField,
  type DepartmentOptions,
  type DepartmentValues,
  departmentValues,
  getDepartment,
  getDepartmentOptions,
  previewDepartment,
  saveDepartment,
  searchDepartmentCompanies,
  searchDepartmentParents,
} from './service';

export type DepartmentEditor =
  | { kind: 'create'; company?: string; parent?: string }
  | { kind: 'view' | 'edit'; department: string };
export default function DepartmentEditorDrawer({
  editor,
  onClose,
  onSaved,
}: {
  editor?: DepartmentEditor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<DepartmentValues>();
  const company = Form.useWatch('company', form);
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<DepartmentOptions>();
  const [context, setContext] = useState<DepartmentContext>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('basic');
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const working = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    let active = true;
    setOptions(undefined);
    setContext(undefined);
    setError(undefined);
    setLoading(Boolean(editor));
    dirty.current = false;
    setTab('basic');
    form.resetFields();
    if (!editor) return;
    const task =
      editor.kind === 'create'
        ? getDepartmentOptions().then((value) => {
            if (!active) return;
            setOptions(value);
            form.setFieldsValue({
              company: editor.company,
              parent_department: editor.parent,
              is_group: false,
              disabled: false,
            });
          })
        : getDepartment(editor.department).then((value) => {
            if (!active) return;
            setContext(value);
            form.setFieldsValue({
              ...value.department,
              is_group: Boolean(value.department.is_group),
              disabled: Boolean(value.department.disabled),
            });
          });
    task
      .catch((reason) => {
        if (active)
          setError(creationError(reason, '无法读取部门资料，请重试。').message);
        if (statusOf(reason) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editor, attempt, form]);
  const creating = editor?.kind === 'create';
  const canSave = Boolean(
    creating
      ? options?.can_create
      : editor?.kind === 'edit' && context?.can_edit,
  );
  const fields = creating
    ? options?.create_fields || []
    : context?.write_fields || [];
  const visible = new Set<DepartmentField>([
    ...(options?.create_fields || []),
    ...(context?.read_fields || []),
  ]);
  const allowed = (field: DepartmentField) => canSave && fields.includes(field);
  function close() {
    if (working.current) return;
    if (canSave && dirty.current)
      modal.confirm({
        title: '放弃尚未保存的部门资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  return (
    <DrawerForm<DepartmentValues>
      name="department-editor"
      title={
        creating
          ? '新增部门'
          : editor?.kind === 'edit'
            ? '编辑部门'
            : '部门详情'
      }
      open={Boolean(editor)}
      form={form}
      width={screens.md ? 600 : '100%'}
      loading={loading}
      onValuesChange={(changed) => {
        dirty.current = true;
        setError(undefined);
        if (creating && Object.hasOwn(changed, 'company'))
          form.setFieldValue('parent_department', undefined);
      }}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      drawerProps={{
        destroyOnHidden: true,
        closable: !saving,
        keyboard: !saving,
        mask: { closable: !saving },
      }}
      submitter={
        canSave && tab === 'basic'
          ? {
              searchConfig: {
                submitText: creating ? '创建部门' : '保存',
                resetText: '取消',
              },
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
        if (!editor || !canSave || tab !== 'basic' || working.current)
          return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const data = departmentValues(values, fields);
          if (editor.kind === 'create') await createDepartment(data);
          else if (context) {
            const preview = await previewDepartment(
              editor.department,
              context.department.modified,
              data,
            );
            if (preview.reasons.length) {
              const confirmed = await new Promise<boolean>((resolve) => {
                modal.confirm({
                  title: '确认部门变更',
                  content: (
                    <div>
                      {preview.reasons.map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))}
                    </div>
                  ),
                  okText: '确认保存',
                  cancelText: '继续编辑',
                  onOk: () => {
                    resolve(true);
                  },
                  onCancel: () => {
                    resolve(false);
                  },
                });
              });
              if (!confirmed) return false;
            }
            await saveDepartment(
              editor.department,
              context.department.modified,
              data,
              preview.token,
            );
          } else return false;
          void message.success(creating ? '部门已创建。' : '部门资料已保存。');
          dirty.current = false;
          onSaved();
          onClose();
          return true;
        } catch (reason) {
          setError(
            creationError(reason, '保存失败，请检查资料后重试。').message,
          );
          if (statusOf(reason) === 401)
            window.dispatchEvent(new Event('rehab:session-expired'));
          return false;
        } finally {
          working.current = false;
          setSaving(false);
        }
      }}
    >
      <Form.Item key="feedback" hidden={!error}>
        {error && (
          <Alert
            showIcon
            type="error"
            title={error}
            action={
              <Button
                size="small"
                disabled={saving}
                onClick={() => {
                  if (canSave && dirty.current)
                    modal.confirm({
                      title: '重新加载会丢弃当前编辑，是否继续？',
                      okText: '重新加载',
                      cancelText: '继续编辑',
                      onOk: () => setAttempt((value) => value + 1),
                    });
                  else setAttempt((value) => value + 1);
                }}
              >
                重新加载
              </Button>
            }
          />
        )}
      </Form.Item>
      {(options || context) && (
        <Tabs
          activeKey={tab}
          onChange={(next) => {
            if (dirty.current && canSave) {
              message.info('请先保存或取消部门资料修改，再维护医疗科室关联。');
              return;
            }
            setTab(next);
          }}
          items={[
            {
              key: 'basic',
              label: '部门资料',
              forceRender: true,
              children: (
                <React.Fragment key="department-fields">
                  {context?.is_root && (
                    <Alert
                      type="info"
                      showIcon
                      title="系统公共根节点仅供查看。"
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  {!creating && (
                    <ProFormText
                      name="name"
                      label="部门编号"
                      disabled
                      extra="修改部门名称请使用列表中的“重命名”操作。"
                    />
                  )}
                  {visible.has('department_name') && (
                    <ProFormText
                      name="department_name"
                      label="部门名称"
                      disabled={!creating || !allowed('department_name')}
                      rules={
                        creating
                          ? [
                              {
                                required: true,
                                whitespace: true,
                                message: '请输入部门名称',
                              },
                            ]
                          : []
                      }
                      fieldProps={{ maxLength: 140 }}
                    />
                  )}
                  {visible.has('company') && (
                    <ProFormSelect
                      name="company"
                      label="所属公司"
                      disabled={!creating || !allowed('company')}
                      rules={[{ required: true, message: '请选择公司' }]}
                      showSearch
                      debounceTime={300}
                      request={async ({ keyWords }) =>
                        searchDepartmentCompanies(
                          keyWords || form.getFieldValue('company') || '',
                        )
                      }
                      fieldProps={{ filterOption: false, allowClear: false }}
                      extra="公司创建后保持不变。"
                    />
                  )}
                  {visible.has('parent_department') && (
                    <ProFormSelect
                      name="parent_department"
                      label="上级部门"
                      disabled={!allowed('parent_department') || !company}
                      params={{ company }}
                      showSearch
                      debounceTime={300}
                      request={async ({ keyWords }) =>
                        company
                          ? searchDepartmentParents(
                              company,
                              keyWords || '',
                              editor && editor.kind !== 'create'
                                ? editor.department
                                : undefined,
                            )
                          : []
                      }
                      fieldProps={{ filterOption: false, allowClear: true }}
                      extra="仅可选择同公司启用的分组部门；留空放在公共根节点下。"
                    />
                  )}
                  {visible.has('is_group') && (
                    <ProFormSwitch
                      name="is_group"
                      label="分组部门"
                      disabled={!allowed('is_group')}
                      extra="分组部门可以添加下级；存在下级时不能改为普通部门。"
                    />
                  )}
                  {visible.has('disabled') && (
                    <ProFormSwitch
                      name="disabled"
                      label="停用"
                      disabled={!allowed('disabled')}
                      extra="只修改当前部门状态，下级部门分别管理。"
                    />
                  )}
                </React.Fragment>
              ),
            },
            ...(!creating &&
            context?.department.company &&
            !context.is_root &&
            editor
              ? [
                  {
                    key: 'mappings',
                    label: '关联医疗科室',
                    children: (
                      <MedicalMappings
                        key={editor.department}
                        department={editor.department}
                      />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </DrawerForm>
  );
}
