import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Alert, Button, Space, Tabs } from 'antd';
import { useEffect, useRef, useState } from 'react';
import EquipmentCatalog from '../EquipmentCatalog';
import RoomEditor, { type Editor } from './RoomEditor';
import { api, errorMessage, links, type Options, type Room } from './service';

export default function TreatmentResources() {
  const table = useRef<ActionType>(undefined);
  const [options, setOptions] = useState<Options>();
  const [editor, setEditor] = useState<Editor>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    api<Options>('get_options')
      .then((value) => active && setOptions(value))
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, []);
  const fields = new Set(options?.read_fields || []);
  const columns: ProColumns<Room>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '场地名称或大屏代号' },
    },
    {
      title: '场地名称',
      dataIndex: 'resource_name',
      search: false,
      hideInTable: !fields.has('resource_name'),
    },
    ...(['company', 'department'] as const).map((field) => ({
      title: field === 'company' ? '所属机构' : '医疗科室',
      dataIndex: field,
      valueType: 'select' as const,
      search: options?.link_fields.includes(field) ? undefined : false,
      hideInTable: !fields.has(field),
      request: ({ keyWords }: { keyWords?: string }) =>
        links(field, keyWords || ''),
      fieldProps: { showSearch: true, filterOption: false },
    })),
    {
      title: '治疗区域',
      dataIndex: 'area',
      search: false,
      hideInTable: !fields.has('area'),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      valueEnum: {
        0: { text: '停用', status: 'Default' },
        1: { text: '启用', status: 'Success' },
      },
      search: fields.has('enabled') ? undefined : false,
      hideInTable: !fields.has('enabled'),
    },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            onClick={() => setEditor({ mode: 'view', name: row.name })}
          >
            详情
          </Button>
          {row.can_edit && (
            <Button
              type="link"
              onClick={() => setEditor({ mode: 'edit', name: row.name })}
            >
              编辑
            </Button>
          )}
        </Space>
      ),
    },
  ];
  return (
    <Tabs
      items={[
        {
          key: 'room',
          label: '治疗场地',
          children: (
            <>
              {error && <Alert type="error" showIcon title={error} />}
              <ProTable<Room>
                rowKey="name"
                actionRef={table}
                columns={columns}
                scroll={{ x: 'max-content' }}
                search={{ labelWidth: 'auto' }}
                request={async ({
                  current,
                  pageSize,
                  keyword,
                  company,
                  department,
                  enabled,
                }) => {
                  try {
                    const value = await api<{
                      data: Room[];
                      total: number;
                      success: boolean;
                    }>('list_rooms', {
                      current,
                      page_size: pageSize,
                      keyword,
                      company,
                      department,
                      enabled,
                    });
                    setError(undefined);
                    return value;
                  } catch (reason) {
                    setError(errorMessage(reason));
                    return { success: false, data: [], total: 0 };
                  }
                }}
                toolBarRender={() =>
                  options?.can_create
                    ? [
                        <Button
                          key="create"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setEditor({ mode: 'create' })}
                        >
                          新增治疗场地
                        </Button>,
                      ]
                    : []
                }
              />
              {editor && options && (
                <RoomEditor
                  editor={editor}
                  options={options}
                  onClose={() => setEditor(undefined)}
                  onSaved={() => table.current?.reload()}
                />
              )}
            </>
          ),
        },
        { key: 'equipment', label: '治疗设备', children: <EquipmentCatalog /> },
      ]}
    />
  );
}
