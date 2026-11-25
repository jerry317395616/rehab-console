import {
  type ActionType,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { history, useLocation } from '@umijs/max';
import { App, Button, Drawer, Result, Space, Spin, Table, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import ScaleEditor from './ScaleEditor';
import ScaleReview from './ScaleReview';
import * as S from './service';

export default function ScaleBank() {
  const { message } = App.useApp();
  const location = useLocation();
  const table = useRef<ActionType>(null);
  const target = new URLSearchParams(location.search).get('scaleVersion') || '';
  const [rights, setRights] = useState({ can_author: false, can_new: false });
  const [editor, setEditor] = useState<S.EditorData>();
  const [editorLoading, setEditorLoading] = useState(false);
  const [detail, setDetail] = useState<S.Version>();
  const [failure, setFailure] = useState('');
  const [catalogFailure, setCatalogFailure] = useState('');
  const [versions, setVersions] = useState<S.Header[]>();
  const [attempt, setAttempt] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const reload = () => table.current?.reload();
  const navigate = (name = '') => {
    const params = new URLSearchParams(location.search);
    if (name) params.set('scaleVersion', name);
    else params.delete('scaleVersion');
    const search = params.toString();
    history.push({
      pathname: location.pathname,
      search: search ? `?${search}` : '',
    });
  };
  useEffect(() => {
    if (!target) return;
    let current = true;
    setFailure('');
    S.version(target).then(
      (value) => {
        if (current) setDetail(value);
      },
      (error) => {
        if (current) setFailure(errorMessage(error));
      },
    );
    return () => {
      current = false;
    };
  }, [target, attempt]);
  const openEditor = async (query: Parameters<typeof S.editor>[0]) => {
    setEditorLoading(true);
    try {
      setEditor(await S.editor(query));
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setEditorLoading(false);
    }
  };
  const showHistory = async (template: string) => {
    setHistoryLoading(true);
    try {
      setVersions(await S.history(template));
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };
  const columns: ProColumns<S.CatalogRow>[] = [
    { title: '量表名称', dataIndex: 'keyword', hideInTable: true },
    { title: '量表名称', dataIndex: 'title', search: false },
    { title: '题目数', dataIndex: 'count', search: false, width: 84 },
    {
      title: '总分范围',
      search: false,
      width: 100,
      render: (_, row) => row.range?.join('–') || '—',
    },
    {
      title: '当前发布',
      search: false,
      width: 100,
      render: (_, row) =>
        row.active ? <Tag color="green">V{row.active.version}</Tag> : '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: S.labels,
      render: (_, row) => (
        <Tag color={S.colors[row.status]}>
          {row.revision ? `V${row.revision.version} ` : ''}
          {S.labels[row.status]}
        </Tag>
      ),
    },
    { title: '更新时间', dataIndex: 'modified', search: false, width: 172 },
    {
      title: '操作',
      valueType: 'option',
      render: (_, row) => {
        const version = row.revision || row.latest;
        return (
          <Space size={4} wrap>
            {version && (
              <Button
                size="small"
                type="link"
                onClick={() => navigate(version.name)}
              >
                {version.status === 'Pending Review' ? '进入审核' : '查看版本'}
              </Button>
            )}
            {rights.can_author &&
              version?.status === 'Draft' &&
              version.mine && (
                <Button
                  size="small"
                  type="link"
                  disabled={editorLoading}
                  onClick={() => openEditor({ name: version.name })}
                >
                  继续编辑
                </Button>
              )}
            {rights.can_author &&
              version?.status === 'Rejected' &&
              version.mine && (
                <Button
                  size="small"
                  type="link"
                  disabled={editorLoading}
                  onClick={() => openEditor({ copy_from: version.name })}
                >
                  重新修订
                </Button>
              )}
            {rights.can_author &&
              row.template &&
              !['Draft', 'Pending Review', 'Rejected'].includes(row.status) && (
                <Button
                  size="small"
                  type="link"
                  disabled={editorLoading}
                  onClick={() => openEditor({ template: row.template })}
                >
                  修订
                </Button>
              )}
            {row.template && version && (
              <Button
                size="small"
                type="link"
                disabled={historyLoading}
                onClick={() => showHistory(row.template)}
              >
                版本历史
              </Button>
            )}
          </Space>
        );
      },
    },
  ];
  if (target) {
    if (failure) {
      return (
        <Result
          status="warning"
          title="暂时无法读取量表修订"
          subTitle={failure}
          extra={
            <Space>
              <Button onClick={() => navigate()}>返回量表列表</Button>
              <Button
                type="primary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                重试
              </Button>
            </Space>
          }
        />
      );
    }
    if (detail?.profile.name !== target) return <Spin />;
    return (
      <ScaleReview
        key={target}
        detail={detail}
        onBack={() => navigate()}
        onChange={setDetail}
      />
    );
  }
  return (
    <>
      {catalogFailure && (
        <Result
          status="warning"
          title="无法读取量表题库"
          subTitle={catalogFailure}
        />
      )}
      <ProTable<S.CatalogRow>
        actionRef={table}
        rowKey="key"
        columns={columns}
        scroll={{ x: 900 }}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 20, showSizeChanger: false }}
        request={async ({ keyword, status, current, pageSize }) => {
          try {
            const result = await S.catalog({
              keyword,
              status,
              current,
              page_size: pageSize,
            });
            setRights({
              can_author: result.can_author,
              can_new: result.can_new,
            });
            setCatalogFailure('');
            return { ...result, success: true };
          } catch (error) {
            setCatalogFailure(errorMessage(error));
            return { data: [], total: 0, success: false };
          }
        }}
        toolBarRender={() =>
          rights.can_new
            ? [
                <Button
                  key="new"
                  type="primary"
                  loading={editorLoading}
                  onClick={() => openEditor({})}
                >
                  新增量表
                </Button>,
              ]
            : []
        }
      />
      {editor && (
        <ScaleEditor
          data={editor}
          onClose={() => setEditor(undefined)}
          onSave={reload}
          onSubmit={(name) => {
            setEditor(undefined);
            navigate(name);
          }}
        />
      )}
      <Drawer
        title="量表版本历史"
        open={!!versions}
        onClose={() => setVersions(undefined)}
        size="min(740px, 100vw)"
      >
        <Table
          rowKey="name"
          size="small"
          dataSource={versions}
          scroll={{ x: 500 }}
          pagination={{ hideOnSinglePage: true }}
          columns={[
            { title: '版本', render: (_, row) => `V${row.version}` },
            {
              title: '状态',
              render: (_, row) => (
                <Tag color={S.colors[row.status]}>{S.labels[row.status]}</Tag>
              ),
            },
            { title: '编制人', dataIndex: 'created_by' },
            { title: '更新时间', dataIndex: 'modified' },
            {
              title: '操作',
              render: (_, row) => (
                <Button
                  type="link"
                  onClick={() => {
                    setVersions(undefined);
                    navigate(row.name);
                  }}
                >
                  查看
                </Button>
              ),
            },
          ]}
        />
      </Drawer>
    </>
  );
}
