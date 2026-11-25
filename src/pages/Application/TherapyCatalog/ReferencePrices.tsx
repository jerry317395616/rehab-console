import { type ProColumns, ProTable } from '@ant-design/pro-components';
import { Alert, Select } from 'antd';
import { useEffect, useState } from 'react';
import {
  get,
  type LinkOption,
  searchPriceOptions,
} from '../ChargeCatalog/service';
import { errorMessage } from './service';

type Line = {
  key: string;
  order_label: string;
  item_label?: string;
  default_qty?: number;
  uom?: string;
  requirement?: 'Required' | 'Optional';
  quantity_mode?: 'Fixed' | 'Actual';
  reference_amount?: string;
  price: { status: string; amount?: number; currency?: string };
};
const statuses: Record<string, string> = {
  missing: '无当前有效价格',
  ambiguous: '有效价格重复，请核实',
  legacy: '历史方案，请到医嘱项目核实',
  unit_mismatch: '计价单位不一致，请核实',
};
export default function ReferencePrices({ name }: { name: string }) {
  const [priceList, setPriceList] = useState<string>();
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [rows, setRows] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [restricted, setRestricted] = useState(false);
  const [keyword, setKeyword] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      searchPriceOptions('price_list', keyword)
        .then((value) => active && setOptions(value))
        .catch((reason) => active && setError(errorMessage(reason)));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [keyword]);
  useEffect(() => {
    let active = true;
    setRows([]);
    setError(undefined);
    setRestricted(false);
    if (!priceList) {
      setLoading(false);
      return;
    }
    setLoading(true);
    get<{ data: Line[]; restricted: boolean }>(
      'therapy_reference_prices',
      'get_prices',
      {
        therapy_type: name,
        price_list: priceList,
      },
    )
      .then((value) => {
        if (active) {
          setRows(value.data);
          setRestricted(value.restricted);
        }
      })
      .catch((reason) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [name, priceList]);
  const columns: ProColumns<Line>[] = [
    { title: '医嘱项目', dataIndex: 'order_label' },
    { title: '收费项目', dataIndex: 'item_label' },
    { title: '默认数量', dataIndex: 'default_qty' },
    { title: '单位', dataIndex: 'uom' },
    {
      title: '数量方式',
      dataIndex: 'quantity_mode',
      valueEnum: { Fixed: '固定', Actual: '按实际' },
    },
    {
      title: '必选属性',
      dataIndex: 'requirement',
      valueEnum: { Required: '必选', Optional: '可选' },
    },
    {
      title: '当前单价',
      key: 'rate',
      render: (_, row) =>
        row.price.status === 'priced'
          ? `${row.price.amount} ${row.price.currency || ''}`
          : statuses[row.price.status] || '—',
    },
    {
      title: '默认数量参考金额',
      key: 'reference',
      render: (_, row) =>
        row.reference_amount !== undefined
          ? `${row.reference_amount} ${row.price.currency || ''}`
          : '—',
    },
  ];
  return (
    <>
      <Alert
        type="info"
        showIcon
        title="参考金额按已保存的关联医嘱、收费项目及所选价目表的当日有效价格计算。可选项目和按实际数量项目以实际业务为准。"
      />
      {error && <Alert type="error" showIcon title={error} />}
      {restricted && (
        <Alert
          type="info"
          showIcon
          title="部分关联资料超出当前账号读取范围。"
        />
      )}
      <ProTable<Line>
        headerTitle="参考收费金额"
        rowKey="key"
        columns={columns}
        dataSource={rows}
        loading={loading}
        search={false}
        options={false}
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{
          emptyText: priceList ? '暂无可查看的收费关联' : '请选择参考价目表',
        }}
        toolBarRender={() => [
          <Select
            key="price"
            aria-label="参考价目表"
            placeholder="选择参考价目表"
            style={{ width: 240 }}
            showSearch={{ filterOption: false, onSearch: setKeyword }}
            options={options}
            value={priceList}
            onChange={setPriceList}
            allowClear
          />,
        ]}
      />
    </>
  );
}
