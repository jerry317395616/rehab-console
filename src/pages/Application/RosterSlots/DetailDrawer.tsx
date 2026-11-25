import { ProDescriptions, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Drawer, Result, Space, Spin, Tabs } from 'antd';
import { useEffect, useState } from 'react';
import { api, type Detail, errorMessage, kinds, progress } from './service';

export default function DetailDrawer({
  name,
  onClose,
  onOpenPlan,
}: {
  name: string;
  onClose: () => void;
  onOpenPlan?: (name: string) => void;
}) {
  const [detail, setDetail] = useState<Detail>(),
    [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    api<Detail>('get_detail', { name })
      .then((value) => active && setDetail(value))
      .catch((reason) => active && setError(errorMessage(reason)));
    return () => {
      active = false;
    };
  }, [name]);
  const row = detail?.row;
  return (
    <Drawer
      title="排班明细详情"
      open
      onClose={onClose}
      size="min(1050px, 100vw)"
      destroyOnHidden
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      {error ? (
        <Result status="warning" title="无法加载明细" subTitle={error} />
      ) : !row || !detail ? (
        <Spin />
      ) : (
        <>
          <ProDescriptions
            column={1}
            dataSource={row}
            columns={[
              { title: '实际排班人员', dataIndex: 'person' },
              { title: '班次日期', dataIndex: 'work_date' },
              { title: '时间状态', dataIndex: 'progress', valueEnum: progress },
            ]}
          />
          <Tabs
            items={[
              {
                key: 'basic',
                label: '班次信息',
                children: (
                  <>
                    <ProDescriptions
                      column={1}
                      dataSource={row}
                      columns={[
                        { title: '机构', dataIndex: 'company' },
                        { title: '医疗科室', dataIndex: 'department' },
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
                        {
                          title: '工作类型',
                          dataIndex: 'work_kind',
                          valueEnum: kinds,
                        },
                        {
                          title: '启用状态',
                          dataIndex: 'enabled',
                          valueEnum: { 1: '启用', 0: '停用' },
                        },
                        {
                          title: '可安排项目',
                          key: 'projects',
                          render: () =>
                            row.projects.map((p) => p.label).join('、') || '—',
                        },
                        {
                          title: '资质核验依据',
                          dataIndex: 'credential_reference',
                        },
                        { title: '原始排班人员', dataIndex: 'original_person' },
                        { title: '来源计划名称快照', dataIndex: 'plan_title' },
                        { title: '来源计划版本', dataIndex: 'plan_revision' },
                      ]}
                    />
                    {detail.can_view_plan && onOpenPlan && (
                      <Button onClick={() => onOpenPlan(row.plan)}>
                        查看完整来源计划
                      </Button>
                    )}
                  </>
                ),
              },
              {
                key: 'availability',
                label: '可用情况',
                children: (
                  <>
                    <Alert
                      type={row.hr_impacts.length ? 'warning' : 'info'}
                      showIcon
                      title={`班次扣除生效缺勤后可用 ${row.available_minutes} 分钟`}
                      description="这里展示人事缺勤对班次的影响，实际预约容量由预约排程实时校验。"
                    />
                    <ProTable
                      rowKey={(r) => r.starts_at + r.ends_at}
                      headerTitle="可用时段"
                      dataSource={row.available_periods}
                      search={false}
                      options={false}
                      pagination={false}
                      columns={[
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
                      ]}
                    />
                    <ProTable
                      rowKey={(r) => r.kind + r.starts_at + r.ends_at}
                      headerTitle="人事影响时段"
                      dataSource={row.hr_impacts}
                      search={false}
                      options={false}
                      pagination={false}
                      columns={[
                        { title: '类型', dataIndex: 'kind', valueEnum: kinds },
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
                        {
                          title: '核实情况',
                          dataIndex: 'uncertain',
                          render: (_, r) =>
                            r.uncertain ? '需核实原始记录' : '已登记生效',
                        },
                      ]}
                    />
                  </>
                ),
              },
              {
                key: 'related',
                label: '关联业务',
                children: (
                  <>
                    <Alert
                      type={detail.related.has_occupancy ? 'warning' : 'info'}
                      showIcon
                      title={
                        detail.related.notice ||
                        (detail.related.has_occupancy
                          ? '该时段存在关联占用，变更前须先处理对应业务。'
                          : '当前未发现关联占用。')
                      }
                      description="下表仅展示有权读取的记录；变更保护同时检查不可见的占用，不展示患者资料。"
                    />
                    <ProTable
                      rowKey={(r) => r.kind + r.name}
                      dataSource={detail.related.records}
                      search={false}
                      options={false}
                      pagination={false}
                      scroll={{ x: 700 }}
                      columns={[
                        {
                          title: '业务类型',
                          dataIndex: 'kind',
                          valueEnum: {
                            'Treatment Task': '治疗任务',
                            'Patient Appointment': '原生预约',
                            'Therapy Session': '治疗记录',
                          },
                        },
                        { title: '编号', dataIndex: 'name' },
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
                label: '操作记录',
                children: (
                  <ProTable
                    rowKey="name"
                    dataSource={detail.history}
                    search={false}
                    options={false}
                    pagination={false}
                    columns={[
                      {
                        title: '时间',
                        dataIndex: 'creation',
                        valueType: 'dateTime',
                        width: 170,
                      },
                      { title: '操作账号', dataIndex: 'actor', width: 200 },
                      { title: '内容', dataIndex: 'content' },
                      {
                        title: '前后对照',
                        key: 'changes',
                        render: (_, r) => (
                          <Space orientation="vertical">
                            {r.changes.map((c) => (
                              <span key={c.field}>
                                {c.field}：{c.before} → {c.after}
                              </span>
                            ))}
                          </Space>
                        ),
                      },
                    ]}
                    scroll={{ x: 850 }}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}
