import { ProTable } from '@ant-design/pro-components';
import { Alert, Tag } from 'antd';
import React, { useState } from 'react';
import {
  careSettings,
  errorMessage,
  propertiesApi,
  type Treatment,
} from './service';

export default function TreatmentLookup({ orderItem }: { orderItem: string }) {
  const [error, setError] = useState<string>();
  const [fields, setFields] = useState<string[]>([]);
  const [readState, setReadState] = useState(false);
  return (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      <ProTable<Treatment>
        rowKey="name"
        search={false}
        params={{ orderItem }}
        scroll={{ x: 760 }}
        request={async ({ current, pageSize, orderItem: selected }) => {
          const result = await propertiesApi<{
            data: Treatment[];
            total: number;
            success: boolean;
            read_fields: string[];
            can_read_state: boolean;
          }>('get_order_treatments', {
            order_item: selected,
            current,
            page_size: pageSize,
          });
          setFields(result.read_fields);
          setReadState(result.can_read_state);
          setError(undefined);
          return result;
        }}
        onRequestError={(reason) => setError(errorMessage(reason))}
        columns={[
          {
            title: '治疗项目编码',
            dataIndex: 'rehab_treatment_code',
            hideInTable: !fields.includes('rehab_treatment_code'),
          },
          {
            title: '治疗项目名称',
            dataIndex: 'rehab_display_label',
            hideInTable: !fields.includes('rehab_display_label'),
          },
          {
            title: '默认时长（分钟）',
            dataIndex: 'default_duration',
            hideInTable: !fields.includes('default_duration'),
          },
          {
            title: '适用场景',
            key: 'scope',
            render: (_, row) =>
              careSettings
                .filter(
                  (setting) =>
                    fields.includes(setting.field) && row[setting.field],
                )
                .map((setting) => setting.label)
                .join('、') || '—',
          },
          {
            title: '状态',
            key: 'state',
            hideInTable: !readState,
            render: (_, row) => (
              <Tag color={row.enabled ? 'success' : 'default'}>
                {row.enabled ? '启用' : '停用'}
              </Tag>
            ),
          },
        ]}
      />
    </>
  );
}
