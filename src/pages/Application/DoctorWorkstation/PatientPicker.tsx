import {
  Alert,
  Button,
  Col,
  Divider,
  Empty,
  Flex,
  Input,
  Modal,
  Pagination,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import { states } from '../PatientVisits/service';
import * as S from './service';

const pageSize = 5;
type Page<T> = { data: T[]; total: number };

function usePickerPage<T>(load: () => Promise<Page<T>>, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    load: typeof load;
    page?: Page<T>;
    error?: string;
  }>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    load().then(
      (page) => active && setResult({ load, page }),
      (error) => active && setResult({ load, error: errorMessage(error) }),
    );
    return () => {
      active = false;
    };
  }, [attempt, enabled, load]);
  return {
    result: result?.load === load ? result : undefined,
    retry: () => {
      setResult(undefined);
      setAttempt((value) => value + 1);
    },
  };
}

function PickerResults<T>({
  query,
  current,
  onPage,
  empty,
  disabled,
  children,
}: {
  query: ReturnType<typeof usePickerPage<T>>;
  current: number;
  onPage: (value: number) => void;
  empty: string;
  disabled: boolean;
  children: (rows: T[]) => ReactNode;
}) {
  const { result, retry } = query;
  if (!result) return <Spin aria-label="正在加载" />;
  if (result.error)
    return (
      <Alert
        type="error"
        showIcon
        title={result.error}
        action={
          <Button size="small" disabled={disabled} onClick={retry}>
            重试
          </Button>
        }
      />
    );
  const { data, total } = result.page ?? { data: [], total: 0 };
  return (
    <Flex vertical gap={12}>
      {data.length ? (
        children(data)
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />
      )}
      {total > pageSize && (
        <Pagination
          simple
          size="small"
          current={current}
          pageSize={pageSize}
          total={total}
          disabled={disabled}
          onChange={onPage}
        />
      )}
    </Flex>
  );
}

