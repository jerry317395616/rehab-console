import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import type { ReactNode } from 'react';
import type { Item, RuleDefinition } from './service';

type Path = (number | string)[];
const care = { Outpatient: '门诊', Inpatient: '住院', Bedside: '床旁' };
const stage = { Initial: '初评', Interim: '中期评估', Final: '末评' };
const missing = { Require: '完成必答题', Available: '按已答项目汇总' };
const rounding = { HalfUp: '四舍五入', Floor: '向下取整', Ceiling: '向上取整' };
const modes = { Items: '按题目汇总', Dimensions: '维度加权汇总' };
const direction = {
  Descriptive: '仅描述分值',
  HigherBetter: '高分代表表现更好',
  HigherWorse: '高分代表程度更重',
};
const conditions = {
  eq: '等于',
  ne: '不等于',
  lt: '小于',
  lte: '小于或等于',
  gt: '大于',
  gte: '大于或等于',
};
export const outcomes: Record<string, string> = {
  Complete: '可出分',
  Incomplete: '作答不足',
  Rejected: '规则拒绝',
};
export const entries = (records: Record<string, string>) =>
  Object.entries(records).map(([value, label]) => ({ value, label }));
export const careOptions = entries(care);
export const stageOptions = entries(stage);

const defaultRules: RuleDefinition = {
  rounding: 'HalfUp',
  precision: 2,
  missing: 'Require',
  minimum_answered: 1,
  total_mode: 'Items',
  direction: 'Descriptive',
  applicability: [],
  questions: [],
  dimensions: [],
  bands: [],
  norms: [],
  cases: [],
  comparisons: [],
};
const inputStyles = { width: '100%' };

function TextField({
  path,
  label,
  limit = 140,
}: {
  path: Path;
  label: string;
  limit?: number;
}) {
  return (
    <Form.Item name={path} label={label}>
      <Input maxLength={limit} />
    </Form.Item>
  );
}
function NumberField({
  path,
  label,
  min,
  max,
  integer,
  strings,
}: {
  path: Path;
  label: string;
  min?: number;
  max?: number;
  integer?: boolean;
  strings?: boolean;
}) {
  return (
    <Form.Item name={path} label={label}>
      <InputNumber
        min={min}
        max={max}
        precision={integer ? 0 : 4}
        stringMode={strings}
        style={inputStyles}
      />
    </Form.Item>
  );
}
function ChoiceField({
  path,
  label,
  options,
  multiple,
  tags,
}: {
  path: Path;
  label: string;
  options: { value: string; label: string }[];
  multiple?: boolean;
  tags?: boolean;
}) {
  return (
    <Form.Item name={path} label={label}>
      <Select
        mode={tags ? 'tags' : multiple ? 'multiple' : undefined}
        options={options}
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        style={inputStyles}
      />
    </Form.Item>
  );
}
function CheckField({ path, label }: { path: Path; label: string }) {
  return (
    <Form.Item name={path} valuePropName="checked">
      <Checkbox>{label}</Checkbox>
    </Form.Item>
  );
}
function FormRows({
  name,
  label,
  initial,
  render,
}: {
  name: string | Path;
  label: string;
  initial: object;
  render: (index: number) => ReactNode;
}) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <Flex vertical gap={12}>
          {fields.map(({ key, name: index }) => (
            <Card
              key={key}
              size="small"
              title={`${label} ${index + 1}`}
              extra={
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => remove(index)}
                >
                  移除
                </Button>
              }
            >
              {render(index)}
            </Card>
          ))}
          <Button type="dashed" onClick={() => add(initial)}>
            新增{label}
          </Button>
        </Flex>
      )}
    </Form.List>
  );
}
function CohortFields({ path }: { path: Path }) {
  return (
    <>
      <ChoiceField
        path={[...path, 'care']}
        label="适用场景"
        options={careOptions}
        multiple
      />
      <ChoiceField
        path={[...path, 'stages']}
        label="适用阶段"
        options={stageOptions}
        multiple
      />
      <ChoiceField
        path={[...path, 'sexes']}
        label="患者档案登记性别（按原值录入）"
        options={[]}
        tags
      />
      <Space wrap>
        <NumberField
          path={[...path, 'age_min']}
          label="最低年龄（整岁）"
          min={0}
          max={150}
          integer
        />
        <NumberField
          path={[...path, 'age_max']}
          label="最高年龄（整岁）"
          min={0}
          max={150}
          integer
        />
      </Space>
    </>
  );
}

function IntervalFields({ path }: { path: Path }) {
  return (
    <Space wrap>
      <NumberField path={[...path, 'min']} label="区间起点" strings />
      <NumberField path={[...path, 'max']} label="区间终点" strings />
      <CheckField path={[...path, 'include_min']} label="含起点" />
      <CheckField path={[...path, 'include_max']} label="含终点" />
    </Space>
  );
}

