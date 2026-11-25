import { PlusOutlined } from '@ant-design/icons';
import { type ActionType, ProTable } from '@ant-design/pro-components';
import { Alert, App, Button, Input, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { errorMessage } from './feedback';
import SchemeEditor, { type SchemeEditorState } from './SchemeEditor';
import { getScheme, getSchemes, post, type Scheme } from './service';

export default function SchemeList({
  orderItem,
  itemCode,
}: {
  orderItem?: string;
  itemCode?: string;
}) {
  const actionRef = useRef<ActionType>(undefined);
  const [editor, setEditor] = useState<SchemeEditorState>();
  const [error, setError] = useState<string>();
  const [canCreate, setCanCreate] = useState(false);
  const { modal, message } = App.useApp();
  return (
    <>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          closable={{ onClose: () => setError(undefined) }}
        />
      )}
      <ProTable<Scheme>
        actionRef={actionRef}
        rowKey="name"
        headerTitle="收费关联方案"
        search={false}
        params={{ order_item: orderItem, item_code: itemCode }}
        request={async (params) => {
          const result = await getSchemes(params);
          setCanCreate(Boolean(result.can_create));
          return result;
        }}
        pagination={{ defaultPageSize: 10 }}
        scroll={{ x: 1100 }}
        columns={[
          { title: '方案编号', dataIndex: 'name', width: 200 },
          {
            title: '医嘱项目',
            dataIndex: 'order_item',
            width: 150,
            hideInTable: Boolean(orderItem),
          },
          { title: '机构', dataIndex: 'company', width: 180 },
          { title: '版本', dataIndex: 'version', width: 70 },
          {
            title: '状态',
            dataIndex: 'docstatus',
            width: 100,
            render: (_, row) => (
              <Tag
                color={
                  !row.enabled
                    ? 'default'
                    : row.docstatus === 1
                      ? 'success'
                      : 'processing'
                }
              >
                {!row.enabled
                  ? '已停用'
                  : row.docstatus === 1
                    ? '已发布'
                    : '草稿'}
              </Tag>
            ),
          },
          { title: '生效日期', dataIndex: 'valid_from', width: 120 },
          { title: '截止日期', dataIndex: 'valid_upto', width: 120 },
          {
            title: '操作',
            valueType: 'option',
            fixed: 'right',
            width: 240,
            render: (_, row) => [
              <Button
                key="view"
                type="link"
                onClick={() => setEditor({ kind: 'view', name: row.name })}
              >
                查看
              </Button>,
              row.can_edit && (
                <Button
                  key="edit"
                  type="link"
                  onClick={() => setEditor({ kind: 'edit', name: row.name })}
                >
                  编辑
                </Button>
              ),
              row.can_publish && (
                <Button
                  key="publish"
                  type="link"
                  onClick={() => {
                    let typed = '';
                    const dialog = modal.confirm({
                      title: '发布收费关联方案',
                      content: (
                        <>
                          <p>
                            发布后明细保持不变。请输入完整方案编号：{row.name}
                          </p>
                          <Input
                            aria-label="确认发布方案编号"
                            onChange={(event) => {
                              typed = event.target.value;
                              dialog.update({
                                okButtonProps: { disabled: typed !== row.name },
                              });
                            }}
                          />
                        </>
                      ),
                      okButtonProps: { disabled: true },
                      okText: '确认发布',
                      cancelText: '取消',
                      onOk: async () => {
                        try {
                          await post('charge_scheme', 'publish_scheme', {
                            name: row.name,
                            modified: row.modified,
                            confirm_name: typed,
                          });
                          void message.success('收费关联方案已发布。');
                          void actionRef.current?.reload();
                        } catch (reason) {
                          setError(errorMessage(reason));
                          throw reason;
                        }
                      },
                    });
                  }}
                >
                  发布
                </Button>
              ),
              canCreate && row.docstatus === 1 && (
                <Button
                  key="copy"
                  type="link"
                  onClick={() => {
                    void getScheme(row.name)
                      .then((value) =>
                        setEditor({
                          kind: 'create',
                          orderItem: row.order_item,
                          copy: value.scheme,
                        }),
                      )
                      .catch((reason) => setError(errorMessage(reason)));
                  }}
                >
                  新增版本
                </Button>
              ),
            ],
          },
        ]}
        toolBarRender={() =>
          canCreate && !itemCode
            ? [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setEditor({ kind: 'create', orderItem })}
                >
                  新增方案
                </Button>,
              ]
            : []
        }
        onRequestError={(reason) => setError(errorMessage(reason))}
      />
      <SchemeEditor
        editor={editor}
        onClose={() => setEditor(undefined)}
        onSaved={() => {
          void actionRef.current?.reload();
        }}
      />
    </>
  );
}
