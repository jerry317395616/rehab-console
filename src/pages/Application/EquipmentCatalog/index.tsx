import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Grid, Space, Tag } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import DeviceEditor, { type Editor } from './DeviceEditor';
import StateModal from './StateModal';
import {
  api,
  type Device,
  errorMessage,
  type List,
  links,
  type Options,
} from './service';

export default function EquipmentCatalog() {
  const action = useRef<ActionType>(undefined);
  const screens = Grid.useBreakpoint();
  const [options, setOptions] = useState<Options>();
  const [error, setError] = useState<string>();
  const [editor, setEditor] = useState<Editor>();
  const [state, setState] = useState<Device>();
  useEffect(() => {
    let active = true;
    api<Options>('get_options')
      .then((value) => {
        if (active) setOptions(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const visible = new Set(options?.read_fields || []);
  const columns: ProColumns<Device>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '设备编号或名称', maxLength: 120 },
    },
    {
      title: '设备编号',
      dataIndex: 'display_label',
      search: false,
      width: 160,
      hideInTable: !visible.has('display_label'),
    },
    {
      title: '设备名称',
      dataIndex: 'resource_name',
      search: false,
      width: 200,
      hideInTable: !visible.has('resource_name'),
      render: (_, row) => (
        <Button
          type="link"
          onClick={() => setEditor({ kind: 'view', name: row.name })}
        >
          {row.resource_name || row.name}
        </Button>
      ),
    },
    ...['equipment_category', 'company', 'department'].map((field) => ({
      title: (
        {
          equipment_category: '设备类型',
          company: '所属机构',
          department: '医疗科室',
        } as Record<string, string>
      )[field],
      dataIndex: field,
      valueType: 'select' as const,
      width: 180,
      hideInTable: !visible.has(field),
      search: visible.has(field) ? undefined : false,
      request: ({ keyWords }: { keyWords?: string }) =>
        links(field, keyWords || ''),
      fieldProps: { showSearch: true },
    })),
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 120,
      valueEnum: {
        0: { text: '待启用 / 停用', status: 'Default' },
        1: { text: '启用', status: 'Success' },
      },
      hideInTable: !visible.has('enabled'),
      search: visible.has('enabled') ? undefined : false,
    },
    {
      title: '当前运行限制',
      dataIndex: 'health',
      search: false,
      width: 220,
      render: (_, row) => (
        <Tag
          color={row.health?.state === 'normal' ? 'success' : 'warning'}
          title={row.health?.reasons.join('；')}
        >
          {row.health?.state === 'normal'
            ? '未发现限制'
            : row.health?.reasons.join('；') || '需要核验'}
        </Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'modified',
      valueType: 'dateTime',
      search: false,
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: screens.md ? 'right' : undefined,
      render: (_, row) => (
        <Space wrap>
          <Button
            type="link"
            onClick={() => setEditor({ kind: 'view', name: row.name })}
          >
            详情
          </Button>
          {row.can_edit && !row.edit_blocked && (
            <>
              <Button
                type="link"
                onClick={() => setEditor({ kind: 'edit', name: row.name })}
              >
                编辑
              </Button>
              {visible.has('enabled') && (
                <Button type="link" onClick={() => setState(row)}>
                  {row.enabled ? '停用' : '启用'}
                </Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];
  return (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      <ProTable<Device>
        actionRef={action}
        rowKey="name"
        columns={columns}
        scroll={{ x: 'max-content' }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        request={async (params) => {
          try {
            const result = await api<List<Device>>('get_devices', {
              current: params.current,
              page_size: params.pageSize,
              keyword: params.keyword,
              company: params.company,
              department: params.department,
              equipment_category: params.equipment_category,
              enabled: params.enabled,
            });
            setError(undefined);
            return result;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() =>
          options?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({ kind: 'create' })}
                >
                  新增设备
                </Button>,
              ]
            : []
        }
      />
      <DeviceEditor
        editor={editor}
        options={options}
        onClose={() => setEditor(undefined)}
        onSaved={() => action.current?.reload()}
      />
      <StateModal
        device={state}
        onClose={() => setState(undefined)}
        onSaved={() => action.current?.reload()}
      />
    </>
  );
}