function AnswerCondition({
  path,
  label,
  items,
}: {
  path: Path;
  label: string;
  items: { value: string; label: string }[];
}) {
  return (
    <Flex vertical>
      <Typography.Text strong>{label}</Typography.Text>
      <ChoiceField path={[...path, 'item']} label="前置题目" options={items} />
      <Space wrap>
        <ChoiceField
          path={[...path, 'operator']}
          label="比较方式"
          options={entries(conditions)}
        />
        <NumberField path={[...path, 'score']} label="分值" strings />
      </Space>
    </Flex>
  );
}

export default function RuleEditor({
  items,
  value,
  onChange,
  disabled,
}: {
  items: Item[];
  value?: RuleDefinition;
  onChange: (value?: RuleDefinition) => void;
  disabled: boolean;
}) {
  const itemChoices = items
    .filter((item) => item.parameter.trim())
    .map(({ parameter }) => ({ value: parameter, label: parameter }));
  const metrics = [
    { value: 'total', label: '总分' },
    { value: 'standard', label: '常模标准分' },
    ...(value?.dimensions || []).flatMap((row) =>
      row.id
        ? [{ value: `dimension:${row.id}`, label: row.label || row.id }]
        : [],
    ),
  ];
  return (
    <Flex vertical gap={14}>
      <Space>
        <Switch
          checked={!!value}
          disabled={disabled}
          aria-label="启用量表规则"
          onChange={(enabled) => onChange(enabled ? defaultRules : undefined)}
        />
        <Typography.Text strong>启用量表规则</Typography.Text>
      </Space>
      {!value ? (
        <Alert title="按题目整数得分求和" type="info" />
      ) : (
        <Form<RuleDefinition>
          layout="vertical"
          disabled={disabled}
          initialValues={value}
          onValuesChange={(_, next) =>
            onChange({
              ...next,
              questions: next.questions?.map((row) => ({
                ...row,
                show_if: row.show_if?.item ? row.show_if : null,
                require_if: row.require_if?.item ? row.require_if : null,
              })),
            })
          }
        >
          <Collapse
            items={[
              {
                key: 'summary',
                label: '总分与缺答策略',
                forceRender: true,
                children: (
                  <>
                    <ChoiceField
                      path={['total_mode']}
                      label="总分汇总"
                      options={entries(modes)}
                    />
                    <ChoiceField
                      path={['missing']}
                      label="缺答策略"
                      options={entries(missing)}
                    />
                    <NumberField
                      path={['minimum_answered']}
                      label="最低有效作答题数"
                      min={1}
                      max={500}
                      integer
                    />
                    <ChoiceField
                      path={['rounding']}
                      label="舍入方式（正式总分取整数）"
                      options={entries(rounding)}
                    />
                    <NumberField
                      path={['precision']}
                      label="维度分保留小数位数"
                      min={0}
                      max={4}
                      integer
                    />
                    <ChoiceField
                      path={['direction']}
                      label="分值方向"
                      options={entries(direction)}
                    />
                  </>
                ),
              },
              {
                key: 'scope',
                label: '适用条件',
                forceRender: true,
                children: (
                  <FormRows
                    name="applicability"
                    label="适用条件"
                    initial={{ when: {} }}
                    render={(i) => (
                      <>
                        <TextField path={[i, 'label']} label="适用人群名称" />
                        <CohortFields path={[i, 'when']} />
                      </>
                    )}
                  />
                ),
              },
              {
                key: 'questions',
                label: '逐题规则与条件跳题',
                forceRender: true,
                children: (
                  <FormRows
                    name="questions"
                    label="逐题规则"
                    initial={{
                      required: value.missing !== 'Available',
                      weight: '1',
                      reverse: false,
                    }}
                    render={(i) => (
                      <>
                        <ChoiceField
                          path={[i, 'item']}
                          label="规则题目"
                          options={itemChoices}
                        />
                        <Space wrap>
                          <CheckField
                            path={[i, 'required']}
                            label="显示时必答"
                          />
                          <CheckField path={[i, 'reverse']} label="反向计分" />
                          <NumberField
                            path={[i, 'weight']}
                            label="题目权重"
                            min={0}
                            max={100}
                            strings
                          />
                        </Space>
                        <AnswerCondition
                          path={[i, 'show_if']}
                          label="显示条件（选填）"
                          items={itemChoices}
                        />
                        <AnswerCondition
                          path={[i, 'require_if']}
                          label="条件必答（选填）"
                          items={itemChoices}
                        />
                      </>
                    )}
                  />
                ),
              },
              {
                key: 'dimensions',
                label: '维度分',
                forceRender: true,
                children: (
                  <FormRows
                    name="dimensions"
                    label="维度"
                    initial={{ weight: '1', items: [] }}
                    render={(i) => (
                      <>
                        <TextField
                          path={[i, 'id']}
                          label="维度编码"
                          limit={40}
                        />
                        <TextField path={[i, 'label']} label="维度名称" />
                        <ChoiceField
                          path={[i, 'items']}
                          label="包含题目"
                          options={itemChoices}
                          multiple
                        />
                        <NumberField
                          path={[i, 'weight']}
                          label="汇总到总分的维度权重"
                          min={0}
                          max={100}
                          strings
                        />
                      </>
                    )}
                  />
                ),
              },
              {
                key: 'bands',
                label: '结果分段与解释',
                forceRender: true,
                children: (
                  <FormRows
                    name="bands"
                    label="结果区间"
                    initial={{
                      metric: 'total',
                      include_min: true,
                      include_max: true,
                      interpretation: '',
                    }}
                    render={(i) => (
                      <>
                        <ChoiceField
                          path={[i, 'metric']}
                          label="解释指标"
                          options={metrics}
                        />
                        <IntervalFields path={[i]} />
                        <TextField path={[i, 'label']} label="等级名称" />
                        <TextField
                          path={[i, 'interpretation']}
                          label="结果解释"
                          limit={2000}
                        />
                      </>
                    )}
                  />
                ),
              },
              {
                key: 'norms',
                label: '常模与标准分',
                forceRender: true,
                children: (
                  <FormRows
                    name="norms"
                    label="常模"
                    initial={{ when: {}, rows: [] }}
                    render={(i) => (
                      <>
                        <TextField
                          path={[i, 'id']}
                          label="常模编码"
                          limit={40}
                        />
                        <TextField path={[i, 'label']} label="常模名称" />
                        <TextField
                          path={[i, 'version']}
                          label="常模版本"
                          limit={80}
                        />
                        <TextField
                          path={[i, 'reference']}
                          label="常模来源"
                          limit={2000}
                        />
                        <CohortFields path={[i, 'when']} />
                        <FormRows
                          name={[i, 'rows']}
                          label="换算区间"
                          initial={{ include_min: true, include_max: true }}
                          render={(j) => (
                            <>
                              <IntervalFields path={[j]} />
                              <NumberField
                                path={[j, 'value']}
                                label="标准分"
                                strings
                              />
                            </>
                          )}
                        />
                      </>
                    )}
                  />
                ),
              },
              {
                key: 'comparisons',
                label: '跨版本总分换算',
                forceRender: true,
                children: (
                  <FormRows
                    name="comparisons"
                    label="跨版本换算"
                    initial={{ factor: '1', offset: '0' }}
                    render={(i) => (
                      <>
                        <NumberField
                          path={[i, 'version']}
                          label="已发布的前序版本"
                          min={1}
                          max={100}
                          integer
                        />
                        <NumberField
                          path={[i, 'factor']}
                          label="前序总分乘以"
                          strings
                        />
                        <NumberField
                          path={[i, 'offset']}
                          label="再加上"
                          strings
                        />
                        <TextField
                          path={[i, 'reference']}
                          label="换算依据"
                          limit={2000}
                        />
                      </>
                    )}
                  />
                ),
              },
              {
                key: 'cases',
                label: '试算用例',
                forceRender: true,
                children: (
                  <FormRows
                    name="cases"
                    label="试算用例"
                    initial={{
                      context: { care: 'Outpatient', stage: 'Initial' },
                      expected_state: 'Complete',
                      expected_grade: '',
                      answers: {},
                    }}
                    render={(i) => (
                      <>
                        <TextField path={[i, 'label']} label="用例名称" />
                        <ChoiceField
                          path={[i, 'context', 'care']}
                          label="就诊场景"
                          options={careOptions}
                        />
                        <ChoiceField
                          path={[i, 'context', 'stage']}
                          label="评估阶段"
                          options={stageOptions}
                        />
                        <NumberField
                          path={[i, 'context', 'age']}
                          label="年龄（整岁）"
                          min={0}
                          max={150}
                          integer
                        />
                        <TextField
                          path={[i, 'context', 'sex']}
                          label="登记性别"
                        />
                        <ChoiceField
                          path={[i, 'expected_state']}
                          label="预期状态"
                          options={entries(outcomes)}
                        />
                        <NumberField
                          path={[i, 'expected_total']}
                          label="预期总分（选填）"
                          integer
                        />
                        <TextField
                          path={[i, 'expected_grade']}
                          label="预期总分等级（选填）"
                        />
                        <Flex gap={8} wrap>
                          {itemChoices.map(({ value: item, label }) => (
                            <NumberField
                              path={[i, 'answers', item]}
                              key={item}
                              label={label}
                              integer
                            />
                          ))}
                        </Flex>
                      </>
                    )}
                  />
                ),
              },
            ]}
          />
        </Form>
      )}
    </Flex>
  );
}
