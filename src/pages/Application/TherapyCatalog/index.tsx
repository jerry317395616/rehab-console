import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  DrawerForm,
  type ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Col,
  Drawer,
  Form,
  Popconfirm,
  Result,
  Row,
  Space,
  Tabs,
  Tag,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import Categories from './Categories';
import DefinitionFields from './DefinitionFields';
import ReferencePrices from './ReferencePrices';
import Relations, { type RelationsHandle } from './Relations';
import {
  api,
  type Context,
  careSettings,
  definitionFlags,
  errorMessage,
  links,
  mutate,
  type RelationField,
  type Rights,
  relationFields,
  type Treatment,
} from './service';

export default function TherapyCatalog() {
  const action = useRef<ActionType>(undefined);
  const [rights, setRights] = useState<Rights>();
  const [failed, setFailed] = useState(false);
  const [editor, setEditor] = useState<{ name?: string; readOnly?: boolean }>();
  const [context, setContext] = useState<Context>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('basic');
  const [form] = Form.useForm();
  const kind = Form.useWatch('rehab_project_kind', form);
  const needsTherapist = Form.useWatch('rehab_requires_therapist', form);
  const needsEquipment = Form.useWatch('rehab_requires_equipment', form);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categoryVersion, setCategoryVersion] = useState(0);
  const dirty = useRef(new Set<string>());
  const relationRefs = useRef<
    Partial<Record<RelationField, RelationsHandle | null>>
  >({});
  const working = useRef(false);
  const { message, modal } = App.useApp();
  useEffect(() => {
    let active = true;
    api<Rights>('get_options')
      .then((value) => {
        if (active) {
          setRights(value);
          setFailed(false);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(errorMessage(reason));
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    let active = true;
    dirty.current.clear();
    relationRefs.current = {};
    setContext(undefined);
    setError(undefined);
    setTab('basic');
    form.resetFields();
    if (!editor) return;
    if (!editor.name) {
      setLoading(false);
      form.setFieldsValue({
        default_duration: 30,
        rehab_requires_therapist: true,
        rehab_requires_equipment: false,
        rehab_gap_minutes: 0,
        rehab_therapist_count: 1,
        rehab_booking_required: true,
        rehab_equipment_count: 1,
        rehab_equipment_mode: 'Any',
        rehab_room_buffer: 0,
        rehab_equipment_buffer: 0,
        rehab_catalog_disabled: false,
        rehab_project_kind: 'Treatment',
        rehab_execution_mode: 'Serial',
        rehab_booking_mode: 'Personnel',
        rehab_booking_limit: 1,
        ...Object.fromEntries(definitionFlags.map(([name]) => [name, false])),
        ...Object.fromEntries(
          careSettings.map((setting) => [setting.field, true]),
        ),
      });
      return;
    }
    setLoading(true);
    api<Context>('get_treatment', { name: editor.name })
      .then((value) => {
        if (!active) return;
        setContext(value);
        form.setFieldsValue({
          ...value.item,
          rehab_duration_min: value.item.rehab_duration_min || null,
          rehab_duration_max: value.item.rehab_duration_max || null,
          rehab_requires_therapist: Boolean(
            value.item.rehab_requires_therapist,
          ),
          rehab_requires_equipment: Boolean(
            value.item.rehab_requires_equipment,
          ),
          rehab_catalog_disabled: Boolean(value.item.rehab_catalog_disabled),
          rehab_booking_required: Boolean(value.item.rehab_booking_required),
          ...Object.fromEntries(
            definitionFlags.map(([name]) => [name, Boolean(value.item[name])]),
          ),
          ...Object.fromEntries(
            careSettings.map((setting) => [
              setting.field,
              Boolean(value.item[setting.field]),
            ]),
          ),
        });
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editor, form]);
  const creating = Boolean(editor && !editor.name);
  const currentRights = creating ? rights : context;
  const canSave = Boolean(
    creating ? rights?.can_create : context?.can_edit && !editor?.readOnly,
  );
  const writable = currentRights?.write_fields || [];
  const visible = new Set(
    creating ? writable : currentRights?.read_fields || [],
  );
  const allowed = (field: string) => canSave && writable.includes(field);
  function close() {
    if (working.current) return;
    if (canSave && dirty.current.size)
      modal.confirm({
        title: '放弃尚未保存的治疗项目资料？',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: () => setEditor(undefined),
      });
    else setEditor(undefined);
  }
  const field = (name: string, element: React.ReactNode) =>
    visible.has(name) ? element : null;
  const basicField = (
    name: string,
    element: React.ReactNode,
    fullWidth = false,
  ) =>
    field(
      name,
      <Col key={name} xs={24} sm={fullWidth ? 24 : 12}>
        {element}
      </Col>,
    );
  const columns: ProColumns<Treatment>[] = [
    { title: '编码、名称或拼音', dataIndex: 'keyword', hideInTable: true },
    {
      title: '编码',
      dataIndex: 'rehab_treatment_code',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_treatment_code'),
      width: 160,
    },
    {
      title: '名称',
      dataIndex: 'rehab_display_label',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_display_label'),
      width: 180,
    },
    {
      title: '分类',
      dataIndex: 'category',
      valueType: 'select',
      request: async ({ keyWords }) =>
        rights?.can_select_categories
          ? links('rehab_category_ref', keyWords || '')
          : [],
      fieldProps: { showSearch: true, filterOption: false },
      hideInTable: true,
      search:
        rights?.can_select_categories &&
        rights?.read_fields.includes('rehab_category_ref')
          ? undefined
          : false,
    },
    {
      title: '分类',
      dataIndex: 'rehab_category',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_category'),
    },
    {
      title: '默认时长（分钟）',
      dataIndex: 'default_duration',
      search: false,
      width: 150,
      hideInTable: !rights?.read_fields.includes('default_duration'),
    },
    {
      title: '执行科室',
      dataIndex: 'department',
      valueType: 'select',
      search: rights?.can_select_departments ? undefined : false,
      hideInTable: true,
      request: () =>
        rights?.can_select_departments
          ? links('department')
          : Promise.resolve([]),
      fieldProps: { showSearch: true },
    },
    {
      title: '执行科室',
      key: 'departments',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_departments'),
      render: (_, row) =>
        row.rehab_departments?.map((entry) => entry.department).join('、') ||
        '—',
    },
    {
      title: '设备类型',
      key: 'equipment',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_equipment_types'),
      render: (_, row) =>
        row.rehab_equipment_types
          ?.map((entry) => entry.equipment_type)
          .join('、') || '—',
    },
    {
      title: '关联医嘱数',
      key: 'orders',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_order_items'),
      render: (_, row) => row.rehab_order_items?.length ?? '—',
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      valueType: 'select',
      hideInTable: !rights?.can_read_state,
      search: rights?.can_read_state ? undefined : false,
      valueEnum: { '0': '启用', '1': '停用' },
      render: (_, row) => (
        <Tag color={row.enabled ? 'success' : 'default'}>
          {row.enabled ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '执行要求',
      key: 'resource_rules',
      search: false,
      width: 230,
      hideInTable: !rights?.read_fields.some((name) =>
        [
          'rehab_therapist_count',
          'rehab_requires_equipment',
          'rehab_booking_required',
        ].includes(name),
      ),
      render: (_, row) => (
        <Space wrap>
          {rights?.read_fields.includes('rehab_requires_therapist') &&
            rights.read_fields.includes('rehab_therapist_count') && (
              <Tag>
                {row.rehab_requires_therapist
                  ? `${row.rehab_therapist_count || 1} 人全程参与`
                  : '无需全程治疗师'}
              </Tag>
            )}
          {rights?.read_fields.includes('rehab_requires_equipment') &&
            Boolean(row.rehab_requires_equipment) && <Tag>需设备</Tag>}
          {rights?.read_fields.includes('rehab_booking_required') && (
            <Tag>
              {row.rehab_booking_required ? '须提前预约' : '可现场安排'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 130,
      render: (_, row) => [
        <Button
          key="view"
          type="link"
          onClick={() => setEditor({ name: row.name, readOnly: true })}
        >
          查看
        </Button>,
        row.can_edit && (
          <Button
            key="edit"
            type="link"
            onClick={() => setEditor({ name: row.name })}
          >
            编辑
          </Button>
        ),
      ],
    },
  ];
  columns.splice(
    3,
    0,
    {
      title: '简称',
      dataIndex: 'rehab_short_name',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_short_name'),
    },
    {
      title: '拼音码',
      dataIndex: 'rehab_search_code',
      search: false,
      hideInTable: !rights?.read_fields.includes('rehab_search_code'),
    },
    {
      title: '项目性质',
      dataIndex: 'project_kind',
      hideInTable: true,
      valueType: 'select',
      valueEnum: { Treatment: '治疗', Assessment: '评估' },
      search: rights?.read_fields.includes('rehab_project_kind')
        ? undefined
        : false,
    },
    {
      title: '项目性质',
      dataIndex: 'rehab_project_kind',
      search: false,
      valueEnum: { Treatment: '治疗', Assessment: '评估' },
      hideInTable: !rights?.read_fields.includes('rehab_project_kind'),
    },
    {
      title: '适用场景',
      dataIndex: 'care_setting',
      hideInTable: true,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        careSettings.map((setting) => [setting.value, setting.label]),
      ),
      search: careSettings.every((setting) =>
        rights?.read_fields.includes(setting.field),
      )
        ? undefined
        : false,
    },
  );
  columns.splice(6, 0, {
    title: '适用场景',
    key: 'scope',
    search: false,
    render: (_, row) =>
      careSettings
        .filter(
          (setting) =>
            rights?.read_fields.includes(setting.field) && row[setting.field],
        )
        .map((setting) => setting.label)
        .join('、') || '—',
  });
  const relations = (name: RelationField) =>
    visible.has(name) ? (
      <Relations
        key={`${editor?.name || 'new'}:${name}`}
        field={name}
        initial={context?.item[name] || []}
        readFields={currentRights?.child_read_fields[name] || []}
        canSelectCompanies={currentRights?.can_select_companies}
        editable={
          allowed(name) &&
          (name !== 'rehab_departments' ||
            Boolean(currentRights?.can_select_departments)) &&
          (name !== 'rehab_equipment_types' ||
            Boolean(currentRights?.can_select_equipment_types)) &&
          !context?.hidden_links &&
          (name === 'rehab_departments'
            ? ['company', 'department', 'is_default']
            : name === 'rehab_order_items'
              ? ['order_item']
              : ['equipment_type', 'quantity']
          ).every((key) =>
            currentRights?.child_write_fields[name]?.includes(key),
          ) &&
          (name !== 'rehab_order_items' ||
            Boolean(currentRights?.can_select_orders))
        }
        ref={(value) => {
          relationRefs.current[name] = value;
        }}
        onDirty={() => dirty.current.add(name)}
      />
    ) : null;
  if (failed)
    return (
      <Result
        status="403"
        title={error || '无法读取治疗项目管理'}
        extra={
          <Button onClick={() => setAttempt((value) => value + 1)}>
            重新加载
          </Button>
        }
      />
    );
  return (
    <>
      <ProTable<Treatment>
        actionRef={action}
        rowKey="name"
        columns={columns}
        scroll={{ x: 1550 }}
        request={async ({
          current,
          pageSize,
          keyword,
          category,
          department,
          disabled,
          project_kind,
          care_setting,
        }) =>
          api<{ data: Treatment[]; total: number; success: boolean }>(
            'get_treatments',
            {
              current,
              page_size: pageSize,
              keyword,
              category,
              department,
              disabled,
              project_kind,
              care_setting,
            },
          )
        }
        onRequestError={(reason) => {
          setError(errorMessage(reason));
          setFailed(true);
        }}
        toolBarRender={() => [
          rights?.can_read_categories && (
            <Button key="categories" onClick={() => setCategoriesOpen(true)}>
              分类管理
            </Button>
          ),
          ...(rights?.can_create
            ? [
                <Button
                  key="new"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({})}
                >
                  新增治疗项目
                </Button>,
              ]
            : []),
        ]}
      />
      <DrawerForm
        title={creating ? '新增治疗项目' : '治疗项目详情'}
        name="therapy-catalog"
        form={form}
        open={Boolean(editor)}
        width="min(1000px, 100vw)"
        loading={loading}
        drawerProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
        }}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        onValuesChange={(changes) => {
          for (const key of Object.keys(changes)) dirty.current.add(key);
          setError(undefined);
        }}
        submitter={
          canSave
            ? {
                searchConfig: { submitText: '保存治疗项目', resetText: '取消' },
                render: (_, buttons) => [
                  <Button key="close" disabled={saving} onClick={close}>
                    取消
                  </Button>,
                  buttons[1],
                ],
              }
            : { render: () => <Button onClick={close}>关闭</Button> }
        }
        onFinish={async (values: Record<string, unknown>) => {
          if (!canSave || working.current) return false;
          working.current = true;
          setSaving(true);
          setError(undefined);
          try {
            const selected = Object.fromEntries(
              writable
                .filter(
                  (key) =>
                    !relationFields.includes(key as RelationField) &&
                    Object.hasOwn(values, key) &&
                    (creating || dirty.current.has(key)),
                )
                .map((key) => [
                  key,
                  typeof values[key] === 'boolean'
                    ? Number(values[key])
                    : (values[key] ?? ''),
                ]),
            );
            for (const name of relationFields)
              if (allowed(name) && dirty.current.has(name)) {
                const rows = await relationRefs.current[name]?.values();
                selected[name] = (rows || []).map(({ _key, ...row }) => row);
              }
            if (
              selected.rehab_project_kind === 'Treatment' &&
              allowed('rehab_assessment_template')
            )
              selected.rehab_assessment_template = '';
            await mutate('save_treatment', {
              name: context?.item.name,
              modified: context?.item.modified,
              values: selected,
            });
            dirty.current.clear();
            setEditor(undefined);
            action.current?.reload();
            message.success('治疗项目已保存');
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
        {error && <Alert type="error" title={error} showIcon />}
        {context?.native_disabled && (
          <Alert
            type="warning"
            title="原生治疗项目已停用，恢复需通过原有管理流程核对。"
            showIcon
          />
        )}
        {context?.hidden_links && (
          <Alert
            type="info"
            title="部分关联资料超出当前账号的读取范围，关联清单仅供查看。"
            showIcon
          />
        )}
        {context?.item.assessment_setup_required && (
          <Alert
            type="warning"
            title="此历史评估项目尚未选择评估模板，请补齐配置。"
            showIcon
          />
        )}
        {(creating || context) && (
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={[
              {
                key: 'basic',
                label: '基本信息',
                forceRender: true,
                children: (
                  <Row gutter={16}>
                    {basicField(
                      'rehab_treatment_code',
                      <ProFormText
                        name="rehab_treatment_code"
                        label="治疗项目编码"
                        disabled={!creating || !allowed('rehab_treatment_code')}
                        rules={[
                          { required: true },
                          {
                            pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/,
                            message:
                              '请输入 2 至 40 位字母、数字、下划线或连字符',
                          },
                        ]}
                      />,
                    )}
                    {basicField(
                      'rehab_display_label',
                      <ProFormText
                        name="rehab_display_label"
                        label="治疗项目名称"
                        disabled={!allowed('rehab_display_label')}
                        rules={[{ required: true, whitespace: true }]}
                        fieldProps={{ maxLength: 100 }}
                      />,
                    )}
                    {basicField(
                      'rehab_short_name',
                      <ProFormText
                        name="rehab_short_name"
                        label="项目简称"
                        disabled={!allowed('rehab_short_name')}
                        fieldProps={{ maxLength: 60 }}
                      />,
                    )}
                    {basicField(
                      'rehab_search_code',
                      <ProFormText
                        name="rehab_search_code"
                        label="拼音码"
                        disabled={!allowed('rehab_search_code')}
                        tooltip="留空时按项目名称自动生成，可手工校正多音字。"
                        fieldProps={{ maxLength: 60 }}
                      />,
                    )}
                    {basicField(
                      'rehab_category_ref',
                      <ProFormSelect
                        key={`category-${categoryVersion}`}
                        name="rehab_category_ref"
                        label="治疗分类"
                        disabled={
                          !allowed('rehab_category_ref') ||
                          !currentRights?.can_select_categories
                        }
                        request={async ({ keyWords }) => {
                          const options = currentRights?.can_select_categories
                            ? await links('rehab_category_ref', keyWords || '')
                            : [];
                          const selected = context?.item.rehab_category_ref;
                          return selected &&
                            !options.some((option) => option.value === selected)
                            ? [
                                {
                                  value: selected,
                                  label:
                                    context?.item.category_label ||
                                    context?.item.rehab_category ||
                                    selected,
                                  disabled: true,
                                },
                                ...options,
                              ]
                            : options;
                        }}
                        fieldProps={{ showSearch: true, filterOption: false }}
                      />,
                    )}
                    {basicField(
                      'rehab_project_kind',
                      <ProFormSelect
                        name="rehab_project_kind"
                        label="项目性质"
                        disabled={!allowed('rehab_project_kind')}
                        options={[
                          { value: 'Treatment', label: '治疗' },
                          {
                            value: 'Assessment',
                            label: '评估',
                            disabled:
                              !currentRights?.can_select_assessment_templates,
                          },
                        ]}
                        rules={[{ required: true }]}
                        fieldProps={{
                          onChange: (value) => {
                            if (
                              value === 'Treatment' &&
                              allowed('rehab_assessment_template')
                            ) {
                              form.setFieldValue(
                                'rehab_assessment_template',
                                undefined,
                              );
                              dirty.current.add('rehab_assessment_template');
                            }
                          },
                        }}
                      />,
                    )}
                    {kind === 'Assessment' &&
                      basicField(
                        'rehab_assessment_template',
                        <ProFormSelect
                          name="rehab_assessment_template"
                          label="评估模板"
                          disabled={
                            !allowed('rehab_assessment_template') ||
                            !currentRights?.can_select_assessment_templates
                          }
                          request={({ keyWords }) =>
                            currentRights?.can_select_assessment_templates
                              ? links(
                                  'rehab_assessment_template',
                                  keyWords || '',
                                )
                              : Promise.resolve([])
                          }
                          fieldProps={{ showSearch: true, filterOption: false }}
                          rules={
                            allowed('rehab_assessment_template') &&
                            currentRights?.can_select_assessment_templates
                              ? [{ required: true, message: '请选择评估模板' }]
                              : []
                          }
                        />,
                        true,
                      )}
                    {basicField(
                      'default_duration',
                      <ProFormDigit
                        name="default_duration"
                        label="默认预约时长（分钟）"
                        disabled={!allowed('default_duration')}
                        min={1}
                        max={1440}
                        fieldProps={{ precision: 0 }}
                        rules={[{ required: true }]}
                      />,
                    )}
                    {(
                      [
                        ['rehab_duration_min', '单次最短时长（分钟）'],
                        ['rehab_duration_max', '单次最长时长（分钟）'],
                      ] as const
                    ).map(([name, label]) =>
                      basicField(
                        name,
                        <ProFormDigit
                          name={name}
                          label={label}
                          placeholder="两项留空时使用固定时长"
                          disabled={!allowed(name)}
                          min={1}
                          max={720}
                          fieldProps={{ precision: 0 }}
                        />,
                      ),
                    )}
                    {basicField(
                      'rehab_catalog_disabled',
                      <ProFormSwitch
                        name="rehab_catalog_disabled"
                        label="停用"
                        disabled={!allowed('rehab_catalog_disabled')}
                        tooltip="停用后不能用于新医嘱和新排程，已有记录保留。"
                      />,
                    )}
                    {careSettings.some((setting) =>
                      visible.has(setting.field),
                    ) && (
                      <Col span={24}>
                        <Space size="large" wrap>
                          {careSettings.map((setting) =>
                            field(
                              setting.field,
                              <ProFormSwitch
                                key={setting.field}
                                name={setting.field}
                                label={`适用${setting.label}`}
                                disabled={!allowed(setting.field)}
                              />,
                            ),
                          )}
                        </Space>
                      </Col>
                    )}
                    {basicField(
                      'description',
                      <ProFormTextArea
                        name="description"
                        label="项目说明"
                        disabled={!allowed('description')}
                        fieldProps={{ maxLength: 2000 }}
                      />,
                      true,
                    )}
                  </Row>
                ),
              },
              {
                key: 'orders',
                label: '关联医嘱项目',
                forceRender: true,
                children: (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      title="关联表示本治疗项目可承接哪些医嘱。执行和计费以患者实际选择的医嘱为准。"
                    />
                    {relations('rehab_order_items')}
                    {context &&
                      visible.has('rehab_order_items') &&
                      currentRights?.can_read_reference_prices && (
                        <ReferencePrices
                          key={context.item.modified}
                          name={context.item.name}
                        />
                      )}
                  </Space>
                ),
              },
              {
                key: 'definition',
                label: '执行与预约属性',
                forceRender: true,
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      title="这里维护项目基础属性。保存这些标记不会生成预约、任务、处方或收费记录。"
                    />
                    <DefinitionFields visible={visible} allowed={allowed} />
                  </>
                ),
              },
              {
                key: 'resources',
                label: '资源配置',
                forceRender: true,
                children: (
                  <>
                    {field(
                      'rehab_requires_therapist',
                      <ProFormSwitch
                        name="rehab_requires_therapist"
                        label="需要治疗师"
                        disabled={!allowed('rehab_requires_therapist')}
                      />,
                    )}
                    {field(
                      'rehab_requires_equipment',
                      <ProFormSwitch
                        name="rehab_requires_equipment"
                        label="需要设备"
                        disabled={!allowed('rehab_requires_equipment')}
                      />,
                    )}
                    {needsTherapist &&
                      field(
                        'rehab_therapist_count',
                        <ProFormDigit
                          name="rehab_therapist_count"
                          label="治疗师数量（含主治疗师）"
                          min={1}
                          max={50}
                          fieldProps={{ precision: 0 }}
                          disabled={!allowed('rehab_therapist_count')}
                          rules={[{ required: true }]}
                        />,
                      )}
                    {needsEquipment &&
                      field(
                        'rehab_equipment_mode',
                        <ProFormSelect
                          name="rehab_equipment_mode"
                          label="设备组合"
                          options={[
                            {
                              value: 'Any',
                              label: '任选一种类型，满足该类型台数',
                            },
                            {
                              value: 'All',
                              label: '同时使用全部类型，分别满足台数',
                            },
                          ]}
                          disabled={!allowed('rehab_equipment_mode')}
                          rules={[{ required: true }]}
                        />,
                      )}
                    {needsEquipment &&
                      field(
                        'rehab_equipment_count',
                        <ProFormDigit
                          name="rehab_equipment_count"
                          label="未限定设备类型时所需台数"
                          min={1}
                          max={10}
                          fieldProps={{ precision: 0 }}
                          disabled={!allowed('rehab_equipment_count')}
                        />,
                      )}
                    {field(
                      'rehab_room_buffer',
                      <ProFormDigit
                        name="rehab_room_buffer"
                        label="场地结束后准备时间（分钟）"
                        min={0}
                        max={240}
                        fieldProps={{ precision: 0 }}
                        disabled={!allowed('rehab_room_buffer')}
                      />,
                    )}
                    {needsEquipment &&
                      field(
                        'rehab_equipment_buffer',
                        <ProFormDigit
                          name="rehab_equipment_buffer"
                          label="设备结束后准备时间（分钟）"
                          min={0}
                          max={240}
                          fieldProps={{ precision: 0 }}
                          disabled={!allowed('rehab_equipment_buffer')}
                        />,
                      )}
                    {relations('rehab_departments')}
                    {relations('rehab_equipment_types')}
                  </>
                ),
              },
            ]}
          />
        )}
        {!creating && context?.can_delete && !editor?.readOnly && (
          <Popconfirm
            title="删除此治疗项目？"
            description="已有收费绑定或业务引用的项目需要使用停用。"
            onConfirm={async () => {
              if (working.current) return;
              working.current = true;
              setSaving(true);
              try {
                await mutate('delete_treatment', {
                  name: context.item.name,
                  modified: context.item.modified,
                });
                dirty.current.clear();
                setEditor(undefined);
                action.current?.reload();
                message.success('治疗项目已删除');
              } catch (reason) {
                setError(errorMessage(reason));
              } finally {
                working.current = false;
                setSaving(false);
              }
            }}
          >
            <Button danger disabled={saving}>
              删除治疗项目
            </Button>
          </Popconfirm>
        )}
      </DrawerForm>
      <Drawer
        title="治疗分类管理"
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        size={760}
        destroyOnHidden
      >
        <Categories
          onChanged={() => {
            setCategoryVersion((value) => value + 1);
            action.current?.reload();
          }}
        />
      </Drawer>
    </>
  );
}
