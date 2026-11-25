import { type ProColumns, ProTable } from '@ant-design/pro-components';
import { Alert } from 'antd';
import React, { useState } from 'react';
import { api, errorMessage, type List } from './service';

export default function Records({
  name,
  kind,
}: {
  name: string;
  kind: string;
}) {
  const [fields, setFields] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const labels: Record<string, string> = {
    performed_at: '巡检时间',
    result: '巡检结果',
    performed_by: '巡检人',
    notes: '备注',
    action: '操作',
    event_time: '操作时间',
    actor: '操作人',
    reason: '说明',
    failure_date: '故障时间',
    completion_date: '完成时间',
    repair_status: '维修状态',
    due_date: '到期日期',
    maintenance_status: '保养状态',
    maintenance_type: '保养类型',
  };
  const columns: ProColumns<Record<string, string>>[] = [
    { title: '记录编号', dataIndex: 'name', width: 180 },
    ...fields.map((field) => ({
      title: labels[field] || field,
      dataIndex: field,
      width: 180,
    })),
  ];
  return (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      <ProTable<Record<string, string>>
        key={`${name}:${kind}`}
        rowKey="name"
        search={false}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{ defaultPageSize: 10 }}
        request={async (params) => {
          try {
            const result = await api<List<Record<string, string>>>(
              'get_records',
              {
                name,
                kind,
                current: params.current,
                page_size: params.pageSize,
              },
            );
            setFields(result.read_fields || []);
            setError(undefined);
            return result;
          } catch (reason) {
            setError(errorMessage(reason));
            return { data: [], total: 0, success: false };
          }
        }}
      />
    </>
  );
}
