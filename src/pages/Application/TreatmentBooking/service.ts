import { get, post } from '../ChargeCatalog/service';
import type { Planning, Task } from '../TherapyCatalog/taskService';

export { errorMessage } from '../ChargeCatalog/feedback';

export type Choice = { value: string; label: string };
export type Filters = {
  date: string;
  company?: string;
  department?: string;
  therapist?: string;
  keyword?: string;
  status?: string;
};
export type Options = {
  date: string;
  companies: Choice[];
  departments: Choice[];
  can_book: boolean;
};
type Period = { starts_at: string; ends_at: string };
type Segment = { start_minute: number; end_minute: number };
export type Booking = Period &
  Segment & {
    name: string;
    patient_name: string;
    therapy_type: string;
    therapist_label: string;
    assigned_to: string;
    room_label: string;
    rehab_order: string;
    status: string;
    lane: number;
    busy?: false;
  };
export type CalendarRow = {
  key: string;
  label: string;
  shifts: Segment[];
  lanes: number;
  events: (Booking | (Segment & { busy: true; lane: number }))[];
};
export type Day = {
  date: string;
  today: string;
  now: string;
  timezone: string;
  start_minute: number;
  end_minute: number;
  shifts_available: boolean;
  records: Booking[];
  rows: CalendarRow[];
  therapists: Choice[];
};
type Counts = {
  planned: number;
  completed: number;
  reserved: number;
  remaining: number;
};
export type Order = {
  name: string;
  patient_name: string;
  therapy_type: string;
  therapist_label: string;
  company: string;
  department: string;
  start_date: string;
  end_date?: string | null;
  first_date: string;
  starts_in_future: boolean;
  assigned_to?: string;
  reason?: string;
  counts: Counts;
};
export type OrderPlanning = Planning & {
  date: string;
  duration: number;
  counts: Counts;
  order: Planning['order'] & {
    patient_name: string;
    start_date: string;
    end_date?: string;
  };
  booking_error?: string;
};
export type Slot = Period & {
  assigned_to: string;
  therapist_label: string;
  therapy_team?: string;
};
export type NewSlot = Slot & {
  room: string;
  equipment_list: string[];
  collaborators: string[];
};
export type Draft = {
  order?: string;
  therapist?: string;
  therapistLabel?: string;
  at?: string;
  task?: Task;
};

export const statuses = {
  Scheduled: { text: '已预约', status: 'Processing' },
  Accepted: { text: '已接单', status: 'Warning' },
  Completed: { text: '已完成', status: 'Success' },
  'Not Completed': { text: '未执行', status: 'Default' },
  Cancelled: { text: '已取消', status: 'Default' },
};

export const read = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('booking_console', method, params);

export const slots = (data: Record<string, unknown>) =>
  post<{ slots: Slot[]; reasons: string[] }>('booking_console', 'slots', data);

export const create = (data: Record<string, unknown>) =>
  post<{ task: Task }>('booking_console', 'create', data);

export function slotKey(slot: Slot) {
  return `${slot.starts_at} ${slot.assigned_to}`;
}

export function clock(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
