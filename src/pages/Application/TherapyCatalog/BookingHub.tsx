import { Alert, Tabs } from 'antd';
import React, { useEffect, useState } from 'react';
import BatchBookings from './BatchBookings';
import GroupSessions from './GroupSessions';
import { errorMessage, type Treatment } from './service';
import TreatmentTasks from './TreatmentTasks';
import { taskGet } from './taskService';

export default function BookingHub({ therapy }: { therapy: Treatment }) {
  const [canPlan, setCanPlan] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    taskGet<{ can_plan: boolean }>('get_context', {
      therapy_type: therapy.name,
    })
      .then((value) => {
        if (active) setCanPlan(value.can_plan);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [therapy.name]);
  if (error) return <Alert type="error" showIcon title={error} />;
  return (
    <Tabs
      destroyOnHidden
      items={[
        {
          key: 'single',
          label: '单次任务',
          children: <TreatmentTasks therapy={therapy} />,
        },
        {
          key: 'series',
          label: '批量预约',
          children: <BatchBookings therapy={therapy} canPlan={canPlan} />,
        },
        {
          key: 'groups',
          label: '团体场次',
          children: <GroupSessions therapy={therapy} canPlan={canPlan} />,
        },
      ]}
    />
  );
}
