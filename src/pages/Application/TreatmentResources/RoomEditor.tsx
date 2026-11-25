import {
  DrawerForm,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, App, Form, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  api,
  errorMessage,
  type LinkField,
  links,
  type Options,
  type Room,
  type RoomField,
  save,
} from './service';

export type Editor =
  | { mode: 'create' }
  | { mode: 'edit' | 'view'; name: string };

export default function RoomEditor({
  editor,
  options,
  onClose,
  onSaved,
}: {
  editor: Editor;
  options: Options;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [detail, setDetail] = useState<{ room: Room; can_edit: boolean }>();
  const [error, setError] = useState<string>();
  const changed = useRef(new Set<string>());
  const { message } = App.useApp();
  const company = Form.useWatch<string>('company', form);
  const department = Form.useWatch<string>('department', form);
  const name = 'name' in editor ? editor.name : undefined;
  useEffect(() => {
    if (!name) return;
    let active = true;
    api<{ room: Room; can_edit: boolean }>('get_room', { name })
      .then((value) => {
        if (!active) return;
        setDetail(value);
        form.setFieldsValue({
          ...value.room,
          enabled: Boolean(value.room.enabled),
        });
      })
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [form, name]);
  const creating = editor.mode === 'create';
  const writable = creating
    ? options.can_create
    : editor.mode === 'edit' && detail?.can_edit;
  const visible = new Set(
    creating ? options.write_fields : options.read_fields,
  );
  const editable = (field: RoomField) =>
    Boolean(writable && options.write_fields.includes(field));
  function link(field: LinkField, label: string, required = false) {
    if (!visible.has(field)) return null;
    const selectable = options.link_fields.includes(field) && editable(field);
    return (
      <ProFormSelect
        name={field}
        label={label}
        disabled={
          !selectable ||
          (field === 'area' && (!company || !department)) ||
          (field === 'native_service_unit' && !company)
        }
        rules={required ? [{ required: true }] : undefined}
        showSearch
        params={{
          company:
            field === 'area' || field === 'native_service_unit'
              ? company
              : undefined,
          department: field === 'area' ? department : undefined,
        }}
        request={({ keyWords, company, department }) =>
          selectable
            ? links(field, keyWords || '', company, department)
            : Promise.resolve([])
        }
        fieldProps={{ filterOption: false, allowClear: !required }}
      />
    );
  }
  return (
    <DrawerForm
      title={
        creating ? '新增治疗场地' : writable ? '编辑治疗场地' : '治疗场地详情'
      }
      open
      form={form}
      width="min(620px, 100vw)"
      drawerProps={{ destroyOnHidden: true }}
      initialValues={creating ? { enabled: true } : undefined}
      submitter={writable ? { searchConfig: { submitText: '保存' } } : false}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onValuesChange={(value) => {
        for (const field of Object.keys(value)) changed.current.add(field);
        const dependent =
          'company' in value
            ? (['area', 'native_service_unit'] as const)
            : 'department' in value
              ? (['area'] as const)
              : [];
        for (const field of dependent) {
          if (!editable(field)) continue;
          form.setFieldValue(field, undefined);
          changed.current.add(field);
        }
      }}
      onFinish={async (values) => {
        if (!writable) return false;
        const fields = options.write_fields.filter((field) =>
          creating ? values[field] !== undefined : changed.current.has(field),
        );
        try {
          if (fields.length) {
            await save(
              Object.fromEntries(
                fields.map((field) => [field, values[field] ?? '']),
              ),
              detail?.room,
            );
            message.success(creating ? '治疗场地已新增' : '治疗场地已保存');
            onSaved();
          }
          onClose();
          return true;
        } catch (reason) {
          setError(errorMessage(reason));
          return false;
        }
      }}
    >
      {error && <Alert type="error" showIcon title={error} />}
      {!creating && !detail && !error && <Spin />}
      {(creating || detail) && (
        <>
          {visible.has('resource_name') && (
            <ProFormText
              name="resource_name"
              label="场地名称"
              disabled={!editable('resource_name')}
              rules={[{ required: true }]}
              fieldProps={{ maxLength: 140 }}
            />
          )}
          {link('company', '所属机构', true)}
          {link('department', '医疗科室', true)}
          {link('area', '治疗区域')}
          {link('native_service_unit', '关联医疗服务单元')}
          {visible.has('display_label') && (
            <ProFormText
              name="display_label"
              label="大屏资源代号"
              disabled={!editable('display_label')}
              fieldProps={{ maxLength: 140 }}
            />
          )}
          {visible.has('notes') && (
            <ProFormTextArea
              name="notes"
              label="资源说明"
              disabled={!editable('notes')}
              fieldProps={{ maxLength: 2000 }}
            />
          )}
          {visible.has('enabled') && (
            <ProFormSwitch
              name="enabled"
              label="启用"
              disabled={!editable('enabled')}
            />
          )}
        </>
      )}
    </DrawerForm>
  );
}
