import {
  type EditableFormInstance,
  EditableProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { Button } from 'antd';
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { type Link, links, type Relation, type RelationField } from './service';

export type RelationsHandle = { values: () => Promise<Relation[]> };
type Props = {
  field: RelationField;
  initial: Relation[];
  editable: boolean;
  readFields: string[];
  onDirty: () => void;
  canSelectCompanies?: boolean;
};
export default forwardRef<RelationsHandle, Props>(function Relations(
  { field, initial, editable, readFields, onDirty, canSelectCompanies = false },
  ref,
) {
  const [rows, setRows] = useState<Relation[]>(
    initial.map((row) => ({ ...row, _key: row.name || crypto.randomUUID() })),
  );
  const tableForm = useRef<EditableFormInstance<Relation>>(undefined);
  const options = useRef(new Map<string, Link>());
  const department = field === 'rehab_departments';
  const orders = field === 'rehab_order_items';
  const link = department
    ? 'department'
    : orders
      ? 'order_item'
      : 'equipment_type';
  const label = department ? '执行科室' : orders ? '医嘱项目' : '设备类型';
  useImperativeHandle(ref, () => ({
    async values() {
      await tableForm.current?.validateFields();
      return rows.map((row) => {
        const value = { ...row, ...tableForm.current?.getRowData?.(row._key) };
        return {
          _key: row._key,
          name: value.name,
          [link]: value[link],
          ...(department
            ? {
                company: value.company || '',
                is_default: Number(Boolean(value.is_default)),
              }
            : field === 'rehab_equipment_types'
              ? { quantity: value.quantity || 1 }
              : {}),
        };
      });
    },
  }));
  function update(values: readonly Relation[]) {
    const edited = new Map(
      values.map((row) => {
        const previous = rows.find((entry) => entry._key === row._key);
        if (
          department &&
          previous &&
          (previous.company || '') !== (row.company || '')
        ) {
          const cleared = { ...row, department: undefined };
          tableForm.current?.setRowData?.(row._key, cleared);
          return [row._key, cleared];
        }
        return [row._key, row];
      }),
    );
    setRows((current) =>
      current.map((row) => ({ ...row, ...edited.get(row._key) })),
    );
    onDirty();
  }
  const columns: ProColumns<Relation>[] = [
    ...(department
      ? [
          {
            title: '适用机构',
            dataIndex: 'company',
            valueType: 'select' as const,
            width: 220,
            hideInTable: !readFields.includes('company'),
            request: async ({ keyWords }: { keyWords?: string }) =>
              canSelectCompanies ? links('company', keyWords || '') : [],
            fieldProps: {
              'aria-label': '适用机构',
              disabled: !canSelectCompanies,
              showSearch: true,
              filterOption: false,
              placeholder: '留空表示所有授权机构',
            },
          },
        ]
      : []),
    {
      title: label,
      dataIndex: link,
      valueType: 'select',
      width: 260,
      hideInTable: !readFields.includes(link),
      dependencies: department ? ['company'] : undefined,
      params: department
        ? (row: Relation) => ({ company: row.company || '' })
        : undefined,
      request: async ({ keyWords, company }) => {
        const values = await links(
          link,
          keyWords || '',
          department ? company || '' : '',
        );
        for (const value of values) options.current.set(value.value, value);
        return values;
      },
      fieldProps: {
        'aria-label': label,
        showSearch: true,
        filterOption: false,
      },
      formItemProps: { rules: [{ required: true, message: `请选择${label}` }] },
    },
    ...(field === 'rehab_equipment_types'
      ? [
          {
            title: '每次所需台数',
            dataIndex: 'quantity',
            valueType: 'digit' as const,
            width: 150,
            hideInTable: !readFields.includes('quantity'),
            fieldProps: { min: 1, max: 10, precision: 0 },
            formItemProps: {
              rules: [{ required: true, message: '请填写设备数量' }],
            },
          },
        ]
      : []),
    ...(orders
      ? [
          {
            title: '名称',
            key: 'item_name',
            width: 160,
            editable: false as const,
            render: (_: unknown, row: Relation) =>
              options.current.get(row.order_item || '')?.item_name ||
              row.item_name ||
              '—',
          },
          {
            title: '医嘱类型',
            key: 'order_term',
            width: 100,
            editable: false as const,
            render: (_: unknown, row: Relation) => {
              const term =
                options.current.get(row.order_item || '')?.order_term ||
                row.order_term;
              return term === 'Long Term'
                ? '长期'
                : term === 'Temporary'
                  ? '临时'
                  : '未指定';
            },
          },
          {
            title: '默认次数',
            key: 'default_sessions',
            width: 100,
            editable: false as const,
            render: (_: unknown, row: Relation) =>
              options.current.get(row.order_item || '')?.default_sessions ??
              row.default_sessions ??
              '—',
          },
        ]
      : []),
    ...(department
      ? [
          {
            title: '默认科室',
            dataIndex: 'is_default',
            valueType: 'switch' as const,
            width: 100,
            hideInTable: !readFields.includes('is_default'),
          },
        ]
      : []),
    {
      title: '操作',
      valueType: 'option',
      width: 80,
      hideInTable: !editable,
      render: (_, row) => (
        <Button
          type="link"
          danger
          onClick={() => {
            setRows((current) =>
              current.filter((entry) => entry._key !== row._key),
            );
            onDirty();
          }}
        >
          移除
        </Button>
      ),
    },
  ];
  return (
    <EditableProTable<Relation>
      rowKey="_key"
      headerTitle={
        orders
          ? '可承接医嘱项目'
          : department
            ? '执行机构和医疗科室'
            : '设备类型与每次所需台数'
      }
      columns={columns}
      value={rows}
      onChange={update}
      editableFormRef={tableForm}
      search={false}
      options={false}
      scroll={{ x: orders ? 800 : department ? 620 : 360 }}
      recordCreatorProps={false}
      editable={{
        type: 'multiple',
        editableKeys: editable ? rows.map((row) => row._key) : [],
        onValuesChange: (_, values) => update(values),
      }}
      toolBarRender={() =>
        editable
          ? [
              <Button
                key="add"
                disabled={rows.length >= 100}
                onClick={() => {
                  setRows((current) => [
                    ...current,
                    { _key: crypto.randomUUID(), is_default: 0 },
                  ]);
                  onDirty();
                }}
              >
                添加{label}
              </Button>,
            ]
          : []
      }
    />
  );
});
