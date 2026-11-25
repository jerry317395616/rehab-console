import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';
export type Choice = {
  value: string;
  label: string;
  has_shift?: boolean | null;
  visible_booked_minutes?: number | null;
};
export type Options = {
  companies: Choice[];
  departments: Choice[];
  timezone: string;
  site_now: string;
  can_write: boolean;
};
export type Row = {
  name: string;
  modified: string;
  patient: string;
  patient_name: string;
  company: string;
  clinical_department: string;
  care_setting: string;
  therapy_type: string;
  status: string;
  frequency: string;
  starts_on: string;
  ends_on?: string;
  dispatch_status: string;
  responsibility: string;
  assigned_to?: string;
  team?: string;
  team_label: string;
  requested_team_label?: string;
  effective_from?: string;
  pending_effect?: boolean;
  assignment_token: string;
  counts: {
    planned: number;
    used: number | null;
    completed: number | null;
    reserved: number | null;
    remaining: number | null;
  };
  notice?: string;
  can_assign: boolean;
  can_clear: boolean;
  can_withdraw: boolean;
  can_enqueue: boolean;
  can_book: boolean;
};
export type Detail = {
  row: Row;
  clinical_notes: string;
  therapy: { name: string; modified: string; default_duration?: number };
  history: {
    name: string;
    revision: number;
    action: string;
    person: string;
    team: string;
    effective_from: string;
    event_time: string;
    actor: string;
    reason: string;
  }[];
  queue: { name: string; status: string; reason: string; modified: string }[];
  tasks: {
    name: string;
    person: string;
    starts_at: string;
    ends_at: string;
    status: string;
  }[];
};
export type Action = 'assign' | 'adjust' | 'clear' | 'enqueue' | 'withdraw';
export const actions: Record<Action, string> = {
  assign: '分派',
  adjust: '调整分派',
  clear: '解除分派',
  enqueue: '交治疗组分派',
  withdraw: '撤回待办',
};
export type Preview = {
  token: string;
  before: Row;
  after: {
    responsibility?: string;
    team_label?: string;
    effective_from?: string;
  };
  warnings: string[];
  can_confirm: boolean;
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('dispatch_console', method, params);
export const mutate = <T>(method: string, data: unknown) =>
  post<T>('dispatch_console', method, data);
export const states = {
  Unassigned: '未分派',
  Pending: '待组长分派',
  Assigned: '已分派',
  Returned: '退回待处理',
};
export const orderStates = {
  Draft: '草稿',
  'Pending Review': '待审核',
  'Awaiting Signature': '待核对原确认',
  Authorized: '已授权',
  Rejected: '已驳回',
  Cancelled: '已取消',
};
export const settings = {
  Outpatient: '门诊',
  Inpatient: '住院',
  Bedside: '床旁',
};
