import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Drawer,
  Grid,
  Input,
  Result,
  Row,
  Select,
  Space,
  Tree,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { errorMessage } from './feedback';
import ItemEditor, { type ItemEditorState } from './ItemEditor';
import {
  type ChargeItem,
  type ChargeOptions,
  type Group,
  getGroups,
  getItems,
  getOptions,
  type LinkOption,
  post,
  searchPriceOptions,
} from './service';

type GroupNode = { key: string; title: string; children: GroupNode[] };
export function groupTree(rows: Group[]): GroupNode[] {
  const nodes = new Map(
    rows.map((row) => [
      row.name,
      { key: row.name, title: row.name, children: [] as GroupNode[] },
    ]),
  );
  const roots: GroupNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.name);
    if (!node) continue;
    const parent = row.parent_item_group
      ? nodes.get(row.parent_item_group)
      : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
export default function ChargeCatalog() {
  const actionRef = useRef<ActionType>(undefined);
  const [options, setOptions] = useState<ChargeOptions>();
  const [groups, setGroups] = useState<Group[]>([]);
  const [group, setGroup] = useState<string>();
  const [priceList, setPriceList] = useState<string>();
  const [priceOptions, setPriceOptions] = useState<LinkOption[]>([]);
  const [editor, setEditor] = useState<ItemEditorState>();
  const [treeOpen, setTreeOpen] = useState(false);
  const [failure, setFailure] = useState<'403' | '500'>();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string>();
  const { modal, message } = App.useApp();
  const screens = Grid.useBreakpoint();
  useEffect(() => {
    let active = true;
    Promise.all([getOptions(), getGroups()])
      .then(([permissions, tree]) => {
        if (active) {
          setOptions(permissions);
          setGroups(tree.nodes);
        }
      })
      .catch((reason) => {
        if (active)
          setFailure(
            statusOf(reason) === 401 || statusOf(reason) === 403
              ? '403'
              : '500',
          );
        errorMessage(reason);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(() => {
    if (!options?.price.can_read) return;
    let active = true;
    searchPriceOptions('price_list')
      .then((rows) => {
        if (active) setPriceOptions(rows);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [options]);
  const readable = new Set(options?.item.read_fields || []);
  const tree = (
    <>
      <Button
        type="link"
        onClick={() => {
          setGroup(undefined);
          setTreeOpen(false);
        }}
      >
        全部收费分组
      </Button>
      <Tree
        key={groups.length}
        aria-label="收费项目分组"
        blockNode
        defaultExpandAll
        height={520}
        treeData={groupTree(groups)}
        selectedKeys={group ? [group] : []}
        styles={{ root: { overflowX: 'auto' } }}
        onSelect={(keys) => {
          setGroup(keys[0] ? String(keys[0]) : undefined);
          setTreeOpen(false);
        }}
        titleRender={(node) => (
          <span
            title={node.title}
            style={{
              display: 'inline-block',
              maxWidth: 210,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.title}
          </span>
        )}
      />
    </>
  );
  const columns: ProColumns<ChargeItem>[] = [
    {
      title: '编码或名称',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '收费编码或名称', maxLength: 120 },
    },
    {
      title: '核价日期',
      dataIndex: 'on_date',
      valueType: 'date',
      hideInTable: true,
      search: priceList ? undefined : false,
    },
    {
      title: '收费编码',
      dataIndex: 'name',
      search: false,
      sorter: true,
      width: 200,
    },
    {
      title: '收费名称',
      dataIndex: 'item_name',
      hideInTable: !readable.has('item_name'),
      search: false,
      sorter: true,
      width: 200,
    },
    {
      title: '项目分组',
      dataIndex: 'item_group',
      hideInTable: !readable.has('item_group'),
      search: false,
      width: 150,
    },
    {
      title: '计价单位',
      dataIndex: 'stock_uom',
      hideInTable: !readable.has('stock_uom'),
      search: false,
      width: 100,
    },
    {
      title: '所选价目表价格',
      dataIndex: 'price',
      hideInTable: !options?.price.can_read,
      search: false,
      width: 180,
      render: (_, row) =>
        !priceList
          ? '请选择价目表'
          : row.price?.status === 'priced'
            ? `${row.price.amount} ${row.price.currency} / ${row.price.uom}`
            : row.price?.status === 'ambiguous'
              ? '价格有效期冲突'
              : '未定价',
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      hideInTable: !readable.has('disabled'),
      search: readable.has('disabled') ? undefined : false,
      valueType: 'select',
      valueEnum: {
        0: { text: '启用', status: 'Success' },
        1: { text: '停用', status: 'Default' },
      },
      width: 100,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: screens.lg ? 'right' : undefined,
      width: 240,
      render: (_, row) => [
        <Button
          key="view"
          type="link"
          onClick={() => setEditor({ kind: 'view', itemCode: row.name })}
        >
          查看
        </Button>,
        row.can_edit && (
          <Button
            key="edit"
            type="link"
            onClick={() => setEditor({ kind: 'edit', itemCode: row.name })}
          >
            编辑
          </Button>
        ),
        options?.price.can_read && (
          <Button
            key="price"
            type="link"
            onClick={() => setEditor({ kind: 'prices', itemCode: row.name })}
          >
            价格
          </Button>
        ),
        row.can_delete && (
          <Button
            key="delete"
            type="link"
            danger
            onClick={() => {
              let typed = '';
              const dialog = modal.confirm({
                title: '删除收费项目',
                content: (
                  <>
                    <p>
                      请输入完整收费编码：{row.name}
                      。存在关联的项目请使用停用操作。
                    </p>
                    <Input
                      aria-label="确认删除收费编码"
                      autoComplete="off"
                      onChange={(event) => {
                        typed = event.target.value;
                        dialog.update({
                          okButtonProps: {
                            danger: true,
                            disabled: typed !== row.name,
                          },
                        });
                      }}
                    />
                  </>
                ),
                okText: '删除收费项目',
                cancelText: '取消',
                okButtonProps: { danger: true, disabled: true },
                onOk: async () => {
                  try {
                    await post('charge_catalog_api', 'delete_item', {
                      item_code: row.name,
                      modified: row.modified,
                      confirm_name: typed,
                    });
                    void message.success('收费项目已删除。');
                    void actionRef.current?.reload();
                  } catch (reason) {
                    setError(errorMessage(reason));
                    throw reason;
                  }
                },
              });
            }}
          >
            删除
          </Button>
        ),
      ],
    },
  ];
  if (failure)
    return (
      <Result
        status={failure}
        title={
          failure === '403'
            ? '当前账号没有收费项目查看权限'
            : '暂时无法读取收费项目'
        }
        extra={
          <Button
            onClick={() => {
              setFailure(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            重新加载
          </Button>
        }
      />
    );
  return (
    <>
      {error && (
        <Alert
          showIcon
          type="error"
          title={error}
          closable={{ onClose: () => setError(undefined) }}
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[16, 16]}>
        {screens.lg && options?.can_read_groups && (
          <Col span={6}>
            <Card title="收费项目分组">{tree}</Card>
          </Col>
        )}
        <Col
          span={screens.lg && options?.can_read_groups ? 18 : 24}
          style={{ minWidth: 0 }}
        >
          <ProTable<ChargeItem>
            actionRef={actionRef}
            rowKey="name"
            columns={columns}
            request={getItems}
            params={{ item_group: group, price_list: priceList }}
            headerTitle="收费项目目录"
            form={{ name: 'charge-catalog-search' }}
            search={{ defaultCollapsed: false, labelWidth: 'auto' }}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            scroll={{ x: 1250 }}
            toolbar={{ multipleLine: !screens.lg }}
            toolBarRender={() => [
              <Space key="actions" wrap>
                {!screens.lg && options?.can_read_groups && (
                  <Button key="groups" onClick={() => setTreeOpen(true)}>
                    项目分组
                  </Button>
                )}
                {options?.price.can_read && (
                  <Select
                    key="prices"
                    aria-label="收费价目表"
                    placeholder="选择销售价目表"
                    style={{ width: 210 }}
                    allowClear
                    showSearch={{
                      filterOption: false,
                      onSearch: (keyword) => {
                        void searchPriceOptions('price_list', keyword)
                          .then(setPriceOptions)
                          .catch((reason) => setError(errorMessage(reason)));
                      },
                    }}
                    options={priceOptions}
                    value={priceList}
                    onChange={setPriceList}
                  />
                )}
                {options?.item.can_create && (
                  <Button
                    key="create"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setEditor({ kind: 'create' })}
                  >
                    新增收费项目
                  </Button>
                )}
              </Space>,
            ]}
            onRequestError={(reason) => {
              errorMessage(reason);
              setFailure(
                statusOf(reason) === 401 || statusOf(reason) === 403
                  ? '403'
                  : '500',
              );
            }}
          />
        </Col>
      </Row>
      <Drawer
        title="收费项目分组"
        open={treeOpen && !screens.lg}
        size="min(360px, 100%)"
        onClose={() => setTreeOpen(false)}
      >
        {tree}
      </Drawer>
      <ItemEditor
        editor={editor}
        options={options}
        onClose={() => setEditor(undefined)}
        onSaved={() => {
          void actionRef.current?.reload();
        }}
      />
    </>
  );
}
