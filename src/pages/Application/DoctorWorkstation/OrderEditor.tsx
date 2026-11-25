import {
  EditableProTable,
  type ProColumns,
  ProForm,
  ProFormCheckbox,
  ProFormDatePicker,
  ProFormDateTimePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Col,
  Collapse,
  Drawer,
  Form,
  Row,
  Space,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import * as S from './service';

type Risk = { key: string; label: string; result?: string; finding?: string };
type LinkedItems = {
  therapy: string;
  care: string;
  options: S.Choice[];
  error?: string;
};
const itemDefaults = (choice?: S.Choice) => ({
  sessions: choice?.sessions || 1,
  order_term: choice?.order_term || undefined,
});
const durationFields = [
  'planned_duration',
  'duration_min',
  'duration_max',
] as const;
const roles: Record<string, string> = {
  'Rehab Physician': '康复医师',
  'Rehab Therapist': '康复治疗师',
  'Rehab Nurse': '康复护士',
};
const results = {
  Clear: '已核对，可按要求治疗',
  Precaution: '需注意',
  Contraindicated: '存在禁忌',
  Unknown: '尚未核实',
};
const riskColumns: ProColumns<Risk>[] = [
  {
    title: '风险核对项',
    dataIndex: 'label',
    formItemProps: { rules: [{ required: true }] },
  },
  {
    title: '核对结果',
    dataIndex: 'result',
    valueType: 'select',
    valueEnum: results,
    formItemProps: { rules: [{ required: true }] },
  },
  { title: '核对发现', dataIndex: 'finding', valueType: 'textarea' },
];

export default function OrderEditor({
  context,
  kind,
  initial,
  timezone,
  disabled,
  onClose,
  onAdd,
  onDirty,
}: {
  context: S.Context;
  kind: 'Treatment' | 'Assessment';
  initial?: S.OrderItem;
  timezone: string;
  disabled: boolean;
  onClose: () => void;
  onAdd: (item: S.OrderItem) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [risk, setRisk] = useState<readonly Risk[]>(
    initial?.prescription?.risk.checks || [
      { key: 'clinical_check', label: '适应证、禁忌及注意事项' },
    ],
  );
  const [assessors, setAssessors] = useState<S.Choice[]>([]);
  const [linkedItems, setLinkedItems] = useState<LinkedItems>();
  const [linkAttempt, setLinkAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [durationDefaults, setDurationDefaults] = useState<
    S.OrderDuration | undefined
  >(() => {
    const value = initial?.prescription;
    return (
      value && {
        planned_duration: value.planned_duration ?? value.duration_min,
        duration_min: value.duration_min,
        duration_max: value.duration_max,
      }
    );
  });
  const [durationError, setDurationError] = useState<string>();
  const [adjustDuration, setAdjustDuration] = useState(false);
  const assignee = Form.useWatch('assignee', form);
  const treatment = kind === 'Treatment';
  const visit = context.context;
  const patient = context.visit.row;
  const initialCare =
    initial?.care_setting ||
    (patient.kind === 'inpatient' ? 'Inpatient' : 'Outpatient');
  const careSetting = Form.useWatch('care_setting', form) || initialCare;
  const selectedTherapy: string | undefined = Form.useWatch(
    'therapy_type',
    form,
  );
  const selectedItem: string | undefined = Form.useWatch('order_item', form);
  const currentLinks =
    linkedItems?.therapy === selectedTherapy &&
    linkedItems?.care === careSetting
      ? linkedItems
      : undefined;
  const orderItems = currentLinks?.options ?? [];
  const loadingLinks = Boolean(selectedTherapy && !currentLinks);
  const validOrderItem = orderItems.some((row) => row.value === selectedItem);
  const formId = 'doctor-order-editor';
  const lookup = async (
    type: string,
    keyword = '',
    filters?: Parameters<typeof S.references>[3],
  ) => {
    try {
      return await S.references(visit.key, type, keyword, filters);
    } catch (e) {
      message.error(errorMessage(e));
      return [];
    }
  };
  useEffect(() => {
    if (!treatment || !selectedTherapy) return;
    let active = true;
    const request = { therapy: selectedTherapy, care: careSetting };
    S.references(visit.key, 'linked_order_item', '', {
      therapy_type: selectedTherapy,
      care_setting: careSetting,
    }).then(
      (options) => {
        if (!active) return;
        setLinkedItems({ ...request, options });
        if (
          options.length === 1 &&
          form.getFieldValue('therapy_type') === selectedTherapy &&
          form.getFieldValue('care_setting') === careSetting &&
          !form.getFieldValue('order_item')
        ) {
          const item = options[0];
          form.setFieldsValue({
            order_item: item.value,
            ...itemDefaults(item),
          });
        }
      },
      (error) => {
        if (active)
          setLinkedItems({
            ...request,
            options: [],
            error: errorMessage(error),
          });
      },
    );
    return () => {
      active = false;
    };
  }, [treatment, selectedTherapy, careSetting, form, visit.key, linkAttempt]);
  const values = initial
    ? {
        ...initial,
        care_setting: initialCare,
        ...initial.prescription,
        planned_duration:
          initial.prescription?.planned_duration ??
          initial.prescription?.duration_min,
        risk_disposition: initial.prescription?.risk.disposition,
        risk_assessed_at: initial.prescription?.risk.assessed_at,
        precautions: initial.prescription?.risk.precautions,
      }
    : {
        sessions: 1,
        care_setting: initialCare,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        period_kind: 'Calendar',
        period_days: 1,
        gap_minutes: 0,
        execution_role: 'Rehab Therapist',
        stage: 'Initial',
      };
  return (
    <Drawer
      open
      title={`${initial ? '编辑' : '新建'}${S.kindName(kind)}`}
      size="min(880px, 100vw)"
      mask={{ closable: false }}
      keyboard={!disabled}
      closable={{ disabled }}
      onClose={onClose}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button disabled={disabled} onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            form={formId}
            disabled={
              disabled || (treatment && (!validOrderItem || !durationDefaults))
            }
          >
            {initial ? '更新待开项目' : '加入待开清单'}
          </Button>
        </Space>
      }
    >
      <Space wrap size="middle" style={{ marginBottom: 20 }}>
        <Typography.Text strong>{patient.patient_name}</Typography.Text>
        <Typography.Text>{patient.patient}</Typography.Text>
        <Typography.Text>
          {patient.kind === 'inpatient' ? '住院' : '门诊'}
        </Typography.Text>
        <Typography.Text type="secondary">
          本次就诊 {patient.name}
        </Typography.Text>
        <Typography.Text type="secondary">医院时间 {timezone}</Typography.Text>
      </Space>
      <ProForm<Record<string, unknown>>
        form={form}
        name={formId}
        id={formId}
        initialValues={values}
        disabled={disabled}
        grid
        rowProps={{ gutter: 16 }}
        colProps={{ xs: 24, md: 12 }}
        onValuesChange={() => onDirty(true)}
        onFinishFailed={() => setExpanded(['rules'])}
        submitter={false}
        onFinish={async (v) => {
          if (
            treatment &&
            (currentLinks?.therapy !== v.therapy_type ||
              currentLinks?.care !== v.care_setting ||
              !orderItems.some((row) => row.value === v.order_item))
          ) {
            message.error('请选择当前治疗项目可用的医嘱项目。');
            return false;
          }
          if (
            treatment &&
            risk.some(
              (r) =>
                !r.label?.trim() ||
                !r.result ||
                (r.result !== 'Clear' && !r.finding?.trim()),
            )
          ) {
            setExpanded(['rules']);
            message.error(
              '请完整核对风险条目，并填写需注意、禁忌或未核实项的发现。',
            );
            return false;
          }
          const common = {
            ...initial,
            kind,
            clinical_reviewer: String(v.clinical_reviewer),
            notes: String(v.notes || ''),
          };
          const duration = adjustDuration
            ? {
                planned_duration: v.planned_duration as number,
                duration_min: v.duration_min as number,
                duration_max: v.duration_max as number,
              }
            : durationDefaults;
          if (
            treatment &&
            (!duration ||
              !durationFields.every((field) => {
                const minutes = duration[field];
                return (
                  Number.isInteger(minutes) && minutes >= 1 && minutes <= 720
                );
              }) ||
              duration.planned_duration < duration.duration_min ||
              duration.planned_duration > duration.duration_max)
          ) {
            message.error('单次预约时长须在最短和最长时长之间。');
            return;
          }
          const item: S.OrderItem = treatment
            ? {
                ...common,
                order_item: String(v.order_item),
                therapy_type: String(v.therapy_type),
                sessions: Number(v.sessions),
                order_term: String(v.order_term),
                care_setting: String(v.care_setting),
                start_date: String(v.start_date),
                end_date: String(v.end_date),
                team: String(v.team),
                execution_role: String(v.execution_role),
                overlap_reason: String(v.overlap_reason || ''),
                prescription: {
                  ...initial?.prescription,
                  schema:
                    initial?.prescription?.schema || 'rehab-prescription-v1',
                  ...(duration as S.OrderDuration),
                  period_kind: String(v.period_kind),
                  period_days: Number(v.period_days),
                  period_limit: Number(v.period_limit),
                  gap_minutes: Number(v.gap_minutes),
                  weekdays: v.weekdays as number[],
                  equipment: String(v.equipment),
                  risk: {
                    disposition: String(v.risk_disposition),
                    assessed_at: String(v.risk_assessed_at),
                    checks: risk.map((r) => ({
                      key: r.key,
                      label: r.label,
                      result: String(r.result),
                      finding: r.finding || '',
                    })),
                    precautions: String(v.precautions || ''),
                  },
                },
              }
            : {
                ...common,
                template: String(v.template),
                assignee: String(v.assignee),
                role: String(v.role),
                stage: String(v.stage),
                due_date: String(v.due_date),
                reuse_assessment: Boolean(v.reuse_assessment),
              };
          onAdd(item);
          onDirty(false);
          return true;
        }}
      >
        {treatment ? (
          <>
            <ProFormSelect
              name="therapy_type"
              label="治疗项目"
              colProps={{ span: 24 }}
              rules={[{ required: true }]}
              showSearch
              params={{
                care_setting: careSetting,
                therapy_type: selectedTherapy,
              }}
              request={({ keyWords, ...filters }) =>
                lookup('treatment_project', keyWords, filters)
              }
              fieldProps={{
                placeholder: '搜索治疗项目名称或编码',
                onChange: (_, option) => {
                  const choice = Array.isArray(option)
                    ? undefined
                    : (option as S.Choice | undefined);
                  setDurationDefaults(choice?.duration_defaults);
                  setDurationError(choice?.duration_error);
                  setAdjustDuration(false);
                  setLinkedItems(undefined);
                  form.setFieldsValue({
                    order_item: undefined,
                    ...itemDefaults(),
                  });
                },
              }}
            />
            {selectedTherapy && (
              <Col span={24}>
                {durationDefaults ? (
                  <Space
                    orientation="vertical"
                    style={{ width: '100%', marginBottom: 16 }}
                  >
                    <Typography.Text>
                      单次预约时长 {durationDefaults.planned_duration} 分钟
                      {durationDefaults.duration_min !==
                        durationDefaults.duration_max &&
                        ` · 允许 ${durationDefaults.duration_min}–${durationDefaults.duration_max} 分钟`}
                    </Typography.Text>
                    <Checkbox
                      checked={adjustDuration}
                      disabled={disabled}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setAdjustDuration(checked);
                        if (checked) form.setFieldsValue(durationDefaults);
                        onDirty(true);
                      }}
                    >
                      调整本次医嘱时长
                    </Checkbox>
                    {adjustDuration && (
                      <Row gutter={16}>
                        {(
                          [
                            ['planned_duration', '单次预约时长（分钟）'],
                            ['duration_min', '单次最短时长（分钟）'],
                            ['duration_max', '单次最长时长（分钟）'],
                          ] as const
                        ).map(([field, label]) => (
                          <ProFormDigit
                            key={field}
                            name={field}
                            label={label}
                            min={1}
                            max={720}
                            fieldProps={{ precision: 0 }}
                            colProps={{ xs: 24, md: 8 }}
                            rules={[{ required: true }]}
                          />
                        ))}
                      </Row>
                    )}
                  </Space>
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    title={durationError || '请核对所选治疗项目的默认时长。'}
                  />
                )}
              </Col>
            )}
            <ProFormSelect
              name="order_item"
              label="医嘱项目"
              colProps={{ span: 24 }}
              rules={[{ required: true }]}
              options={orderItems}
              showSearch
              fieldProps={{
                loading: loadingLinks,
                disabled:
                  disabled ||
                  !orderItems.length ||
                  (orderItems.length === 1 && validOrderItem),
                placeholder: selectedTherapy
                  ? '选择关联的医嘱项目'
                  : '先选择治疗项目',
                showSearch: { optionFilterProp: 'label' },
                onChange: (value) =>
                  form.setFieldsValue(
                    itemDefaults(orderItems.find((row) => row.value === value)),
                  ),
              }}
              extra={
                currentLinks?.error ? (
                  <Space wrap>
                    <Typography.Text type="danger">
                      {currentLinks.error}
                    </Typography.Text>
                    <Button
                      type="link"
                      size="small"
                      disabled={disabled}
                      onClick={() => {
                        setLinkedItems(undefined);
                        setLinkAttempt((value) => value + 1);
                      }}
                    >
                      重试
                    </Button>
                  </Space>
                ) : currentLinks && !orderItems.length ? (
                  '没有可用的关联医嘱项目，请核对项目关联、启用状态和权限。'
                ) : currentLinks && selectedItem && !validOrderItem ? (
                  '原医嘱项目已不在可用关联中，请重新选择。'
                ) : orderItems.length === 1 && validOrderItem ? (
                  '已带出此治疗项目唯一可用的医嘱项目。'
                ) : undefined
              }
            />
            <ProFormSelect
              name="order_term"
              label="医嘱期限"
              valueEnum={{ Temporary: '临时', 'Long Term': '长期' }}
              rules={[{ required: true }]}
            />
            <ProFormDigit
              name="sessions"
              label="计划次数"
              min={1}
              max={10000}
              fieldProps={{ precision: 0 }}
              rules={[{ required: true }]}
            />
            <ProFormDatePicker
              name="start_date"
              label="开始日期"
              rules={[{ required: true }]}
            />
            <ProFormDatePicker
              name="end_date"
              label="结束日期"
              rules={[
                { required: true },
                {
                  validator: (_: unknown, v: string) =>
                    !v ||
                    !dayjs(v).isBefore(form.getFieldValue('start_date'), 'day')
                      ? Promise.resolve()
                      : Promise.reject(new Error('结束日期不能早于开始日期')),
                },
              ]}
            />
            <ProFormSelect
              name="care_setting"
              label="执行场景"
              options={
                context.visit.row.kind === 'inpatient'
                  ? [
                      { value: 'Inpatient', label: '住院' },
                      { value: 'Bedside', label: '床旁' },
                    ]
                  : [{ value: 'Outpatient', label: '门诊' }]
              }
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="team"
              label="接收治疗组"
              showSearch
              request={async ({ keyWords }) => lookup('team', keyWords)}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="execution_role"
              label="执行岗位"
              valueEnum={roles}
              rules={[{ required: true }]}
            />
            <Col span={24}>
              <Collapse
                activeKey={expanded}
                onChange={(keys) =>
                  setExpanded(Array.isArray(keys) ? keys : [keys])
                }
                items={[
                  {
                    key: 'rules',
                    label: '频次与临床风险核对（必填）',
                    forceRender: true,
                    children: (
                      <Row gutter={16}>
                        <ProFormSelect
                          name="period_kind"
                          label="频次计算方式"
                          valueEnum={{
                            Calendar: '固定日历周期',
                            Rolling: '滚动时间窗',
                          }}
                          rules={[{ required: true }]}
                        />
                        <ProFormDigit
                          name="period_days"
                          label="每周期天数"
                          min={1}
                          max={366}
                          fieldProps={{ precision: 0 }}
                          rules={[{ required: true }]}
                        />
                        <ProFormDigit
                          name="period_limit"
                          label="每周期次数上限"
                          min={1}
                          max={10000}
                          fieldProps={{ precision: 0 }}
                          rules={[{ required: true }]}
                        />
                        <ProFormDigit
                          name="gap_minutes"
                          label="两次治疗最短间隔（分钟）"
                          min={0}
                          max={527040}
                          fieldProps={{ precision: 0 }}
                          rules={[{ required: true }]}
                        />
                        <ProFormCheckbox.Group
                          name="weekdays"
                          label="允许治疗的星期"
                          colProps={{ span: 24 }}
                          options={[
                            '周一',
                            '周二',
                            '周三',
                            '周四',
                            '周五',
                            '周六',
                            '周日',
                          ].map((label, value) => ({ label, value }))}
                          rules={[{ required: true, type: 'array', min: 1 }]}
                        />
                        <ProFormSelect
                          name="equipment"
                          label="设备要求"
                          valueEnum={{
                            Required: '必须使用设备',
                            Optional: '按需使用',
                          }}
                          rules={[{ required: true }]}
                        />
                        <Col span={24}>
                          <Typography.Title level={5}>
                            临床风险核对
                          </Typography.Title>
                        </Col>
                        <Col span={24}>
                          <EditableProTable<Risk>
                            cardProps={false}
                            scroll={{ x: 520 }}
                            rowKey="key"
                            columns={riskColumns}
                            value={risk}
                            onChange={(rows) => {
                              setRisk(rows);
                              onDirty(true);
                            }}
                            recordCreatorProps={false}
                            search={false}
                            options={false}
                            toolBarRender={false}
                            editable={{
                              type: 'multiple',
                              editableKeys: risk.map((r) => r.key),
                              onValuesChange: (_, rows) => {
                                setRisk(rows);
                                onDirty(true);
                              },
                            }}
                          />
                        </Col>
                        <ProFormSelect
                          name="risk_disposition"
                          label="风险核对结论"
                          valueEnum={{
                            Clear: '已核对，无需额外处置',
                            Precautions: '按注意事项治疗',
                            'Do Not Treat': '暂不治疗',
                          }}
                          rules={[{ required: true }]}
                        />
                        <ProFormDateTimePicker
                          name="risk_assessed_at"
                          label="实际核对时间（医院时间）"
                          rules={[{ required: true }]}
                        />
                        <Col span={24}>
                          <Space>
                            <Button
                              size="small"
                              disabled={disabled}
                              onClick={async () => {
                                try {
                                  const v = await S.options();
                                  form.setFieldValue(
                                    'risk_assessed_at',
                                    dayjs(v.site_now),
                                  );
                                  onDirty(true);
                                } catch (e) {
                                  message.error(errorMessage(e));
                                }
                              }}
                            >
                              使用当前医院时间
                            </Button>
                            <Typography.Text type="secondary">
                              不自动代替医生完成风险核对
                            </Typography.Text>
                          </Space>
                        </Col>
                        <ProFormTextArea
                          name="precautions"
                          label="注意及处置方案"
                          colProps={{ span: 24 }}
                        />
                        <ProFormTextArea
                          name="overlap_reason"
                          label="相同项目仍需新开时的临床依据"
                          colProps={{ span: 24 }}
                          extra="存在重叠医嘱时由服务端校验，不能只通过重复点击继续。"
                        />
                      </Row>
                    ),
                  },
                ]}
              />
            </Col>
          </>
        ) : (
          <>
            <ProFormSelect
              name="template"
              label="评估量表"
              colProps={{ span: 24 }}
              showSearch
              request={async ({ keyWords }) => lookup('template', keyWords)}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="stage"
              label="评估阶段"
              valueEnum={{
                Initial: '初期评估',
                Interim: '中期评估',
                Final: '出院 / 终期评估',
              }}
              rules={[{ required: true }]}
            />
            <ProFormDatePicker
              name="due_date"
              label="要求完成日期"
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="assignee"
              label="评估执行人"
              colProps={{ span: 24 }}
              showSearch
              request={async ({ keyWords }) => {
                const rows = await lookup('assessor', keyWords);
                setAssessors(rows);
                return rows;
              }}
              fieldProps={{
                onChange: () => form.setFieldValue('role', undefined),
              }}
              rules={[{ required: true }]}
            />
            <ProFormSelect
              name="role"
              label="评估执行岗位"
              options={(
                assessors.find((r) => r.value === assignee)?.roles ||
                (initial?.role && assignee === initial.assignee
                  ? [initial.role]
                  : [])
              )
                .filter((r) => roles[r])
                .map((value) => ({ value, label: roles[value] }))}
              rules={[{ required: true }]}
            />
            <ProFormCheckbox name="reuse_assessment" colProps={{ span: 24 }}>
              同次就诊、同阶段、同量表已有有效待办时，明确引用已有任务
            </ProFormCheckbox>
            <Col span={24}>
              <Alert
                type="info"
                showIcon
                title="评估医嘱经指定医生确认后形成评估待办，量表和评分版本随任务冻结。"
              />
            </Col>
          </>
        )}
        <ProFormSelect
          name="clinical_reviewer"
          label="指定临床确认医生"
          colProps={{ span: 24 }}
          showSearch
          request={async ({ keyWords }) =>
            lookup(treatment ? 'reviewer' : 'assessment_reviewer', keyWords)
          }
          rules={[{ required: true }]}
        />
        <ProFormTextArea
          name="notes"
          label={treatment ? '临床目的与注意事项' : '评估目的与要求'}
          colProps={{ span: 24 }}
          rules={[{ required: true, whitespace: true, max: 4000 }]}
        />
      </ProForm>
    </Drawer>
  );
}
