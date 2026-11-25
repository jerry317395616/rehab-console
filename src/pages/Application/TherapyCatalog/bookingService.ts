import { get } from '../ChargeCatalog/service';
import { taskPost } from './taskService';

export const bookingGet = <T>(
  method: string,
  params?: Record<string, unknown>,
) => get<T>('therapy_bookings', method, params);
export const bookingPost = <T>(method: string, data: Record<string, unknown>) =>
  taskPost<T>('therapy_bookings', method, data);
export const settingsGet = <T>(
  method: string,
  params?: Record<string, unknown>,
) => get<T>('booking_settings', method, params);
export const changePost = <T>(method: string, data: Record<string, unknown>) =>
  taskPost<T>('booking_changes', method, data);
export const weekdays = {
  0: '周一',
  1: '周二',
  2: '周三',
  3: '周四',
  4: '周五',
  5: '周六',
  6: '周日',
};
export type FixedSlot = {
  _key?: string;
  name?: string;
  enabled: number | boolean;
  company: string;
  department: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  valid_from: string;
  valid_to: string;
  assigned_to?: string;
  room?: string;
};
export type BookingSettings = {
  modified: string;
  can_edit: boolean;
  rehab_fixed_slots_only: number | boolean;
  rehab_group_enabled: number | boolean;
  rehab_group_capacity: number;
  rehab_group_equipment_mode: 'Shared' | 'PerPatient';
  rehab_fixed_slots: FixedSlot[];
};
export type BatchPreview = {
  preview_token: string;
  can_confirm: boolean;
  available: number;
  remaining: number;
  timezone: string;
  rows: {
    index: number;
    starts_at: string;
    ends_at: string;
    available: boolean;
    reason: string;
  }[];
};
export type GroupMember = {
  name: string;
  patient_name: string;
  rehab_order: string;
  status: string;
  modified: string;
  arrived_at?: string;
  can_arrive: boolean;
};
export type GroupSession = {
  name: string;
  modified: string;
  therapy_type: string;
  company: string;
  department: string;
  assigned_to: string;
  room: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  enrolled: number;
  visible_members: number;
  equipment_mode: 'Shared' | 'PerPatient';
  status: 'Open' | 'Cancelled';
  can_manage: boolean;
  enrollment_open: boolean;
  plan: { equipment_list: string[] };
  members: GroupMember[];
};
