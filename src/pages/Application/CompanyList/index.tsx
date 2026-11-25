import { PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { Button, Result, Typography } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import CompanyEditorDrawer, { type CompanyEditor } from './CompanyEditorDrawer';
import {
  type CompanyOptions,
  type CompanyRow,
  type CompanySearch,
  getCompanies,
  getCompanyOptions,
} from './service';

export default function CompanyList() {
  const actionRef = useRef<ActionType>(undefined);
  const [options, setOptions] = useState<CompanyOptions>();
  const [failure, setFailure] = useState<'403' | '500'>();
  const [editor, setEditor] = useState<CompanyEditor>();
  useEffect(() => {
    let active = true;
    getCompanyOptions()
      .then((value) => {
        if (active) setOptions(value);
      })
      .catch(() => {
        if (active) setOptions(undefined);
      });
    return () => {
      active = false;
    };
  }, []);
  const readable = new Set(options?.read_fields || []);
  const columns: ProColumns<CompanyRow>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: {
        placeholder: '公司名称或简称',
        maxLength: 120,
        allowClear: true,
      },
    },
    {
      title: '公司名称',
      dataIndex: 'name',
      search: false,
      sorter: true,
      width: 240,
      render: (_, row) => (
        <div>
          <div>{row.company_name || row.name}</div>
          {row.company_name && row.company_name !== row.name && (
            <Typography.Text type="secondary">{row.name}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: '公司简称',
      dataIndex: 'abbr',
      hideInTable: !readable.has('abbr'),
      search: false,
      width: 110,
    },
    {
      title: '国家/地区',
      dataIndex: 'country',
      hideInTable: !readable.has('country'),
      search: false,
      width: 140,
    },
    {
      title: '默认币种',
      dataIndex: 'default_currency',
      hideInTable: !readable.has('default_currency'),
      search: false,
      width: 110,
    },
    {
      title: '公司类型',
      dataIndex: 'is_group',
      hideInTable: !readable.has('is_group'),
      search: readable.has('is_group') ? undefined : false,
      valueType: 'select',
      valueEnum: { 0: { text: '普通公司' }, 1: { text: '集团公司' } },
      width: 110,
    },
    {
      title: '上级公司',
      dataIndex: 'parent_company',
      hideInTable: !readable.has('parent_company'),
      search: false,
      width: 180,
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
      width: 150,
      fixed: 'right',
      render: (_, row) => [
        <Button
          key="view"
          type="link"
          onClick={() => setEditor({ kind: 'view', company: row.name })}
        >
          查看
        </Button>,
        row.can_edit && (
          <Button
            key="edit"
            type="link"
            onClick={() => setEditor({ kind: 'edit', company: row.name })}
          >
            编辑
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
            ? '当前账号没有查看公司列表的权限'
            : '暂时无法读取公司列表'
        }
        extra={<Button onClick={() => setFailure(undefined)}>重新加载</Button>}
      />
    );
  return (
    <>
      <ProTable<CompanyRow, CompanySearch>
        actionRef={actionRef}
        rowKey="name"
        columns={columns}
        request={getCompanies}
        headerTitle="公司列表"
        form={{ name: 'company-list-search' }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
        }}
        scroll={{ x: 1250 }}
        dateFormatter="string"
        toolBarRender={() =>
          options?.can_create
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({ kind: 'create' })}
                >
                  新增公司
                </Button>,
              ]
            : []
        }
        onRequestError={(error) => {
          const status = statusOf(error);
          setFailure(status === 401 || status === 403 ? '403' : '500');
          if (status === 401)
            window.dispatchEvent(new Event('rehab:session-expired'));
        }}
      />
      <CompanyEditorDrawer
        editor={editor}
        onClose={() => setEditor(undefined)}
        onSaved={() => {
          void actionRef.current?.reload();
        }}
      />
    </>
  );
}
