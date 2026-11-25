import {
  type ActionType,
  DrawerForm,
  ModalForm,
  type ProColumns,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Drawer,
  Form,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import CategoryDirectory from './CategoryDirectory';
import * as S from './service';
import WriterEditor from './WriterEditor';

const required = [{ required: true, message: '请填写或选择此项' }];
const actions = {
  submit: '提交审核',
  publish: '发布个人模板',
  approve: '审核通过',
  reject: '审核驳回',
  revise: '新建版本',
  discard: '作废草稿',
  withdraw: '停用版本',
};
type Action = keyof typeof actions;

export default function MedicalTemplates() {
  const { message, modal } = App.useApp();
  const table = useRef<ActionType>(null);
  const [form] = Form.useForm<S.Values>();
  const [options, setOptions] = useState<S.Options>();
  const [optionsError, setOptionsError] = useState('');
  const [draft, setDraft] = useState<{ row?: S.Detail; copy?: S.Detail }>();
  const [previous, setPrevious] = useState<S.Detail>();
  const [categoryDirectory, setCategoryDirectory] = useState<{
    company?: string;
  }>();
  const [sample, setSample] = useState<S.Preview>();
  const [review, setReview] = useState<'approve' | 'reject'>();
  const [writer, setWriter] = useState<S.WriterSession>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const row = draft?.row;
  const editable = !row || row.can_edit;
  const categories = options?.categories ?? [];
  const categoryLabel = (item: S.Category) =>
    [
      categories.find((parent) => parent.name === item.parent_category)
        ?.category_title,
      item.category_title,
    ]
      .filter(Boolean)
      .join(' / ');

  useEffect(() => {
    S.options()
      .then(setOptions)
      .catch((reason) => setOptionsError(errorMessage(reason)));
  }, []);

  function open(next?: { row?: S.Detail; copy?: S.Detail }) {
    setDraft(next);
    setPrevious(undefined);
    setDirty(false);
  }

  async function view(name: string) {
    try {
      const detail = await S.detail(name);
      open({ row: detail });
      if (detail.previous_template) {
        setPrevious(await S.detail(detail.previous_template));
      }
    } catch (reason) {
      message.error(errorMessage(reason));
    }
  }

  async function transition(action: Action, note?: string) {
    if (!row || dirty) return false;
    try {
      const updated = await S.transition({
        name: row.name,
        expected: row.modified,
        action,
        note,
      });
      open({ row: updated });
      table.current?.reload();
      message.success(`${actions[action]}已完成`);
      return true;
    } catch (reason) {
      message.error(errorMessage(reason));
      return false;
    }
  }

  function confirm(action: Action) {
    if (action === 'approve' || action === 'reject') {
      setReview(action);
      return;
    }
    modal.confirm({
      title: actions[action],
      content: row?.template_title,
      onOk: async () => {
        if (!(await transition(action))) throw new Error('模板状态未更新');
      },
    });
  }

  async function save(values: S.Values) {
    try {
      const updated = await S.save({
        values,
        name: row?.name,
        expected: row?.modified,
        copied_from: draft?.copy?.name,
        writer: options?.writer_ready ? '1' : '0',
      });
      open({ row: updated });
      table.current?.reload();
      message.success('模板草稿已保存');
    } catch (reason) {
      message.error(errorMessage(reason));
    }
    return false;
  }

  async function openWriter() {
    if (!row) return;
    setBusy(true);
    try {
      const session = await S.launch(row.name, row.modified);
      if (!/^\/writer\/w\/[a-zA-Z0-9_.%-]+$/.test(session.url)) {
        throw new Error('Writer 文档地址无效。');
      }
      setDraft({ row: { ...row, modified: session.modified } });
      setWriter(session);
    } catch (reason) {
      message.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const status: ProColumns<S.Header> = {
    title: '状态',
    dataIndex: 'status',
    valueType: 'select',
    valueEnum: S.states,
    render: (_, item) => (
      <Tag
        color={
          item.status === 'Published'
            ? 'success'
            : item.status === 'In Review'
              ? 'warning'
              : 'default'
        }
      >
        {S.states[item.status]}
      </Tag>
    ),
  };
  const columns: ProColumns<S.Header>[] = [
    { title: '模板名称', dataIndex: 'search', hideInTable: true },
    { title: '模板名称', dataIndex: 'template_title', search: false },
    {
      title: '机构',
      dataIndex: 'company',
      valueType: 'select',
      fieldProps: { options: options?.companies },
    },
    {
      title: '分类',
      dataIndex: 'category_name',
      valueType: 'select',
      fieldProps: {
        options: categories.map((item) => ({
          value: item.name,
          label: categoryLabel(item),
        })),
      },
      render: (_, item) => {
        const selected = categories.find(
          (entry) => entry.name === item.category,
        );
        return selected ? categoryLabel(selected) : item.category;
      },
    },
    {
      title: '用途',
      dataIndex: 'document_kind',
      valueType: 'select',
      valueEnum: S.kinds,
    },
    {
      title: '范围',
      dataIndex: 'scope',
      valueType: 'select',
      valueEnum: S.scopes,
    },
    { title: '科室', dataIndex: 'department', search: false },
    {
      title: '版本',
      dataIndex: 'revision',
      search: false,
      render: (_, item) => `V${item.revision}`,
    },
    status,
    {
      title: '操作',
      valueType: 'option',
      render: (_, item) => (
        <Button type="link" onClick={() => view(item.name)}>
          查看
        </Button>
      ),
    },
  ];
  const operations: Action[] = [];
  if (row?.can_edit) {
    if (row.scope === 'Department') operations.push('submit');
    else if (row.status === 'Draft') operations.push('publish');
    operations.push('discard');
  }
  if (row?.can_review) operations.push('approve', 'reject');
  if (row?.can_revise) operations.push('revise');
  if (row?.can_withdraw) operations.push('withdraw');
  const initial: Partial<S.Values> = draft?.copy
    ? { ...draft.copy, template_title: `${draft.copy.template_title}（副本）` }
    : (row ?? { scope: 'Personal', document_kind: 'Communication' });
  const textMode =
    !options?.writer_ready && !row?.rich_body && !draft?.copy?.rich_body;

  return (
    <>
      {optionsError && <Alert showIcon type="error" title={optionsError} />}
      {options && !options.writer_ready && (
        <Alert
          showIcon
          type="info"
          title="本站尚未安装 Frappe Suite，可维护文本模板。"
        />
      )}
      <ProTable<S.Header>
        rowKey="name"
        columns={columns}
        actionRef={table}
        scroll={{ x: 'max-content' }}
        pagination={{ defaultPageSize: 20 }}
        onRequestError={(reason) => message.error(errorMessage(reason))}
        request={async ({ current, pageSize, ...filters }) => {
          const result = await S.directory({
            ...filters,
            page: current,
            page_size: pageSize,
          });
          return {
            data: result.rows,
            total: result.total,
            success: true,
          };
        }}
        toolBarRender={() => [
          <Button
            key="categories"
            disabled={!options}
            onClick={() => setCategoryDirectory({})}
          >
            管理分类
          </Button>,
          <Button
            key="new"
            type="primary"
            disabled={!options}
            onClick={() => open({})}
          >
            新增模板
          </Button>,
        ]}
      />
      {draft && (
        <DrawerForm<S.Values>
          key={row?.name ?? draft.copy?.name ?? 'new'}
          open
          width={800}
          form={form}
          drawerProps={{ destroyOnHidden: true, mask: { closable: false } }}
          title={
            row
              ? `病历模板 V${row.revision}`
              : draft.copy
                ? '复制模板'
                : '新增病历模板'
          }
          initialValues={initial}
          onOpenChange={(visible) => {
            if (!visible) open();
          }}
          onValuesChange={(changed) => {
            setDirty(true);
            if ('company' in changed) form.setFieldValue('category', undefined);
          }}
          onFinish={(values) =>
            save({
              ...values,
              body: textMode
                ? values.body
                : (draft.copy?.body ??
                  (!options?.writer_ready ? row?.body : undefined)),
            })
          }
          submitter={{
            searchConfig: { submitText: '保存草稿' },
            render: (_, defaults) => [
              ...operations.map((action) => (
                <Button
                  key={action}
                  disabled={
                    dirty ||
                    busy ||
                    !!writer ||
                    (['publish', 'submit'].includes(action) && !row?.body)
                  }
                  onClick={() => confirm(action)}
                >
                  {actions[action]}
                </Button>
              )),
              ...(editable ? defaults : []),
            ],
          }}
        >
          {row?.review_note && (
            <Alert
              showIcon
              type="info"
              title={row.review_note}
              description={row.reviewed_by_name}
            />
          )}
          <ProFormText
            name="template_title"
            label="模板名称"
            disabled={!editable}
            rules={required}
            fieldProps={{ maxLength: 140 }}
          />
          <ProFormSelect
            name="company"
            label="所属机构"
            options={options?.companies}
            disabled={!!row}
            rules={required}
          />
          <ProFormSelect
            name="scope"
            label="适用范围"
            valueEnum={S.scopes}
            disabled={!!row}
            rules={required}
          />
          <ProFormSelect
            name="document_kind"
            label="文书用途"
            valueEnum={S.kinds}
            disabled={!!row}
            rules={required}
          />
          <ProFormDependency name={['company', 'scope']}>
            {({ company, scope }) => (
              <>
                {scope === 'Department' && (
                  <ProFormSelect
                    name="department"
                    label="适用科室"
                    options={options?.departments}
                    disabled={!!row}
                    rules={required}
                  />
                )}
                <ProFormSelect
                  name="category"
                  label="文档分类"
                  rules={required}
                  disabled={!editable}
                  extra={
                    editable &&
                    options && (
                      <Button
                        type="link"
                        onClick={() => setCategoryDirectory({ company })}
                      >
                        管理分类
                      </Button>
                    )
                  }
                  options={categories
                    .filter(
                      (item) =>
                        item.company === company &&
                        (item.enabled || item.name === row?.category),
                    )
                    .map((item) => ({
                      value: item.name,
                      label: categoryLabel(item),
                    }))}
                />
              </>
            )}
          </ProFormDependency>
          {textMode && editable ? (
            <ProFormTextArea
              name="body"
              label="模板正文"
              rules={required}
              fieldProps={{ rows: 7, maxLength: 8000 }}
              extra={Object.entries(options?.placeholders ?? {})
                .map(([key, label]) => `${label} {{${key}}}`)
                .join('　')}
            />
          ) : (
            (row?.body || draft.copy?.body) && (
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                {row?.body ?? draft.copy?.body}
              </Typography.Paragraph>
            )
          )}
          <Space wrap>
            {editable && options?.writer_ready && (
              <Button
                disabled={!row || dirty}
                loading={busy}
                onClick={openWriter}
              >
                用 Writer 编辑正文
              </Button>
            )}
            {row && (
              <>
                <Button
                  disabled={dirty || !row.body}
                  onClick={() =>
                    S.preview(row.name)
                      .then(setSample)
                      .catch((reason) => message.error(errorMessage(reason)))
                  }
                >
                  示例预览
                </Button>
                <Button
                  disabled={dirty || !row.body}
                  onClick={() => open({ copy: row })}
                >
                  复制模板
                </Button>
              </>
            )}
          </Space>
          {previous && row?.status === 'In Review' && (
            <Tabs
              items={[
                {
                  key: 'current',
                  label: `本次 V${row.revision}`,
                  children: (
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                      {row.body}
                    </Typography.Paragraph>
                  ),
                },
                {
                  key: 'previous',
                  label: `前版 V${previous.revision}`,
                  children: (
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                      {previous.body}
                    </Typography.Paragraph>
                  ),
                },
              ]}
            />
          )}
          {!!row?.history.length && (
            <Space wrap>
              <Typography.Text strong>版本记录</Typography.Text>
              {row.history.map((version) => (
                <Button
                  key={version.name}
                  type="link"
                  disabled={dirty || version.name === row.name}
                  onClick={() => view(version.name)}
                >
                  V{version.revision} · {S.states[version.status]}
                </Button>
              ))}
            </Space>
          )}
        </DrawerForm>
      )}
      {row && writer && (
        <WriterEditor
          name={row.name}
          session={writer}
          fields={options?.placeholders ?? {}}
          onClose={() => setWriter(undefined)}
          onSave={(updated) => {
            setWriter(undefined);
            open({ row: updated });
            table.current?.reload();
            message.success('Writer 正文已保存到模板草稿');
          }}
        />
      )}
      {sample && (
        <Drawer
          title={`示例预览 V${sample.revision}`}
          open
          onClose={() => setSample(undefined)}
          size={740}
        >
          {sample.html ? (
            <iframe
              title="模板示例正文"
              sandbox=""
              srcDoc={`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:15px/1.6 system-ui}td,th{border:1px solid #ddd;padding:5px}table{border-collapse:collapse}</style>${sample.html}`}
              style={{ width: '100%', height: '70vh', border: 0 }}
            />
          ) : (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {sample.body}
            </Typography.Paragraph>
          )}
        </Drawer>
      )}
      {review && (
        <ModalForm<{ note: string }>
          open
          title={actions[review]}
          onOpenChange={(open) => {
            if (!open) setReview(undefined);
          }}
          onFinish={({ note }) => transition(review, note)}
        >
          <ProFormTextArea
            name="note"
            label="审核意见"
            rules={required}
            fieldProps={{ maxLength: 2000 }}
          />
        </ModalForm>
      )}
      {categoryDirectory && (
        <Drawer
          title="病历文档分类"
          size="min(100vw, 1100px)"
          open
          onClose={() => setCategoryDirectory(undefined)}
        >
          <CategoryDirectory
            company={categoryDirectory.company}
            initialOptions={options}
            onOptions={setOptions}
          />
        </Drawer>
      )}
    </>
  );
}
