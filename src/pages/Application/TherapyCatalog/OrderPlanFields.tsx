import { ProFormCheckbox, ProFormSelect } from '@ant-design/pro-components';
import { Alert, App, type FormInstance } from 'antd';
import React, { useRef, useState } from 'react';
import { errorMessage, type Treatment } from './service';
import { type Planning, taskGet } from './taskService';

export function RiskConfirmation() {
  return (
    <ProFormCheckbox
      name="risk_acknowledged"
      rules={[
        {
          validator: async (_, value) => {
            if (!value) throw new Error('请阅读并确认此患者的医嘱注意事项');
          },
        },
      ]}
    >
      已阅读此患者的医嘱注意事项，并核对适用范围和本次排程风险
    </ProFormCheckbox>
  );
}

export default function OrderPlanFields({
  therapy,
  form,
  onPlanning,
  orderOnly = false,
  equipmentReadOnly = false,
}: {
  therapy: Treatment;
  form: FormInstance;
  onPlanning: (value: Planning | undefined) => void;
  orderOnly?: boolean;
  equipmentReadOnly?: boolean;
}) {
  const [planning, setPlanning] = useState<Planning>();
  const version = useRef(0);
  const { message } = App.useApp();
  return (
    <>
      <ProFormSelect
        name="rehab_order"
        label={orderOnly ? '加入患者的康复医嘱' : '康复医嘱'}
        showSearch
        debounceTime={300}
        rules={[{ required: true }]}
        request={({ keyWords }) =>
          taskGet('search_orders', {
            therapy_type: therapy.name,
            keyword: keyWords || '',
          })
        }
        fieldProps={{
          filterOption: false,
          onChange: async (value) => {
            const latest = ++version.current;
            setPlanning(undefined);
            onPlanning(undefined);
            form.setFieldsValue({
              assigned_to: undefined,
              collaborators: [],
              equipment_list: [],
              room: undefined,
              therapy_team: undefined,
              risk_acknowledged: false,
            });
            try {
              const next = await taskGet<Planning>('get_planning', {
                rehab_order: value,
              });
              if (latest === version.current) {
                setPlanning(next);
                onPlanning(next);
              }
            } catch (reason) {
              message.error(errorMessage(reason));
            }
          },
        }}
      />
      {planning && (
        <Alert
          showIcon
          type="info"
          title={`站点时间：${planning.timezone}；需 ${planning.rules.therapist_count} 名全程参与治疗师。`}
          description={
            planning.order.clinical_notes || '本医嘱未另附注意事项。'
          }
        />
      )}
      {!orderOnly && (
        <>
          <ProFormSelect
            name="assigned_to"
            label="主治疗师／责任人"
            disabled={!planning}
            showSearch
            rules={[{ required: true }]}
            options={planning?.therapists.map((r) => ({
              value: r.name,
              label: r.full_name || r.name,
            }))}
          />
          {Boolean(planning && planning.rules.therapist_count > 1) && (
            <ProFormSelect
              name="collaborators"
              label={`协作治疗师（另选 ${(planning?.rules.therapist_count || 1) - 1} 人）`}
              mode="multiple"
              rules={[{ required: true }]}
              options={planning?.therapists.map((r) => ({
                value: r.name,
                label: r.full_name || r.name,
              }))}
            />
          )}
          <ProFormSelect
            name="room"
            label="治疗场地"
            disabled={!planning}
            showSearch
            rules={[{ required: true }]}
            options={planning?.resources
              .filter((r) => r.resource_type === 'Room')
              .map((r) => ({ value: r.name, label: r.resource_name }))}
          />
          <ProFormSelect
            name="therapy_team"
            label="治疗组"
            disabled={!planning}
            options={planning?.teams.map((r) => ({
              value: r.name,
              label: r.team_name,
            }))}
          />
        </>
      )}
      <ProFormSelect
        name="equipment_list"
        label="本患者所用设备"
        disabled={!planning || equipmentReadOnly}
        mode="multiple"
        showSearch
        rules={[{ required: Boolean(planning?.rules.requires_equipment) }]}
        options={planning?.resources
          .filter((r) => r.resource_type === 'Equipment')
          .map((r) => ({ value: r.name, label: r.resource_name }))}
      />
      <RiskConfirmation />
    </>
  );
}
