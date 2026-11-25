import type { ChargeProgress } from '../ChargeCatalog/executionChargeService';
import { get } from '../ChargeCatalog/service';
import { taskPost } from '../TherapyCatalog/taskService';

export const phases = {
  Arrival: { text: '待到诊', status: 'Default' },
  Claim: { text: '待接单', status: 'Warning' },
  Ready: { text: '待执行', status: 'Processing' },
  Running: { text: '执行中', status: 'Processing' },
  Review: { text: '待提交', status: 'Warning' },
  Completed: { text: '已完成', status: 'Success' },
  Exception: { text: '异常与未完成', status: 'Error' },
} as const;

export const load = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('therapist_console', method, params);
export const call = taskPost;
export const command = (
  action: string,
  request: string,
  data: Record<string, unknown>,
) =>
  call<{ matched?: boolean; message?: string }>(
    'therapist_console',
    'command',
    {
      action,
      request,
      data,
    },
  );

export type Choice = { label: string; value: string };
export type Arrival = {
  status: string;
  label: string;
  actual_at?: string;
  reason?: string;
};
export type Readiness = {
  label: string;
  reason?: string;
  order_ready?: boolean;
};
export type Options = {
  date: string;
  scope: 'mine' | 'visible';
  timezone: string;
};
export type TaskRow = {
  name: string;
  patient_name: string;
  therapy_type: string;
  rehab_order: string;
  starts_at: string;
  ends_at: string;
  assigned_to_name: string;
  phase: keyof typeof phases;
  arrival?: Arrival;
  execution?: Readiness;
};
export type Risk = {
  key: string;
  label: string;
  result: string;
  finding?: string;
};
export type Check = { name: string };
export type Run = {
  name: string;
  modified: string;
  status: 'Running' | 'Ended' | 'Interrupted';
  actual_start: string;
  actual_end?: string;
  actual_location: string;
  amount?: string | number;
  unit?: string;
  result?: string;
  reaction?: string;
  clinical_notice?: string;
};
export type TaskDetail = {
  task: {
    name: string;
    modified: string;
    status: string;
    company: string;
    therapy_type: string;
    rehab_order: string;
    patient: string;
    starts_at: string;
    ends_at: string;
    room?: string;
    room_label?: string;
    equipment_label?: string;
    clinical_notes_snapshot?: string;
    therapy_session?: string;
    execution: Readiness;
  };
  identity: { patient_name: string; care_setting?: string };
  visit: { key?: string; name?: string };
  responsible_name: string;
  capabilities: { can_accept: boolean; can_not_complete: boolean };
  qualification: { passed: boolean; reason?: string };
  episodes: { name: string; title: string; status: string }[];
  episode?: string;
  arrival: Arrival;
  can_arrive: boolean;
  arrival_blocker?: string;
  start_window?: { reason?: string; refresh_after_ms?: number };
  own: boolean;
  now: string;
  timezone: string;
  billing?: ChargeProgress;
  onsite?: {
    clinical_ready?: boolean;
    can_verify?: boolean;
    identity?: Check;
    risk_check?: Check;
    reason?: string;
    risk?: {
      disposition: string;
      checks: Risk[];
      precautions?: string;
      allergies?: string;
    };
  };
  run: {
    execution?: Run;
    units: string[];
    draft?: { name: string; content?: Record<string, unknown> };
    can_record: boolean;
    observations: {
      name: string;
      content: string;
      observed_at: string;
      actor_name: string;
    }[];
  };
  can_finalize: boolean;
  plans: { name: string }[];
};
