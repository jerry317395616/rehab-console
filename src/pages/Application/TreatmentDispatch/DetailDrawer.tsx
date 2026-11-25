import { ProDescriptions, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, Drawer, Result, Spin, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import TreatmentTasks from '../TherapyCatalog/TreatmentTasks';
import {
  api,
  type Detail,
  errorMessage,
  orderStates,
  settings,
  states,
} from './service';

export default function DetailDrawer({
  name,
  bookingRoute,
  onClose,
}: {
  name: string;
  bookingRoute?: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail>(),
    [error, setError] = useState<string>(),
    [booking, setBooking] = useState(false);
  useEffect(() => {
    let active = true;
    api<Detail>('get_detail', { name })
      .then((v) => active && setDetail(v))
      .catch((e) => active && setError(errorMessage(e)));
    return () => {
      active = false;
    };
  }, [name]);
  const row = detail?.row;
  return (
    <Drawer
      title="治疗分派详情"
      open
      onClose={onClose}
      size="min(1100px, 100vw)"
      destroyOnHidden
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {error ? (
        <Result status="warning" title="无法读取治疗分派" subTitle={error} />
      ) : !detail || !row ? (
        <Spin />
      ) : (
        <>
          <ProDescriptions
            column={1}
            dataSource={row}
            columns={[
              { title: '患者', dataIndex: 'patient_name' },
              { title: '具体医嘱', dataIndex: 'name' },
              { title: '治疗项目', dataIndex: 'therapy_type' },
              {
                title: '分派状态',
                dataIndex: 'dispatch_status',
                valueEnum: states,
              },
            ]}
          />
          {row.notice && <Alert type="warning" showIcon title={row.notice} />}
          <Tabs
            items={[
              {
                key: 'order',
                label: '医嘱与责任',
                children: (
                  <>
                    <ProDescriptions
                      column={1}
                      dataSource={row}
                      columns={[
                        { title: '机构', dataIndex: 'company' },
                        { title: '科室', dataIndex: 'clinical_department' },
                        {
                          title: '就诊场景',
                          dataIndex: 'care_setting',
                          valueEnum: settings,
                        },
                        {
                          title: '医嘱状态',
                          dataIndex: 'status',
                          valueEnum: orderStates,
                        },
                        { title: '开始日期', dataIndex: 'starts_on' },
                        { title: '结束日期', dataIndex: 'ends_on' },
                        { title: '频次', dataIndex: 'frequency' },
                        { title: '计划次数', render: () => row.counts.planned },
                        {
                          title: '已完成次数',
                          render: () => row.counts.completed ?? '待核对',
                        },
                        {
                          title: '已预约次数',
                          render: () => row.counts.reserved ?? '待核对',
                        },
                        {
                          title: '剩余可预约次数',
                          render: () => row.counts.remaining ?? '待核对',
                        },
                        { title: '责任治疗师', dataIndex: 'responsibility' },
                        {
                          title: '开立建议接收组',
                          dataIndex: 'requested_team_label',
                          tooltip:
                            '来自医生原开立记录，仅供分派核对；实际责任以分派记录为准。',
                        },
                        { title: '治疗组', dataIndex: 'team_label' },
                        { title: '责任生效时间', dataIndex: 'effective_from' },
                        {
                          title: '治疗要求与注意事项',
                          render: () => detail.clinical_notes,
                        },
                      ]}
                    />
                    {row.status !== 'Authorized' && (
                      <Alert
                        type="warning"
                        showIcon
                        title="医嘱待临床确认，可先准备责任分派。"
                      />
                    )}
                    {row.can_book && (
                      <Button
                        type="primary"
                        onClick={() => {
                          if (!bookingRoute) {
                            setBooking(true);
                            return;
                          }
                          const [pathname, query] = bookingRoute.split('?');
                          const params = new URLSearchParams(query);
                          params.set('order', row.name);
                          params.set('date', row.starts_on);
                          history.push(`${pathname}?${params}`);
                        }}
                      >
                        进入本医嘱预约
                      </Button>
                    )}
                  </>
                ),
              },
              {
                key: 'tasks',
                label: '已有预约与任务',
                children: (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      title="显示最近100条有权读取的治疗任务。本页分派不会改动这些记录；任务改派须另行确认影响和交接。"
                    />
                    <ProTable
                      rowKey="name"
                      dataSource={detail.tasks}
                      search={false}
                      options={false}
                      pagination={false}
                      scroll={{ x: 750 }}
                      columns={[
                        { title: '任务编号', dataIndex: 'name' },
                        { title: '责任人', dataIndex: 'person' },
                        {
                          title: '开始时间',
                          dataIndex: 'starts_at',
                          valueType: 'dateTime',
                        },
                        {
                          title: '结束时间',
                          dataIndex: 'ends_at',
                          valueType: 'dateTime',
                        },
                        { title: '状态', dataIndex: 'status' },
                      ]}
                    />
                  </>
                ),
              },
              {
                key: 'history',
                label: '分派历史',
                children: (
                  <ProTable
                    rowKey="name"
                    dataSource={detail.history}
                    search={false}
                    options={false}
                    pagination={false}
                    scroll={{ x: 1000 }}
                    columns={[
                      { title: '版本', dataIndex: 'revision' },
                      { title: '操作', dataIndex: 'action' },
                      { title: '责任治疗师', dataIndex: 'person' },
                      { title: '治疗组', dataIndex: 'team' },
                      {
                        title: '适用开始时间',
                        dataIndex: 'effective_from',
                        valueType: 'dateTime',
                      },
                      {
                        title: '办理时间',
                        dataIndex: 'event_time',
                        valueType: 'dateTime',
                      },
                      { title: '办理人', dataIndex: 'actor' },
                      { title: '说明', dataIndex: 'reason' },
                    ]}
                  />
                ),
              },
              {
                key: 'queue',
                label: '组内待办记录',
                children: (
                  <ProTable
                    rowKey="name"
                    dataSource={detail.queue}
                    search={false}
                    options={false}
                    pagination={false}
                    columns={[
                      {
                        title: '状态',
                        dataIndex: 'status',
                        valueEnum: {
                          Pending: '待分派',
                          Returned: '已退回',
                          Dispatched: '已办理',
                          Withdrawn: '已撤回',
                        },
                      },
                      {
                        title: '更新时间',
                        dataIndex: 'modified',
                        valueType: 'dateTime',
                      },
                      { title: '说明', dataIndex: 'reason' },
                    ]}
                  />
                ),
              },
            ]}
          />
          {booking && (
            <Drawer
              title="本医嘅读取与预约"
              open
              size="min(1200px, 100vw)"
              onClose={() => setBooking(false)}
              destroyOnHidden
              footer={<Button onClick={() => setBooking(false)}>关闭</Button>}
            >
              <TreatmentTasks
                therapy={detail.therapy}
                initialOrder={{
                  name: row.name,
                  patient_name: row.patient_name,
                  assigned_to: row.assigned_to,
                  therapy_team: row.team,
                }}
              />
            </Drawer>
          )}
        </>
      )}
    </Drawer>
  );
}
