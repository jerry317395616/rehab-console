import {
  ModalForm,
  type ProColumns,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Space, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import * as S from './service';

type Filters = { company?: string; keyword?: string; enabled?: '1' | '0' };
type Fields = { company: string; category_title: string };
type Editor = { row?: S.Category; parent?: S.Category };
const required = [{ required: true, message: '请填写或选择此项' }];

export default function CategoryDirectory({
  company,
  initialOptions,
  onOptions,
}: {
  company?: string;
  initialOptions?: S.Options;
  onOptions?: (data: S.Options) => void;
}) {
  const { message, modal } = App.useApp();
  const [data, setData] = useState(initialOptions);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!initialOptions);
  const [filters, setFilters] = useState<Filters>({ company });
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [editor, setEditor] = useState<Editor>();
  const categories = data?.categories ?? [];

  useEffect(() => {
    if (initialOptions) return;
    let active = true;
    S.options()
      .then((result) => {
        if (active) setData(result);
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
  }, [initialOptions]);

  async function refresh() {
    setError('');
    setLoading(true);
    try {
      const result = await S.options();
      setData(result);
      onOptions?.(result);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  const keyword = filters.keyword?.trim().toLocaleLowerCase();
  const matches = (item: S.Category) =>
    (filters.enabled == null ||
      String(Number(!!item.enabled)) === String(filters.enabled)) &&
    (!keyword || item.category_title.toLocaleLowerCase().includes(keyword));

  const children = new Map<string, S.Category[]>();
  for (const item of categories) {
    if (!item.parent_category || !matches(item)) continue;
    const siblings = children.get(item.parent_category) ?? [];
    siblings.push(item);
    children.set(item.parent_category, siblings);
  }
  const rows = categories
    .filter(
      (item) =>
        !item.parent_category &&
        (!filters.company || item.company === filters.company) &&
        (matches(item) || children.has(item.name)),
    )
    .map((item) => ({ ...item, children: children.get(item.name) }));

  async function store(
    values: Fields & { parent_category?: string; enabled: number },
    row?: S.Category,
  ) {
    try {
      await S.saveCategory({
        values,
        name: row?.name,
        expected: row?.modified,
      });
    } catch (reason) {
      message.error(errorMessage(reason));
      return false;
    }
    message.success('分类已保存');
    await refresh();
    return true;
  }

  function changeStatus(row: S.Category) {
    const enabled = row.enabled ? 0 : 1;
    const action = enabled ? '启用' : '停用';
    const activeChildren = categories.some(
      (item) => item.parent_category === row.name && item.enabled,
    );
    if (!enabled && activeChildren) {
      modal.info({
        title: '此分类还有启用中的子分类',
        content: '请先停用该分类下仍在使用的子分类。',
      });
      return;
    }
    modal.confirm({
      title: `${action}「${row.category_title}」`,
      content: enabled
        ? '启用后，该机构的模板可以选择此分类。'
        : '停用后，新增模板无法选择此分类，已有模板仍保留分类记录。',
      okText: action,
      onOk: async () => {
        if (
          !(await store(
            {
              company: row.company,
              category_title: row.category_title,
              parent_category: row.parent_category,
              enabled,
            },
            row,
          ))
        )
          throw new Error('分类状态未更新');
      },
    });
  }

  const columns: ProColumns<S.Category>[] = [
    { title: '分类名称', dataIndex: 'keyword', hideInTable: true },
    { title: '分类名称', dataIndex: 'category_title', search: false },
    {
      title: '机构',
      dataIndex: 'company',
      valueType: 'select',
      fieldProps: { options: data?.companies },
    },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      valueType: 'select',
      valueEnum: { '1': '已启用', '0': '已停用' },
      render: (_, item) => (
        <Tag color={item.enabled ? 'success' : 'default'}>
          {item.enabled ? '已启用' : '已停用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      hideInTable: !data?.can_manage_categories,
      render: (_, item) => (
        <Space>
          <Button type="link" onClick={() => setEditor({ row: item })}>
            编辑
          </Button>
          {!item.parent_category && item.enabled !== 0 && (
            <Button type="link" onClick={() => setEditor({ parent: item })}>
              新增子分类
            </Button>
          )}
          <Button type="link" onClick={() => changeStatus(item)}>
            {item.enabled ? '停用' : '启用'}
          </Button>
        </Space>
      ),
    },
  ];

  const row = editor?.row;
  const parent = editor?.parent;
  const parentName = row?.parent_category ?? parent?.name;
  const parentTitle =
    parent?.category_title ??
    categories.find((item) => item.name === parentName)?.category_title;

  return (
    <>
      {error && <Alert showIcon type="error" title={error} />}
      <ProTable<S.Category, Filters>
        rowKey="name"
        columns={columns}
        loading={loading}
        pagination={false}
        dataSource={rows}
        search={{ defaultCollapsed: false }}
        form={{ initialValues: { company } }}
        onSubmit={(next) => {
          setFilters(next);
          setCollapsed([]);
        }}
        onReset={() => {
          setFilters({ company });
          setCollapsed([]);
        }}
        options={{ reload: refresh }}
        expandable={{
          expandedRowKeys: rows
            .filter((item) => item.children && !collapsed.includes(item.name))
            .map((item) => item.name),
          onExpand: (expanded, item) =>
            setCollapsed((keys) =>
              expanded
                ? keys.filter((key) => key !== item.name)
                : [...keys, item.name],
            ),
        }}
        toolBarRender={() =>
          data?.can_manage_categories
            ? [
                <Button
                  key="create"
                  type="primary"
                  onClick={() => setEditor({})}
                >
                  新增一级分类
                </Button>,
              ]
            : []
        }
      />
      {editor && (
        <ModalForm<Fields>
          open
          title={row ? '编辑分类' : parent ? '新增子分类' : '新增一级分类'}
          initialValues={{
            company: row?.company ?? parent?.company ?? filters.company,
            category_title: row?.category_title,
          }}
          submitter={{ searchConfig: { submitText: '保存' } }}
          onOpenChange={(visible) => {
            if (!visible) setEditor(undefined);
          }}
          onFinish={(values) =>
            store(
              {
                ...values,
                company: row?.company ?? parent?.company ?? values.company,
                parent_category: parentName,
                enabled: row?.enabled ?? 1,
              },
              row,
            )
          }
        >
          <ProFormSelect
            name="company"
            label="所属机构"
            options={data?.companies}
            rules={required}
            disabled={!!row || !!parent}
          />
          {parentName && (
            <Form.Item label="上级分类">{parentTitle ?? parentName}</Form.Item>
          )}
          <ProFormText
            name="category_title"
            label="分类名称"
            rules={required}
            fieldProps={{ maxLength: 140 }}
          />
        </ModalForm>
      )}
    </>
  );
}