export default function PatientPicker({
  hasDoctor,
  locked,
  onCancel,
  onConfirm,
}: {
  hasDoctor: boolean;
  locked: boolean;
  onCancel: () => void;
  onConfirm: (key: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<S.VisitKind>('outpatient');
  const [scope, setScope] = useState<S.PatientScope>(
    hasDoctor ? 'mine' : 'authorized',
  );
  const [view, setView] = useState<S.VisitView>('today');
  const [keyword, setKeyword] = useState('');
  const [patientPage, setPatientPage] = useState(1);
  const [visitPage, setVisitPage] = useState(1);
  const [patient, setPatient] = useState<S.PatientChoice>();
  const [selected, setSelected] = useState<S.PatientEncounter>();
  const [confirming, setConfirming] = useState(false);
  const disabled = locked || confirming;
  const loadPatients = useCallback(
    () =>
      S.patientChoices({
        keyword,
        kind,
        scope,
        view,
        current: patientPage,
        page_size: pageSize,
      }),
    [keyword, kind, scope, view, patientPage],
  );
  const patientId = patient?.patient || '';
  const loadVisits = useCallback(
    () =>
      S.patientEncounters({
        patient: patientId,
        kind,
        scope,
        current: visitPage,
        page_size: pageSize,
      }),
    [patientId, kind, scope, visitPage],
  );
  const patients = usePickerPage(loadPatients);
  const visits = usePickerPage(loadVisits, Boolean(patientId));
  const selectPatient = (value?: S.PatientChoice) => {
    setPatient(value);
    setSelected(undefined);
    setVisitPage(1);
  };
  const resetSearch = () => {
    setPatientPage(1);
    selectPatient();
  };
  const enter = async () => {
    if (disabled || !selected) return;
    setConfirming(true);
    try {
      await onConfirm(selected.key);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      open
      centered
      title="选择患者及就诊"
      width={1080}
      okText="进入本次就诊"
      cancelText="取消"
      onCancel={onCancel}
      onOk={enter}
      confirmLoading={confirming}
      closable={!confirming}
      keyboard={!confirming}
      mask={{ closable: false }}
      okButtonProps={{ disabled: disabled || !selected }}
      cancelButtonProps={{ disabled: confirming }}
      styles={{ body: { maxHeight: '65dvh', overflowY: 'auto' } }}
      footer={(_, { CancelBtn, OkBtn }) => (
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Typography.Text type="secondary">
            {selected
              ? `已选 ${selected.patient_name} · ${selected.name}`
              : '请选择一次就诊'}
          </Typography.Text>
          <Space>
            <CancelBtn />
            <OkBtn />
          </Space>
        </Flex>
      )}
    >
      <Flex wrap gap={12}>
        <Segmented<S.VisitKind>
          aria-label="就诊类型"
          value={kind}
          disabled={disabled}
          options={[
            { label: '门诊', value: 'outpatient' },
            { label: '在院', value: 'inpatient' },
          ]}
          onChange={(value) => {
            setKind(value);
            setView(value === 'inpatient' ? 'current' : 'today');
            resetSearch();
          }}
        />
        <Select<S.PatientScope>
          aria-label="接诊范围"
          value={scope}
          disabled={disabled}
          popupMatchSelectWidth={false}
          options={[
            { label: '本人接诊', value: 'mine', disabled: !hasDoctor },
            { label: '授权范围', value: 'authorized' },
          ]}
          onChange={(value) => {
            setScope(value);
            resetSearch();
          }}
        />
        <Select<S.VisitView>
          aria-label="就诊筛选"
          value={view}
          disabled={disabled}
          popupMatchSelectWidth={false}
          options={[
            ...(kind === 'outpatient'
              ? [{ label: '今日', value: 'today' as const }]
              : []),
            {
              label: kind === 'outpatient' ? '进行中' : '当前在院',
              value: 'current',
            },
            { label: '历史', value: 'history' },
          ]}
          onChange={(value) => {
            setView(value);
            resetSearch();
          }}
        />
      </Flex>
      <Divider />
      <Row gutter={[24, 20]}>
        <Col xs={24} md={9}>
          <Flex vertical gap={12}>
            <Typography.Text strong>患者</Typography.Text>
            <Input.Search
              aria-label="姓名或患者号"
              placeholder="姓名或患者号"
              enterButton="查询"
              allowClear
              maxLength={120}
              disabled={disabled}
              onSearch={(value) => {
                setKeyword(value.trim());
                resetSearch();
              }}
            />
            <PickerResults
              query={patients}
              current={patientPage}
              onPage={(page) => {
                setPatientPage(page);
                selectPatient();
              }}
              empty="当前条件下没有可选患者"
              disabled={disabled}
            >
              {(rows) => (
                <Radio.Group
                  aria-label="患者"
                  orientation="vertical"
                  value={patientId}
                  disabled={disabled}
                  onChange={(event) =>
                    selectPatient(
                      rows.find((row) => row.patient === event.target.value),
                    )
                  }
                >
                  {rows.map((row) => (
                    <Radio key={row.patient} value={row.patient}>
                      <Flex
                        vertical
                        gap={2}
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        <Typography.Text strong>
                          {row.patient_name}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          {[
                            row.patient,
                            row.sex,
                            row.age == null ? '' : `${row.age} 岁`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography.Text>
                      </Flex>
                    </Radio>
                  ))}
                </Radio.Group>
              )}
            </PickerResults>
          </Flex>
        </Col>
        <Col xs={24} md={15}>
          <Flex vertical gap={12} style={{ minHeight: 280 }}>
            <Space wrap>
              <Typography.Text strong>
                {patient ? `${patient.patient_name}的就诊记录` : '就诊记录'}
              </Typography.Text>
              {patient && <Tag>{patient.patient}</Tag>}
            </Space>
            {patient ? (
              <PickerResults
                query={visits}
                current={visitPage}
                onPage={(page) => {
                  setVisitPage(page);
                  setSelected(undefined);
                }}
                empty="当前授权范围内没有就诊记录"
                disabled={disabled}
              >
                {(rows) => (
                  <Radio.Group
                    aria-label="就诊记录"
                    orientation="vertical"
                    value={selected?.key}
                    disabled={disabled}
                    onChange={(event) =>
                      setSelected(
                        rows.find((row) => row.key === event.target.value),
                      )
                    }
                  >
                    {rows.map((row) => (
                      <Radio key={row.key} value={row.key}>
                        <Flex
                          vertical
                          gap={4}
                          style={{ overflowWrap: 'anywhere' }}
                        >
                          <Space size={[8, 4]} wrap>
                            <Typography.Text strong>
                              {[row.date, row.time?.slice(0, 5)]
                                .filter(Boolean)
                                .join(' ') || '未登记日期'}
                            </Typography.Text>
                            <Tag
                              color={
                                ['Open', 'Ordered', 'Admitted'].includes(
                                  row.status,
                                )
                                  ? 'green'
                                  : 'default'
                              }
                            >
                              {states[row.status] || row.status || '—'}
                            </Tag>
                          </Space>
                          <Typography.Text type="secondary">
                            {[
                              row.name,
                              row.kind === 'inpatient' ? '住院' : '门诊',
                              row.department,
                              row.company,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography.Text>
                        </Flex>
                      </Radio>
                    ))}
                  </Radio.Group>
                )}
              </PickerResults>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="请先选择患者"
              />
            )}
          </Flex>
        </Col>
      </Row>
    </Modal>
  );
}
