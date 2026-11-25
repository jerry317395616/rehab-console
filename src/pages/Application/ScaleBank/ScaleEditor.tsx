import {
  Alert,
  App,
  Button,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import RuleEditor from './RuleEditor';
import * as S from './service';
import Trial from './Trial';

type EditItem = Omit<S.Item, 'options'> & {
  key: string;
  options: (S.Item['options'][number] & { key: string })[];
};
const newItem = (): EditItem => ({
  key: crypto.randomUUID(),
  parameter: '',
  description: '',
  kind: 'Range',
  minimum: null,
  maximum: null,
  options: [],
});
const methodOptions = [
  { label: '整数区间', value: 'Range' },
  { label: '固定分值', value: 'Choices' },
];

export default function ScaleEditor({
  data,
  onClose,
  onSave,
  onSubmit,
}: {
  data: S.EditorData;
  onClose: () => void;
  onSave: () => void;
  onSubmit: (name: string) => void;
}) {
  const { modal, message } = App.useApp();
  const [values, setValues] = useState(data.values);
  const [items, setItems] = useState<EditItem[]>(() =>
    data.values.items.map((item) => ({
      ...item,
      key: crypto.randomUUID(),
      options: item.options.map((option) => ({
        ...option,
        key: crypto.randomUUID(),
      })),
    })),
  );
  const [profile, setProfile] = useState(data.profile);
  const [request] = useState(() => crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(
    data.template || data.profile ? 'items' : 'details',
  );
  const [expanded, setExpanded] = useState<React.Key[]>([]);
  const payload: S.Values = {
    ...values,
    items: items.map(({ key: _key, options, ...item }) => ({
      ...item,
      options: options.map(({ key: _optionKey, ...option }) => option),
    })),
  };
  const bounds = S.totalRange(items);
  const change = (patch: Partial<S.Values>) => {
    setValues((old) => ({ ...old, ...patch }));
    setDirty(true);
  };
  const updateItems = (next: EditItem[]) => {
    setItems(next);
    setDirty(true);
  };
  const updateItem = (key: string, patch: Partial<EditItem>) =>
    updateItems(
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  const close = () => {
    if (!dirty) {
      onClose();
      return;
    }
    modal.confirm({
      title: '关闭修订并放弃未保存的修改？',
      okText: '放弃并关闭',
      cancelText: '继续编辑',
      onOk: onClose,
    });
  };
  const persist = async (submit: boolean) => {
    if (busy) return;
    if (
      !values.title.trim() ||
      (submit && (!values.reviewer || !values.source_reference.trim()))
    ) {
      setTab('details');
      setError('请填写量表名称。提交审核还须填写评分依据并指定审核人。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved =
        dirty || !profile
          ? await S.save({
              name: profile?.name,
              modified: profile?.modified,
              template: data.template,
              stamp: data.stamp,
              values: payload,
              request_id: request,
            })
          : null;
      const current = saved?.profile ?? profile;
      if (!current) throw new Error('草稿保存结果为空，请重试。');
      setProfile(current);
      setDirty(false);
      onSave();
      if (submit) {
        const version = await S.submit({
          name: current.name,
          modified: current.modified,
        });
        message.success('已提交审核');
        onSubmit(version.profile.name);
      } else {
        message.success('量表草稿已保存');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const move = (index: number, offset: number) => {
    const next = [...items];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    updateItems(next);
  };
  return (
    <Drawer
      open
      title={data.template ? '修订量表' : '新建量表'}
      size="min(900px, 100vw)"
      mask={{ closable: false }}
      keyboard={!busy}
      closable={{ disabled: busy }}
      onClose={close}
      footer={
        <Flex justify="flex-end" gap={8} wrap>
          <Button disabled={busy} onClick={close}>
            取消
          </Button>
          <Button
            disabled={busy || (!dirty && !!profile)}
            onClick={() => persist(false)}
          >
            保存草稿
          </Button>
          <Button type="primary" loading={busy} onClick={() => persist(true)}>
            提交审核
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={12}>
        <Space wrap>
          <Typography.Text strong>{values.title || '新建量表'}</Typography.Text>
          <Tag>{profile ? `V${profile.version} 草稿` : '未保存'}</Tag>
        </Space>
        {error && <Alert type="error" showIcon title={error} />}
        <Tabs
          activeKey={tab}
          onChange={setTab}
          destroyOnHidden
          items={[
            {
              key: 'items',
              label: '题目与评分',
              children: (
                <Flex vertical gap={12}>
                  <Table<EditItem>
                    size="small"
                    rowKey="key"
                    dataSource={items}
                    pagination={false}
                    scroll={{ x: 625 }}
                    locale={{ emptyText: '点击新增题目开始编制' }}
                    expandable={{
                      expandedRowKeys: expanded,
                      onExpandedRowsChange: (keys) => setExpanded([...keys]),
                      expandedRowRender: (item, index) => (
                        <Flex vertical gap={8}>
                          <Input.TextArea
                            aria-label={`第 ${index + 1} 题评分说明`}
                            placeholder="评分说明"
                            value={item.description}
                            maxLength={3000}
                            disabled={busy}
                            onChange={(event) =>
                              updateItem(item.key, {
                                description: event.target.value,
                              })
                            }
                          />
                          {item.kind === 'Range' ? (
                            <Space wrap>
                              <InputNumber
                                aria-label="最低分"
                                placeholder="最低分"
                                precision={0}
                                min={-100000}
                                max={100000}
                                value={item.minimum}
                                disabled={busy}
                                onChange={(minimum) =>
                                  updateItem(item.key, { minimum })
                                }
                              />
                              <InputNumber
                                aria-label="最高分"
                                placeholder="最高分"
                                precision={0}
                                min={-100000}
                                max={100000}
                                value={item.maximum}
                                disabled={busy}
                                onChange={(maximum) =>
                                  updateItem(item.key, { maximum })
                                }
                              />
                            </Space>
                          ) : (
                            <>
                              {item.options.map((option, optionIndex) => (
                                <Space key={option.key} wrap>
                                  <InputNumber
                                    aria-label={`选项 ${optionIndex + 1} 分值`}
                                    placeholder="分值"
                                    precision={0}
                                    min={-100000}
                                    max={100000}
                                    value={option.score}
                                    disabled={busy}
                                    onChange={(score) =>
                                      updateItem(item.key, {
                                        options: item.options.map(
                                          (row, index) =>
                                            index === optionIndex
                                              ? { ...row, score }
                                              : row,
                                        ),
                                      })
                                    }
                                  />
                                  <Input
                                    aria-label={`选项 ${optionIndex + 1} 说明`}
                                    placeholder="分值说明"
                                    maxLength={500}
                                    disabled={busy}
                                    value={option.label}
                                    onChange={(event) =>
                                      updateItem(item.key, {
                                        options: item.options.map(
                                          (row, index) =>
                                            index === optionIndex
                                              ? {
                                                  ...row,
                                                  label: event.target.value,
                                                }
                                              : row,
                                        ),
                                      })
                                    }
                                  />
                                  <Button
                                    type="link"
                                    danger
                                    disabled={busy}
                                    onClick={() =>
                                      updateItem(item.key, {
                                        options: item.options.filter(
                                          (_, index) => index !== optionIndex,
                                        ),
                                      })
                                    }
                                  >
                                    删除选项
                                  </Button>
                                </Space>
                              ))}
                              <Button
                                type="dashed"
                                disabled={busy || item.options.length >= 30}
                                onClick={() =>
                                  updateItem(item.key, {
                                    options: [
                                      ...item.options,
                                      {
                                        key: crypto.randomUUID(),
                                        score: null,
                                        label: '',
                                      },
                                    ],
                                  })
                                }
                              >
                                新增分值选项
                              </Button>
                            </>
                          )}
                        </Flex>
                      ),
                    }}
                    columns={[
                      {
                        title: '顺序',
                        width: 56,
                        render: (_, __, index) => index + 1,
                      },
                      {
                        title: '题目',
                        render: (_, item, index) => (
                          <Input
                            aria-label={`第 ${index + 1} 题题目`}
                            placeholder="输入题目"
                            maxLength={140}
                            value={item.parameter}
                            disabled={busy}
                            onChange={(event) =>
                              updateItem(item.key, {
                                parameter: event.target.value,
                              })
                            }
                          />
                        ),
                      },
                      {
                        title: '计分方式',
                        width: 124,
                        render: (_, item) => (
                          <Select
                            value={item.kind}
                            options={methodOptions}
                            disabled={busy}
                            style={{ width: '100%' }}
                            onChange={(kind) => {
                              updateItem(item.key, { kind });
                              setExpanded((keys) => [
                                ...new Set([...keys, item.key]),
                              ]);
                            }}
                          />
                        ),
                      },
                      {
                        title: '分值',
                        width: 74,
                        render: (_, item) =>
                          S.itemRange(item)?.join('–') || '—',
                      },
                      {
                        title: '操作',
                        width: 152,
                        render: (_, item, index) => (
                          <Space size={0}>
                            <Button
                              type="link"
                              size="small"
                              disabled={busy || index === 0}
                              onClick={() => move(index, -1)}
                            >
                              上移
                            </Button>
                            <Button
                              type="link"
                              size="small"
                              disabled={busy || index === items.length - 1}
                              onClick={() => move(index, 1)}
                            >
                              下移
                            </Button>
                            <Button
                              type="link"
                              danger
                              size="small"
                              disabled={busy}
                              onClick={() =>
                                updateItems(
                                  items.filter((row) => row.key !== item.key),
                                )
                              }
                            >
                              删除
                            </Button>
                          </Space>
                        ),
                      },
                    ]}
                  />
                  <Flex justify="space-between" align="center" gap={8} wrap>
                    <Button
                      disabled={busy || items.length >= 500}
                      onClick={() => {
                        const item = newItem();
                        updateItems([...items, item]);
                        setExpanded([item.key]);
                      }}
                    >
                      新增题目
                    </Button>
                    <Typography.Text type="secondary">
                      {items.length} 道题
                      {bounds ? ` · 总分范围 ${bounds.join('–')} 分` : ''}
                    </Typography.Text>
                  </Flex>
                </Flex>
              ),
            },
            {
              key: 'details',
              label: '量表信息',
              children: (
                <Form layout="vertical" disabled={busy}>
                  <Form.Item label="量表名称" required>
                    <Input
                      aria-label="量表名称"
                      maxLength={140}
                      value={values.title}
                      onChange={(event) =>
                        change({ title: event.target.value })
                      }
                    />
                  </Form.Item>
                  <Form.Item label="量表说明与适用范围">
                    <Input.TextArea
                      aria-label="量表说明与适用范围"
                      rows={3}
                      maxLength={4000}
                      value={values.description}
                      onChange={(event) =>
                        change({ description: event.target.value })
                      }
                    />
                  </Form.Item>
                  <Form.Item label="评分依据及权属" required>
                    <Input.TextArea
                      aria-label="评分依据及权属"
                      rows={3}
                      maxLength={4000}
                      value={values.source_reference}
                      onChange={(event) =>
                        change({ source_reference: event.target.value })
                      }
                    />
                  </Form.Item>
                  <Form.Item label="指定临床审核人" required>
                    <Select
                      aria-label="指定临床审核人"
                      showSearch={{ optionFilterProp: 'label' }}
                      value={values.reviewer || undefined}
                      options={data.reviewers.map(({ name, label }) => ({
                        value: name,
                        label,
                      }))}
                      onChange={(reviewer) => change({ reviewer })}
                    />
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'advanced',
              label: '规则配置',
              children: (
                <RuleEditor
                  items={items}
                  value={values.rules}
                  disabled={busy}
                  onChange={(rules) => change({ rules })}
                />
              ),
            },
            {
              key: 'trial',
              label: '预览试算',
              children: (
                <Trial
                  items={items}
                  rules={values.rules}
                  source={{ template: data.template, values: payload }}
                />
              ),
            },
          ]}
        />
      </Flex>
    </Drawer>
  );
}
