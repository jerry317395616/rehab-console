import {
  type EditableFormInstance,
  EditableProTable,
  type ProColumns,
} from '@ant-design/pro-components';
import { Alert, Button, DatePicker, Select, Space } from 'antd';
import dayjs from 'dayjs';
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { errorMessage } from './feedback';
import {
  type DirectCharge,
  get,
  type LinkOption,
  searchPriceOptions,
} from './service';

export type ChargesHandle = { values: () => Promise<DirectCharge[]> };
type Props = {
  initial: DirectCharge[];
  editable: boolean;
  readFields: string[];
  canReadPrices: boolean;
  canSelectItems: boolean;
  onDirty: () => void;
};
export default forwardRef<ChargesHandle, Props>(function OrderItemCharges(
  { initial, editable, readFields, canReadPrices, canSelectItems, onDirty },
  ref,
) {
  const [rows, setRows] = useState<DirectCharge[]>(
    initial.map((row) => ({ ...row, _key: crypto.randomUUID() })),
  );
  const tableForm = useRef<EditableFormInstance<DirectCharge>>(undefined);
  const choices = useRef(new Map<string, LinkOption>());
  const [priceLists, setPriceLists] = useState<LinkOption[]>([]);
  const [priceList, setPriceList] = useState<string>();
  const [onDate, setOnDate] = useState(dayjs());
  const [prices, setPrices] = useState<
    Record<
      string,
      {
        status: string;
        amount?: number;
        currency?: string;
      }
    >
  >({});
  const [error, setError] = useState<string>();
  const [pricing, setPricing] = useState(false);
  const codes = [...new Set(rows.map((row) => row.item_code).filter(Boolean))];
  const codesKey = JSON.stringify(codes.sort());
  useEffect(() => {
    if (!canReadPrices) return;
    let active = true;
    searchPriceOptions('price_list')
      .then((value) => {
        if (active) setPriceLists(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [canReadPrices]);
  useEffect(() => {
    let active = true;
    setPrices({});
    if (!priceList || !canReadPrices) return;
    setPricing(true);
    setError(undefined);
    get<typeof prices>('charge_price_api', 'get_item_prices', {
      item_codes: codesKey,
      price_list: priceList,
      on_date: onDate.format('YYYY-MM-DD'),
    })
      .then((value) => {
        if (active) setPrices(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setPricing(false);
      });
    return () => {
      active = false;
    };
  }, [codesKey, priceList, canReadPrices, onDate]);
  useImperativeHandle(ref, () => ({
    async values() {
      await tableForm.current?.validateFields();
      return rows.map((row) => {
        const latest = { ...row, ...tableForm.current?.getRowData?.(row._key) };
        return {
          _key: latest._key,
          name: latest.name,
          item_code: latest.item_code,
          uom: choices.current.get(latest.item_code || '')?.uom || latest.uom,
          default_qty: latest.default_qty,
          quantity_mode: latest.quantity_mode,
          requirement: latest.requirement,
          enabled: latest.enabled,
        };
      });
    },
  }));
  function updateRows(values: readonly DirectCharge[]) {
    const edited = new Map(values.map((row) => [row._key, row]));
    setRows((current) =>
      current.map((row) => ({ ...row, ...edited.get(row._key) })),
    );
    onDirty();
  }
  const visible = new Set(readFields);
  const columns: ProColumns<DirectCharge>[] = [
    {
      title: '收费项目',
      dataIndex: 'item_code',
      valueType: 'select',
      width: 240,
      hideInTable: !visible.has('item_code'),
      request: async ({ keyWords }) => {
        if (!canSelectItems) return [];
        const options = await get<LinkOption[]>(
          'order_item_charges',
          'search_items',
          { keyword: keyWords || '' },
        );
        for (const option of options) choices.current.set(option.value, option);
        return options;
      },
      fieldProps: {
        showSearch: true,
        filterOption: false,
        optionLabelProp: 'value',
      },
      formItemProps: { rules: [{ required: true, message: '请选择收费项目' }] },
    },
    {
      title: '收费项目名称',
      key: 'item_name',
      width: 170,
      editable: false,
      hideInTable: !visible.has('item_code'),
      render: (_, row) =>
        choices.current.get(row.item_code || '')?.label || row.item_name || '—',
    },
    {
      title: '计价单位',
      dataIndex: 'uom',
      width: 90,
      editable: false,
      hideInTable: !visible.has('uom'),
      render: (_, row) =>
        choices.current.get(row.item_code || '')?.uom || row.uom,
    },
    {
      title: '每次收费数量',
      dataIndex: 'default_qty',
      valueType: 'digit',
      width: 110,
      hideInTable: !visible.has('default_qty'),
      fieldProps: { min: 0.000001, max: 100000000000 },
      formItemProps: { rules: [{ required: true, message: '请输入数量' }] },
    },
    {
      title: '数量依据',
      dataIndex: 'quantity_mode',
      valueType: 'select',
      width: 150,
      hideInTable: !visible.has('quantity_mode'),
      valueEnum: { Fixed: '固定数量', Actual: '按本次实际数量' },
      formItemProps: { rules: [{ required: true }] },
    },
    {
      title: '计费属性',
      dataIndex: 'requirement',
      valueType: 'select',
      width: 140,
      hideInTable: !visible.has('requirement'),
      valueEnum: { Required: '必选项', Optional: '按实际选用' },
      formItemProps: { rules: [{ required: true }] },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueType: 'select',
      width: 100,
      hideInTable: !visible.has('enabled'),
      valueEnum: { 0: '停用', 1: '启用' },
      fieldProps: {
        options: [
          { value: 0, label: '停用' },
          { value: 1, label: '启用' },
        ],
      },
    },
    {
      title: '所选价目表单价',
      key: 'price',
      editable: false,
      width: 160,
      hideInTable: !priceList || !canReadPrices,
      render: (_, row) => {
        const price = prices[row.item_code || ''];
        return price?.status === 'priced'
          ? `${price.amount} ${price.currency}`
          : price?.status === 'ambiguous'
            ? '有效价格冲突'
            : pricing
              ? '查询中'
              : '未配置有效价格';
      },
    },
    { title: '操作', valueType: 'option', width: 90, hideInTable: !editable },
  ];
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        showIcon
        type="info"
        title="收费关联与医嘱项目一起保存，仅对之后提交的医嘱生效。单价按所选价目表和服务日期查询。"
      />
      {error && <Alert showIcon type="error" title={error} />}
      {canReadPrices && (
        <Space wrap>
          <Select
            aria-label="预览价目表"
            placeholder="选择价目表预览价格"
            allowClear
            style={{ width: 240 }}
            value={priceList}
            options={priceLists}
            onChange={setPriceList}
          />
          <DatePicker
            aria-label="价格日期"
            value={onDate}
            allowClear={false}
            onChange={(value) => {
              if (value) setOnDate(value);
            }}
          />
        </Space>
      )}
      <EditableProTable<DirectCharge>
        rowKey="_key"
        headerTitle="关联收费项目"
        search={false}
        options={false}
        value={rows}
        onChange={updateRows}
        columns={columns}
        scroll={{ x: 1030 }}
        editableFormRef={tableForm}
        recordCreatorProps={false}
        editable={{
          type: 'multiple',
          editableKeys: editable ? rows.map((row) => row._key) : [],
          onValuesChange: (_, values) => updateRows(values),
          actionRender: (row) => [
            <Button
              key="delete"
              type="link"
              danger
              onClick={() => {
                setRows((current) =>
                  current.filter((value) => value._key !== row._key),
                );
                onDirty();
              }}
            >
              移除
            </Button>,
          ],
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
                      {
                        _key: crypto.randomUUID(),
                        default_qty: 1,
                        quantity_mode: 'Fixed',
                        requirement: 'Required',
                        enabled: 1,
                      },
                    ]);
                    onDirty();
                  }}
                >
                  添加收费项目
                </Button>,
              ]
            : []
        }
      />
    </Space>
  );
});
