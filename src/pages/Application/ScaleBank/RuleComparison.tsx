import { Flex, Table, Tag, Typography } from 'antd';
import type { RuleDefinition } from './service';

type Entry = { key: string; before: string[]; after: string[] };
const modes: Record<string, string> = {
  Items: '按题汇总',
  Dimensions: '按维度加权汇总',
};
const round: Record<string, string> = {
  HalfUp: '四舍五入',
  Floor: '向下取整',
  Ceiling: '向上取整',
};
const operations: Record<string, string> = {
  eq: '=',
  ne: '≠',
  lt: '<',
  lte: '≤',
  gt: '>',
  gte: '≥',
};
const names: Record<string, string> = { total: '总分', standard: '标准分' };
function criterion(
  value?: NonNullable<RuleDefinition['applicability']>[number]['when'],
) {
  return (
    [
      value?.care?.join('、'),
      value?.stages?.join('、'),
      value?.sexes?.join('、'),
      value?.age_min != null || value?.age_max != null
        ? `${value.age_min ?? '不限'}–${value.age_max ?? '不限'} 岁`
        : '',
    ]
      .filter(Boolean)
      .join(' · ') || '全部上下文'
  );
}
function range(value: {
  min?: string | number;
  max?: string | number;
  include_min?: boolean;
  include_max?: boolean;
}) {
  return `${value.include_min === false ? '(' : '['}${value.min ?? '—'}, ${value.max ?? '—'}${value.include_max === false ? ')' : ']'}`;
}
function summary(rules?: RuleDefinition): Record<string, string[]> {
  if (!rules) return { 汇总策略: ['逐题整数求和 · 全部题目必答'] };
  const condition = (
    value?: NonNullable<RuleDefinition['questions']>[number]['show_if'],
  ) =>
    value?.item
      ? `${value.item} ${operations[value.operator || '']} ${value.score}`
      : '';
  return {
    汇总策略: [
      `${modes[rules.total_mode || ''] || '按题汇总'} · ${round[rules.rounding || '']} · 维度 ${rules.precision} 位小数`,
      `${rules.missing === 'Available' ? '按已答计分' : '完成必答题'} · 至少 ${rules.minimum_answered} 题 · ${({ HigherBetter: '高分代表表现更好', HigherWorse: '高分代表程度更重' } as Record<string, string>)[rules.direction || ''] || '描述分值'}`,
    ],
    适用条件:
      rules.applicability?.map(
        (row) => `${row.label} · ${criterion(row.when)}`,
      ) || [],
    逐题规则:
      rules.questions?.map((row) =>
        [
          row.item,
          row.reverse ? '反向计分' : '正向计分',
          `权重 ${row.weight}`,
          row.required ? '必答' : '可选',
          row.show_if ? `显示：${condition(row.show_if)}` : '',
          row.require_if ? `必答：${condition(row.require_if)}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ) || [],
    维度分:
      rules.dimensions?.map(
        (row) =>
          `${row.label}（${row.id}） · ${row.items?.join('、')} · 权重 ${row.weight}`,
      ) || [],
    结果解释:
      rules.bands?.map(
        (row) =>
          `${names[row.metric || ''] || row.metric} ${range(row)} · ${row.label} · ${row.interpretation}`,
      ) || [],
    常模:
      rules.norms?.map(
        (row) =>
          `${row.label} ${row.version} · ${criterion(row.when)} · ${row.reference}\n${row.rows?.map((item) => `${range(item)} → ${item.value}`).join('，')}`,
      ) || [],
    跨版换算:
      rules.comparisons?.map(
        (row) =>
          `V${row.version} · 前序总分 × ${row.factor} + ${row.offset} · ${row.reference}`,
      ) || [],
    试算用例:
      rules.cases?.map(
        (row) =>
          `${row.label} · ${row.context?.care} / ${row.context?.stage} / ${row.context?.age ?? '年龄不限'} / ${row.context?.sex || '性别不限'} · ${Object.entries(
            row.answers || {},
          )
            .map(([k, v]) => `${k}=${v}`)
            .join(
              '，',
            )} · 预期 ${row.expected_state} ${row.expected_total ?? ''} ${row.expected_grade || ''}`,
      ) || [],
  };
}
const render = (lines: string[]) => (
  <Typography.Text style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
    {lines.join('\n') || '—'}
  </Typography.Text>
);
export default function RuleComparison({
  before,
  after,
}: {
  before?: RuleDefinition;
  after?: RuleDefinition;
}) {
  const old = summary(before);
  const current = summary(after);
  const rows = [...new Set([...Object.keys(old), ...Object.keys(current)])].map(
    (key) => ({ key, before: old[key] || [], after: current[key] || [] }),
  );
  return (
    <Flex vertical gap={8}>
      <Typography.Text strong>量表规则对照</Typography.Text>
      <Table<Entry>
        size="small"
        bordered
        rowKey="key"
        dataSource={rows}
        pagination={false}
        scroll={{ x: 620 }}
        columns={[
          { title: '规则', dataIndex: 'key', width: 124 },
          { title: '修订前', render: (_, row) => render(row.before) },
          { title: '本次修订', render: (_, row) => render(row.after) },
          {
            title: '变化',
            width: 76,
            render: (_, row) =>
              JSON.stringify(row.before) === JSON.stringify(row.after) ? (
                '—'
              ) : (
                <Tag color="gold">变更</Tag>
              ),
          },
        ]}
      />
    </Flex>
  );
}
