import { MoreOutlined, PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Grid,
  Result,
  Row,
  Select,
  Tree,
  Typography,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import DepartmentActionModal, {
  type DepartmentAction,
} from './DepartmentActionModal';
import DepartmentEditorDrawer, {
  type DepartmentEditor,
} from './DepartmentEditorDrawer';
import {
  type DepartmentNode,
  type DepartmentOptions,
  type DepartmentRow,
  type DepartmentSearch,
  getDepartmentOptions,
  getDepartments,
  getDepartmentTree,
} from './service';
import { departmentTree } from './tree';

export default function DepartmentList() {
  const actionRef = useRef<ActionType>(undefined);
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<DepartmentOptions>();
  const [nodes, setNodes] = useState<DepartmentNode[]>([]);
  const [company, setCompany] = useState<string>();
  const [department, setDepartment] = useState<string>();
  const [editor, setEditor] = useState<DepartmentEditor>();
  const [action, setAction] = useState<DepartmentAction>();
  const [treeOpen, setTreeOpen] = useState(false);
  const [failure, setFailure] = useState<'403' | '500'>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([getDepartmentOptions(), getDepartmentTree()])
      .then(([permissions, tree]) => {
        if (!active) return;
        setOptions(permissions);
        setNodes(tree.nodes);
        setDepartment((current) =>
          tree.nodes.some((node) => node.name === current)
            ? current
            : undefined,
        );
      })
      .catch((reason) => {
        if (active)
          setFailure(
            statusOf(reason) === 401 || statusOf(reason) === 403
              ? '403'
              : '500',
          );
        if (statusOf(reason) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const readable = new Set(options?.read_fields || []);
  const companies = [
    ...new Set(nodes.flatMap((node) => (node.company ? [node.company] : []))),
  ];
  const visibleNodes = company
    ? nodes.filter((node) => node.company === company)
    : nodes;
  const selected = nodes.find((node) => node.name === department);
  const tree = (
    <>
      {readable.has('company') && (
        <Select
          aria-label="按公司筛选部门"
          placeholder="全部公司"
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          value={company}
          options={companies.map((value) => ({ value, label: value }))}
          style={{ width: '100%', marginBottom: 12 }}
          onChange={(value) => {
            setCompany(value);
            setDepartment(undefined);
          }}
        />
      )}
      <Button
        type="link"
        onClick={() => {
          setDepartment(undefined);
          setTreeOpen(false);
        }}
      >
        查看{company ? '当前公司' : '全部'}部门
      </Button>
      <Tree
        key={`${company || ''}:${attempt}:${nodes.length}`}
        aria-label="部门树"
        blockNode
        defaultExpandAll
        height={520}
        styles={{ root: { overflowX: 'auto' } }}
        titleRender={(node) => (
          <span
            title={node.title}
            style={{
              display: 'inline-block',
              maxWidth: 210,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              verticalAlign: 'top',
            }}
          >
            {node.title}
          </span>
        )}
        treeData={departmentTree(visibleNodes)}
        selectedKeys={
          department ? [`d:${department}`] : company ? [`c:${company}`] : []
        }
        onSelect={(_, info) => {
          setDepartment(info.node.department);
          if (info.node.company) setCompany(info.node.company);
          setTreeOpen(false);
        }}
      />
      {!visibleNodes.length && (
        <Typography.Text type="secondary">当前范围暂无可见部门</Typography.Text>
      )}
    </>
  );
  const columns: ProColumns<DepartmentRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: '部门名称或编号',
        maxLength: 120,
        allowClear: true,
      },
    },
    {
      title: '部门名称',
      dataIndex: 'name',
      search: false,
      sorter: true,
      width: 210,
      render: (_, row) => (
        <div>
          <div>{row.department_name || row.name}</div>
          {row.department_name && row.department_name !== row.name && (
            <Typography.Text type="secondary">{row.name}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: '所属公司',
      dataIndex: 'company',
      search: false,
      hideInTable: !readable.has('company'),
      width: 180,
    },
    {
      title: '上级部门',
      dataIndex: 'parent_department',
      search: false,
      hideInTable: !readable.has('parent_department'),
      width: 190,
    },
    {
      title: '部门类型',
      dataIndex: 'is_group',
      hideInTable: !readable.has('is_group'),
      search: readable.has('is_group') ? undefined : false,
      valueType: 'select',
      valueEnum: { 0: { text: '普通部门' }, 1: { text: '分组部门' } },
      width: 100,
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
      width: 90,
    },
    {
      title: '更新时间',
      dataIndex: 'modified',
      valueType: 'dateTime',
      search: false,
      sorter: true,
      defaultSortOrder: 'descend',
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      fixed: 'right',
      width: 170,
      render: (_, row) => {
        const items = [
          ...(options?.can_create &&
          row.company &&
          row.is_group &&
          !row.disabled
            ? [{ key: 'child', label: '新增下级部门' }]
            : []),
          ...(row.can_rename ? [{ key: 'rename', label: '重命名' }] : []),
          ...(row.can_delete
            ? [{ key: 'delete', label: '删除', danger: true }]
            : []),
        ];
        return [
          <Button
            key="view"
            type="link"
            onClick={() => setEditor({ kind: 'view', department: row.name })}
          >
            查看
          </Button>,
          row.can_edit && (
            <Button
              key="edit"
              type="link"
              onClick={() => setEditor({ kind: 'edit', department: row.name })}
            >
              编辑
            </Button>
          ),
          items.length > 0 && (
            <Dropdown
              key="more"
              trigger={['click']}
              menu={{
                items,
                onClick: ({ key }) => {
                  if (key === 'child')
                    setEditor({
                      kind: 'create',
                      company: row.company || undefined,
                      parent: row.name,
                    });
                  else
                    setAction({
                      kind: key === 'rename' ? 'rename' : 'delete',
                      department: row.name,
                    });
                },
              }}
            >
              <Button
                type="text"
                aria-label={`更多操作 ${row.name}`}
                icon={<MoreOutlined />}
              />
            </Dropdown>
          ),
        ];
      },
    },
  ];
  if (failure)
    return (
      <Result
        status={failure}
        title={
          failure === '403'
            ? '当前账号没有查看部门的权限'
            : '暂时无法读取部门列表'
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
  const saved = () => {
    // A rename/delete can invalidate the tree scope before the refreshed tree arrives.
    setDepartment(undefined);
    setAttempt((value) => value + 1);
    if (!department) void actionRef.current?.reload();
  };
  return (
    <>
      <Row gutter={[16, 16]}>
        {screens.lg && (
          <Col span={6}>
            <Card title="组织结构">{tree}</Card>
          </Col>
        )}
        <Col span={screens.lg ? 18 : 24} style={{ minWidth: 0 }}>
          <ProTable<DepartmentRow, DepartmentSearch>
            actionRef={actionRef}
            rowKey="name"
            columns={columns}
            request={getDepartments}
            params={{ company, department }}
            headerTitle={
              selected
                ? `${selected.department_name || selected.name}及下级`
                : '部门列表'
            }
            form={{ name: 'department-list-search' }}
            search={{ labelWidth: 'auto', defaultCollapsed: false }}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            scroll={{ x: 1170 }}
            dateFormatter="string"
            toolBarRender={() => [
              !screens.lg && (
                <Button key="tree" onClick={() => setTreeOpen(true)}>
                  组织结构
                </Button>
              ),
              options?.can_create && (
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setEditor({
                      kind: 'create',
                      company,
                      parent:
                        selected?.is_group &&
                        !selected.disabled &&
                        selected.company
                          ? selected.name
                          : undefined,
                    })
                  }
                >
                  新增部门
                </Button>
              ),
            ]}
            onRequestError={(reason) => {
              const status = statusOf(reason);
              setFailure(status === 401 || status === 403 ? '403' : '500');
              if (status === 401)
                window.dispatchEvent(new Event('rehab:session-expired'));
            }}
          />
        </Col>
      </Row>
      <Drawer
        title="组织结构"
        open={treeOpen && !screens.lg}
        size="min(360px, 100%)"
        onClose={() => setTreeOpen(false)}
      >
        {tree}
      </Drawer>
      <DepartmentEditorDrawer
        editor={editor}
        onClose={() => setEditor(undefined)}
        onSaved={saved}
      />
      <DepartmentActionModal
        action={action}
        onClose={() => setAction(undefined)}
        onSaved={saved}
      />
    </>
  );
}
