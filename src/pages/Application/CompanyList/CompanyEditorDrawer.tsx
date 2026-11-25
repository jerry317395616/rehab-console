import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Grid } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';
import {
  type CompanyContext,
  type CompanyField,
  type CompanyOptions,
  type CompanyValues,
  companyValues,
  createCompany,
  getCompany,
  getCompanyOptions,
  saveCompany,
  searchCompanyOptions,
} from './service';

export type CompanyEditor =
  | { kind: 'create' }
  | { kind: 'view' | 'edit'; company: string };
export default function CompanyEditorDrawer({
  editor,
  onClose,
  onSaved,
}: {
  editor?: CompanyEditor;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm<CompanyValues>();
  const { message, modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<CompanyOptions>();
  const [context, setContext] = useState<CompanyContext>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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
    form.resetFields();
    if (!editor) return;
    const task =
      editor.kind === 'create'
        ? getCompanyOptions().then((value) => {
            if (!active) return;
            setOptions(value);
            form.setFieldsValue({
              ...value.defaults,
              is_group: Boolean(value.defaults.is_group),
            });
          })
        : getCompany(editor.company).then((value) => {
            if (!active) return;
            setContext(value);
            form.setFieldsValue({
              ...value.company,
              is_group: Boolean(value.company.is_group),
            });
          });
    task
      .catch((reason) => {
        if (active)
          setError(creationError(reason, '无法读取公司资料，请重试。').message);
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
  const visible = new Set<CompanyField>([
    ...(options?.create_fields || []),
    ...(context?.read_fields || []),
  ]);
  const allowed = (field: CompanyField) => canSave && fields.includes(field);
  const company =
    editor && editor.kind !== 'create' ? editor.company : undefined;
  function close() {
    if (working.current) return;
    if (canSave && dirty.current)
      modal.confirm({
        title: '放弃尚未保存的公司资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
    else onClose();
  }
  return (
    <DrawerForm<CompanyValues>
      name="company-editor"
      title={
        creating
          ? '新增公司'
          : editor?.kind === 'edit'
            ? '编辑公司'
            : '公司详情'
      }
      open={Boolean(editor)}
      form={form}
      width={screens.md ? 640 : '100%'}
      loading={loading}
      onValuesChange={() => {
        dirty.current = true;
        setError(undefined);
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
        canSave
          ? {
              searchConfig: {
                submitText: creating ? '创建公司' : '保存',
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
        if (!editor || !canSave || working.current) return false;
        working.current = true;
        setSaving(true);
        setError(undefined);
        try {
          const data = companyValues(values, fields);
          if (editor.kind === 'create') await createCompany(data);
          else if (context)
            await saveCompany(editor.company, context.company.modified, data);
          else return false;
          void message.success(creating ? '公司已创建。' : '公司资料已保存。');
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
        <React.Fragment key="company-fields">
          {creating && (
            <Alert
              type="info"
              showIcon
              title="创建公司时会按 ERPNext 原生规则初始化关联资料。"
              style={{ marginBottom: 16 }}
            />
          )}
          {visible.has('company_name') && (
            <ProFormText
              name="company_name"
              label="公司名称"
              disabled={!allowed('company_name')}
              rules={
                creating
                  ? [
                      {
                        required: true,
                        whitespace: true,
                        message: '请输入公司名称',
                      },
                    ]
                  : []
              }
              fieldProps={{ maxLength: 140 }}
            />
          )}
          {visible.has('abbr') && (
            <ProFormText
              name="abbr"
              label="公司简称"
              disabled={!allowed('abbr')}
              rules={
                creating
                  ? [
                      {
                        required: true,
                        whitespace: true,
                        message: '请输入公司简称',
                      },
                    ]
                  : []
              }
              fieldProps={{ maxLength: 140 }}
              extra={
                creating ? '用于关联资料的编号，创建后保持不变。' : undefined
              }
            />
          )}
          {visible.has('is_group') && (
            <ProFormSwitch
              name="is_group"
              label="集团公司"
              disabled={!allowed('is_group')}
            />
          )}
          {(['parent_company', 'country', 'default_currency'] as const)
            .filter((field) => visible.has(field))
            .map((field) => (
              <ProFormSelect
                key={field}
                name={field}
                label={
                  {
                    parent_company: '上级公司',
                    country: '国家/地区',
                    default_currency: '默认币种',
                  }[field]
                }
                disabled={!allowed(field)}
                rules={
                  field !== 'parent_company'
                    ? [{ required: true, message: '请选择此项' }]
                    : []
                }
                showSearch
                debounceTime={300}
                request={async ({ keyWords }) =>
                  searchCompanyOptions(
                    field,
                    keyWords || form.getFieldValue(field) || '',
                    company,
                  )
                }
                fieldProps={{
                  filterOption: false,
                  allowClear: field === 'parent_company',
                }}
              />
            ))}
          {visible.has('valuation_method') && (
            <ProFormSelect
              name="valuation_method"
              label="默认库存计价方式"
              disabled={!allowed('valuation_method')}
              options={(
                options?.valuation_methods ||
                context?.valuation_methods ||
                []
              ).map((value) => ({
                value,
                label:
                  (
                    {
                      FIFO: '先进先出',
                      'Moving Average': '移动加权平均',
                      LIFO: '后进先出',
                    } as Record<string, string>
                  )[value] || value,
              }))}
              rules={[{ required: true, message: '请选择计价方式' }]}
              allowClear={false}
            />
          )}
          {visible.has('tax_id') && (
            <ProFormText
              name="tax_id"
              label="税号"
              disabled={!allowed('tax_id')}
              fieldProps={{ maxLength: 140 }}
            />
          )}
          {visible.has('phone_no') && (
            <ProFormText
              name="phone_no"
              label="电话"
              disabled={!allowed('phone_no')}
              fieldProps={{ maxLength: 140 }}
            />
          )}
          {visible.has('email') && (
            <ProFormText
              name="email"
              label="邮箱"
              disabled={!allowed('email')}
              rules={[{ type: 'email', message: '请输入有效邮箱' }]}
              fieldProps={{ maxLength: 140 }}
            />
          )}
          {visible.has('website') && (
            <ProFormText
              name="website"
              label="网站"
              disabled={!allowed('website')}
              fieldProps={{ maxLength: 140 }}
            />
          )}
        </React.Fragment>
      )}
    </DrawerForm>
  );
}
