import { request } from '@umijs/max';
import type { ChargeProgress } from '../ChargeCatalog/executionChargeService';
import { get } from '../ChargeCatalog/service';

export const taskGet = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('therapy_scheduling', method, params);
export async function taskPost<T>(
  module: string,
  method: string,
  data: Record<string, unknown>,
) {
  const result = await request<{ message: T }>(
    `/api/method/rehab.${module}.${method}`,
    {
      method: 'POST',
      data,
      skipErrorHandler: true,
    },
  );
  return result.message;
}
export type Task = {
  name: string;
  modified: string;
  patient_name: string;
  rehab_order: string;
  assigned_to: string;
  starts_at: string;
  ends_at: string;
  status: string;
  room: string;
  equipment?: string;
  therapy_team?: string;
  rehab_booking_mode?: 'Advance' | 'Onsite';
  rehab_collaborators?: {
    therapist: string;
    joined_at?: string;
    left_at?: string;
  }[];
  rehab_equipments?: { equipment: string }[];
};
export type TaskDetail = {
  task: Task;
  billing?: ChargeProgress | null;
  pending_signature?: boolean;
  user: string;
  capabilities: Record<string, boolean>;
  sessions: { name: string }[];
  events: {
    action: string;
    actor: string;
    event_time: string;
    reason: string;
  }[];
};
export type Planning = {
  timezone: string;
  planned_duration?: number | null;
  order: {
    therapy_type: string;
    clinical_notes: string;
    status: string;
    company: string;
    clinical_department: string;
  };
  therapists: { name: string; full_name: string }[];
  resources: { name: string; resource_name: string; resource_type: string }[];
  teams: { name: string; team_name: string }[];
  rules: {
    therapist_count: number;
    requires_therapist: boolean;
    requires_equipment: boolean;
    booking_required: boolean;
    room_buffer: number;
    equipment_buffer: number;
  };
};
export const taskStatus = {
  Scheduled: '待接单',
  Accepted: '已接单',
  Completed: '已完成',
  'Not Completed': '未执行',
  Cancelled: '已取消',
};
