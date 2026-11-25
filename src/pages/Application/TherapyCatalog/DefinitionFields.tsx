import {
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
} from '@ant-design/pro-components';
import { Col, Row } from 'antd';
import type { ReactNode } from 'react';
import { definitionFlags } from './service';

export default function DefinitionFields({
  visible,
  allowed,
}: {
  visible: Set<string>;
  allowed: (field: string) => boolean;
}) {
  const cell = (name: string, content: ReactNode) =>
    visible.has(name) ? (
      <Col key={name} xs={24} sm={12} md={8}>
        {content}
      </Col>
    ) : null;
  return (
    <Row gutter={16}>
      {cell(
        'rehab_execution_mode',
        <ProFormSelect
          name="rehab_execution_mode"
          label="执行模式"
          disabled={!allowed('rehab_execution_mode')}
          options={[
            { value: 'Serial', label: '串行执行' },
            { value: 'Parallel', label: '并行执行' },
          ]}
          rules={[{ required: true }]}
        />,
      )}
      {cell(
        'rehab_booking_mode',
        <ProFormSelect
          name="rehab_booking_mode"
          label="预约模式"
          disabled={!allowed('rehab_booking_mode')}
          options={[
            { value: 'Personnel', label: '人员模式' },
            { value: 'Equipment', label: '设备模式' },
          ]}
          rules={[{ required: true }]}
        />,
      )}
      {cell(
        'rehab_booking_limit',
        <ProFormDigit
          name="rehab_booking_limit"
          label="预约数量限制"
          disabled={!allowed('rehab_booking_limit')}
          min={1}
          max={500}
          fieldProps={{ precision: 0 }}
          rules={[{ required: true }]}
        />,
      )}
      {cell(
        'rehab_booking_required',
        <ProFormSwitch
          name="rehab_booking_required"
          label="是否需要预约"
          disabled={!allowed('rehab_booking_required')}
        />,
      )}
      {cell(
        'rehab_gap_minutes',
        <ProFormDigit
          name="rehab_gap_minutes"
          label="同一患者项目前后间隔（分钟）"
          disabled={!allowed('rehab_gap_minutes')}
          min={0}
          max={10080}
          fieldProps={{ precision: 0 }}
        />,
      )}
      {definitionFlags.map(([name, label]) =>
        cell(
          name,
          <ProFormSwitch
            key={name}
            name={name}
            label={label}
            disabled={!allowed(name)}
          />,
        ),
      )}
    </Row>
  );
}
