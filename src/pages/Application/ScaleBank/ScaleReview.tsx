import { ProCard } from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Descriptions,
  Flex,
  Input,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import RuleComparison from './RuleComparison';
import * as S from './service';
import Trial from './Trial';

const actions: Record<string, string> = {
  'Draft Saved': '保存草稿',
  Submitted: '提交审核',
  Published: '审核通过',
  Rejected: '退回修订',
  Withdrawn: '停用',
  Superseded: '被新版替代',
};

function scoringText(item: S.Item) {
  if (item.kind === 'Range')
    return `整数区间 ${S.itemRange(item)?.join('–') || '—'} 分`;
  return item.options
    .map(({ score, label }) => `${score ?? '—'} 分 · ${label}`)
    .join('\n');
}

type Side = { item: S.Item; position: number };
type Difference = { key: string; before?: Side; after?: Side };
function compare(before: S.Item[], after: S.Item[]) {
  const pairs = new Map<string, Difference>();
  const add = (items: S.Item[], side: 'before' | 'after') => {
    const occurrences = new Map<string, number>();
    items.forEach((item, index) => {
      const ordinal = occurrences.get(item.parameter) || 0;
      occurrences.set(item.parameter, ordinal + 1);
      const key = JSON.stringify([item.parameter, ordinal]);
      const row = pairs.get(key) || { key };
      row[side] = { item, position: index + 1 };
      pairs.set(key, row);
    });
  };
  add(after, 'after');
  add(before, 'before');
  return [...pairs.values()];
}

function side(value?: Side, changed = false) {
  if (!value) return '—';
  const { item } = value;
  return (
    <Flex vertical gap={4}>
      <Typography.Text strong>
        {value.position}. {item.parameter}
      </Typography.Text>
      {item.description !== item.parameter && (
        <Typography.Text type="secondary" mark={changed}>
          {item.description}
        </Typography.Text>
      )}
      <Typography.Text
        mark={changed}
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {scoringText(item)}
      </Typography.Text>
    </Flex>
  );
}

