import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import { careOptions, outcomes, stageOptions } from './RuleEditor';
import * as S from './service';

export default function Trial({
  items,
  source,
  rules,
}: {
  items: S.Item[];
  source: { name: string } | { template: string; values: S.Values };
  rules?: S.RuleDefinition;
}) {
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [result, setResult] = useState<S.TrialResult>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cases, setCases] = useState<S.CaseResult[]>();
  const [caseLoading, setCaseLoading] = useState(false);
  const [context, setContext] = useState<S.Context>({
    care: 'Outpatient',
    stage: 'Initial',
  });
  const setContextField = (partial: Partial<S.Context>) => {
    setContext((current) => ({ ...current, ...partial }));
    setResult(undefined);
  };
  const change = (index: number, value: number | null) => {
    setAnswers((previous) => ({ ...previous, [index]: value }));
    setResult(undefined);
    setError('');
  };
  const calculate = async () => {
    setLoading(true);
    setError('');
    setResult(undefined);
    try {
      const responses = items.map((_, index) => ({
        idx: index + 1,
        answered: answers[index] != null,
        score: answers[index] ?? null,
      }));
      setResult(
        await S.preview({
          ...source,
          responses,
          ...(rules ? { context, compare: true } : {}),
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  const runCases = async () => {
    setCaseLoading(true);
    setError('');
    setCases(undefined);
    try {
      setCases((await S.runCases(source)).cases);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCaseLoading(false);
    }
  };
  return (
    <Flex vertical gap={12}>
      {rules && (
        <Form layout="inline" disabled={loading}>
          <Form.Item label="就诊场景">
            <Select
              aria-label="试算场景"
              value={context.care}
              options={careOptions}
              onChange={(care) => setContextField({ care })}
            />
          </Form.Item>
          <Form.Item label="评估阶段">
            <Select
              aria-label="试算阶段"
              value={context.stage}
              options={stageOptions}
              onChange={(stage) => setContextField({ stage })}
            />
          </Form.Item>
          <Form.Item label="年龄（整岁）">
            <InputNumber
              aria-label="试算年龄"
              min={0}
              max={150}
              precision={0}
              value={context.age}
              onChange={(age) => setContextField({ age })}
            />
          </Form.Item>
          <Form.Item label="登记性别">
            <Input
              aria-label="试算登记性别"
              value={context.sex || ''}
              onChange={(event) => setContextField({ sex: event.target.value })}
            />
          </Form.Item>
        </Form>
      )}
      <Table
        size="small"
        pagination={false}
        dataSource={items.map((item, index) => ({ ...item, index }))}
        rowKey="index"
        locale={{ emptyText: '请先维护题目' }}
        columns={[
          {
            title: '顺序',
            dataIndex: 'index',
            width: 64,
            render: (index) => index + 1,
          },
          { title: '题目', dataIndex: 'parameter' },
          { title: '评分说明', dataIndex: 'description', responsive: ['md'] },
          {
            title: '试算分值',
            width: 240,
            render: (_, item) =>
              item.kind === 'Choices' ? (
                <Select
                  aria-label={`第 ${item.index + 1} 题试算分值`}
                  placeholder="未作答"
                  style={{ width: '100%' }}
                  allowClear
                  disabled={loading}
                  value={answers[item.index] ?? undefined}
                  options={item.options.flatMap((choice) =>
                    choice.score == null
                      ? []
                      : [
                          {
                            value: choice.score,
                            label: `${choice.score} 分 · ${choice.label}`,
                          },
                        ],
                  )}
                  onChange={(value) => change(item.index, value ?? null)}
                />
              ) : (
                <InputNumber
                  aria-label={`第 ${item.index + 1} 题试算分值`}
                  placeholder="未作答"
                  disabled={loading}
                  min={item.minimum ?? undefined}
                  max={item.maximum ?? undefined}
                  precision={0}
                  value={answers[item.index] ?? null}
                  onChange={(value) => change(item.index, value)}
                />
              ),
          },
        ]}
      />
      <Flex gap={12} wrap>
        <Button loading={loading} disabled={!items.length} onClick={calculate}>
          计算得分
        </Button>
        {!!rules?.cases?.length && (
          <Button loading={caseLoading} onClick={runCases}>
            运行试算用例
          </Button>
        )}
        <Button
          disabled={loading}
          onClick={() => {
            setAnswers({});
            setResult(undefined);
            setError('');
          }}
        >
          清空试算
        </Button>
      </Flex>
      {error && <Alert type="error" showIcon title={error} />}
      {result && (
        <Alert
          type="success"
          showIcon
          title={`试算得分 ${result.total} 分`}
          description={`已作答 ${result.answered} / ${result.count} 题 · 完整作答总分范围 ${result.range[0]}–${result.range[1]} 分`}
        />
      )}
      {result?.details && <ScoreBreakdown value={result.details} />}
      {result?.comparison && (
        <>
          <Typography.Text strong>
            修订前 V{result.comparison.version} ·{' '}
            {result.comparison.error || `试算 ${result.comparison.total} 分`}
          </Typography.Text>
          {result.comparison.details && (
            <ScoreBreakdown value={result.comparison.details} />
          )}
        </>
      )}
      {cases && (
        <Table
          size="small"
          rowKey="label"
          dataSource={cases}
          pagination={{ hideOnSinglePage: true }}
          columns={[
            { title: '用例', dataIndex: 'label' },
            {
              title: '实际状态',
              dataIndex: 'state',
              render: (state) => outcomes[state] || state,
            },
            { title: '总分', dataIndex: 'total' },
            {
              title: '等级或原因',
              render: (_, row) => row.grade || row.error || '—',
            },
            {
              title: '校验',
              render: (_, row) => (
                <Tag color={row.passes ? 'green' : 'red'}>
                  {row.passes ? '通过' : '未通过'}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </Flex>
  );
}

export function ScoreBreakdown({ value }: { value: S.ScoreDetails }) {
  const normText =
    value.norm?.status === 'Matched'
      ? `${value.norm.value} 分 · ${value.norm.label} ${value.norm.version}`
      : value.norm?.status === 'OutOfRange'
        ? '总分未匹配换算区间'
        : '评估上下文未匹配常模';
  return (
    <Flex vertical gap={8}>
      <Typography.Text>
        {value.ready ? '已达到出分条件' : '仍有缺项'} · 舍入前{' '}
        {value.exact_total} 分
        {value.applicability && ` · 适用条件 ${value.applicability}`}
      </Typography.Text>
      {!!value.dimensions.length && (
        <Typography.Text>
          维度分 ·{' '}
          {value.dimensions
            .map((row) => `${row.label} ${row.score}`)
            .join('，')}
        </Typography.Text>
      )}
      {value.norm && <Typography.Text>标准分 · {normText}</Typography.Text>}
      {Object.entries(value.grades).map(([metric, grade]) => (
        <Typography.Text key={metric}>
          {metric === 'total'
            ? '总分'
            : metric === 'standard'
              ? '标准分'
              : value.dimensions.find((row) => `dimension:${row.id}` === metric)
                  ?.label}
          等级 ·{' '}
          {grade ? `${grade.label} ${grade.interpretation}` : '未匹配结果区间'}
        </Typography.Text>
      ))}
      <Table
        size="small"
        rowKey="idx"
        dataSource={value.trace}
        pagination={{ hideOnSinglePage: true }}
        columns={[
          { title: '题目', dataIndex: 'item' },
          {
            title: '状态',
            render: (_, row) =>
              row.state === 'Skipped'
                ? '按规则跳过'
                : row.state === 'Answered'
                  ? '已答'
                  : row.required
                    ? '必答未答'
                    : '未答',
          },
          { title: '原始分', dataIndex: 'raw', render: (v) => v ?? '—' },
          {
            title: '换算分',
            dataIndex: 'transformed',
            render: (v) => v ?? '—',
          },
          { title: '加权分', dataIndex: 'weighted', render: (v) => v ?? '—' },
        ]}
      />
    </Flex>
  );
}