export default function ScaleReview({
  detail,
  onBack,
  onChange,
}: {
  detail: S.Version;
  onBack: () => void;
  onChange: (updated: S.Version) => void;
}) {
  const { message, modal } = App.useApp();
  const { profile } = detail;
  const [reason, setReason] = useState('');
  const [clinical, setClinical] = useState(false);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const before = detail.baseline?.content.items || detail.original?.items || [];
  const after = detail.content.items;
  const currentDescription =
    detail.content.base_snapshot?.description ?? detail.content.description;
  const oldDescription =
    detail.baseline?.content.base_snapshot?.description ??
    detail.original?.description;
  const oldReference =
    detail.baseline?.content.source_reference ||
    detail.original?.source_reference;
  const beforeRange = S.totalRange(before)?.join('–') || '—';
  const afterRange = S.totalRange(after)?.join('–') || '—';
  const write = async (decision: 'approve' | 'reject' | 'withdraw') => {
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: profile.name,
        modified: profile.modified,
        reason: reason.trim(),
      };
      const updated =
        decision === 'withdraw'
          ? await S.withdraw(payload)
          : await S.review({
              ...payload,
              decision,
              clinical_confirmed: clinical,
              rights_confirmed: rights,
            });
      setReason('');
      setClinical(false);
      setRights(false);
      onChange(updated);
      message.success(
        decision === 'approve'
          ? '量表已发布'
          : decision === 'reject'
            ? '已退回修订'
            : '量表已停用',
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirmAction = (decision: 'approve' | 'reject' | 'withdraw') => {
    const titles = {
      approve: '确认发布此修订版本？',
      reject: '确认退回此修订版本？',
      withdraw: '确认停用当前发布版本？',
    };
    modal.confirm({
      title: titles[decision],
      onOk: () => write(decision),
      okText: '确认',
      cancelText: '取消',
    });
  };
  return (
    <ProCard>
      <Flex vertical gap={16}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space wrap>
            <Typography.Title level={4} style={{ margin: 0 }}>
              审核量表修订
            </Typography.Title>
            <Tag color={S.colors[profile.status]}>
              {S.labels[profile.status]}
            </Tag>
          </Space>
          <Button disabled={busy} onClick={onBack}>
            返回量表列表
          </Button>
        </Flex>
        <Steps
          size="small"
          current={profile.status === 'Draft' ? 0 : 2}
          items={[
            { title: '编辑题目' },
            { title: '预览试算' },
            { title: '审核发布' },
          ]}
        />
        <Descriptions
          size="small"
          bordered
          column={{ xs: 1, sm: 2, lg: 3 }}
          items={[
            { key: 'title', label: '量表', children: profile.title },
            {
              key: 'version',
              label: '修订版本',
              children: `V${profile.version}`,
            },
            {
              key: 'reviewer',
              label: '指定审核人',
              children: profile.reviewer || '—',
            },
            { key: 'author', label: '编制人', children: profile.created_by },
            {
              key: 'reviewed',
              label: '审核时间',
              children: profile.reviewed_at || '—',
            },
            {
              key: 'range',
              label: '总分范围',
              children: `${beforeRange} → ${afterRange} 分`,
            },
          ]}
        />
        {profile.status === 'Pending Review' && !detail.source_current && (
          <Alert
            type="warning"
            showIcon
            title="生效版本已变化。请退回本稿，由编制人基于当前版本重新提交。"
          />
        )}
        {error && <Alert type="error" showIcon title={error} />}
        <Table<Difference>
          size="small"
          bordered
          rowKey="key"
          dataSource={compare(before, after)}
          scroll={{ x: 600 }}
          pagination={{ hideOnSinglePage: true, defaultPageSize: 20 }}
          columns={[
            {
              title: detail.baseline
                ? `V${detail.baseline.profile.version} 修订前`
                : '原量表',
              render: (_, row) =>
                side(
                  row.before,
                  !!row.before &&
                    (!row.after ||
                      scoringText(row.before.item) !==
                        scoringText(row.after.item) ||
                      row.before.item.description !==
                        row.after.item.description),
                ),
            },
            {
              title: `V${profile.version} ${S.labels[profile.status]}`,
              render: (_, row) =>
                side(
                  row.after,
                  !!row.after &&
                    (!row.before ||
                      scoringText(row.before.item) !==
                        scoringText(row.after.item) ||
                      row.before.item.description !==
                        row.after.item.description),
                ),
            },
            {
              title: '变更',
              width: 120,
              render: (_, row) => {
                if (!row.before) return <Tag color="green">新增</Tag>;
                if (!row.after) return <Tag color="red">移除</Tag>;
                const changed =
                  scoringText(row.before.item) !==
                    scoringText(row.after.item) ||
                  row.before.item.description !== row.after.item.description ||
                  row.before.item.kind !== row.after.item.kind;
                return (
                  <Space size={0} wrap>
                    {changed && <Tag color="gold">评分修改</Tag>}
                    {row.before.position !== row.after.position && (
                      <Tag color="blue">顺序变化</Tag>
                    )}
                    {!changed &&
                      row.before.position === row.after.position &&
                      '—'}
                  </Space>
                );
              },
            },
          ]}
        />
        <Descriptions
          bordered
          column={1}
          size="small"
          items={[
            {
              key: 'before-desc',
              label: '原量表说明与适用范围',
              children: oldDescription || '—',
            },
            {
              key: 'desc',
              label: '修订说明与适用范围',
              children: currentDescription || '—',
            },
            {
              key: 'before-ref',
              label: '原评分依据',
              children: oldReference || '—',
            },
            {
              key: 'source',
              label: '修订评分依据及权属',
              children: detail.content.source_reference || '—',
            },
            ...(profile.review_note
              ? [
                  {
                    key: 'note',
                    label: '审核或停用意见',
                    children: profile.review_note,
                  },
                ]
              : []),
          ]}
        />
        {(detail.content.rules ||
          detail.baseline?.content.rules ||
          detail.original?.rules) && (
          <RuleComparison
            before={detail.baseline?.content.rules || detail.original?.rules}
            after={detail.content.rules}
          />
        )}
        {profile.status !== 'Draft' && (
          <>
            <Typography.Title level={5} style={{ margin: 0 }}>
              评分试算
            </Typography.Title>
            <Trial
              items={after}
              rules={detail.content.rules}
              source={{ name: profile.name }}
            />
          </>
        )}
        {(detail.can_review || detail.can_withdraw) && (
          <Flex vertical gap={10}>
            <Typography.Text strong>
              {detail.can_review ? '审核意见' : '停用原因'}
            </Typography.Text>
            <Input.TextArea
              aria-label={detail.can_review ? '审核意见' : '停用原因'}
              placeholder={detail.can_review ? '填写审核意见' : '填写停用原因'}
              rows={3}
              maxLength={2000}
              showCount
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
            {detail.can_review && (
              <Flex vertical gap={6}>
                <Checkbox
                  checked={clinical}
                  disabled={busy}
                  onChange={(event) => setClinical(event.target.checked)}
                >
                  已核对题目、逐项评分及适用范围
                </Checkbox>
                <Checkbox
                  checked={rights}
                  disabled={busy}
                  onChange={(event) => setRights(event.target.checked)}
                >
                  已核对评分依据与内容权属
                </Checkbox>
              </Flex>
            )}
            <Flex justify="flex-end" gap={8} wrap>
              {detail.can_review ? (
                <>
                  <Button
                    disabled={busy || !reason.trim()}
                    onClick={() => confirmAction('reject')}
                  >
                    退回修订
                  </Button>
                  <Button
                    type="primary"
                    loading={busy}
                    disabled={
                      !reason.trim() ||
                      !clinical ||
                      !rights ||
                      !detail.source_current
                    }
                    onClick={() => confirmAction('approve')}
                  >
                    审核通过
                  </Button>
                </>
              ) : (
                <Button
                  danger
                  loading={busy}
                  disabled={!reason.trim()}
                  onClick={() => confirmAction('withdraw')}
                >
                  停用版本
                </Button>
              )}
            </Flex>
          </Flex>
        )}
        {detail.events.length > 0 && (
          <Table
            size="small"
            rowKey="name"
            dataSource={detail.events}
            scroll={{ x: 520 }}
            pagination={{ hideOnSinglePage: true }}
            columns={[
              {
                title: '操作',
                dataIndex: 'action',
                render: (action) => actions[action] || action,
              },
              { title: '操作人', dataIndex: 'actor' },
              { title: '时间', dataIndex: 'event_time' },
              { title: '依据', dataIndex: 'reason' },
            ]}
          />
        )}
      </Flex>
    </ProCard>
  );
}
