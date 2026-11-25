import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';
export { kinds } from '../RosterPlans/service';
export type Choice = { value: string; label: string; modified?: string };
export type Options = {
  companies: Choice[];
  departments: Choice[];
  site_today: string;
  site_timezone: string;
  starts_on: string;
  ends_on: string;
  can_write: boolean;
  can_create: boolean;
};
export type Row = {
  name: string;
  modified: string;
  company: string;
  department: string;
  therapist: string;
  person: string;
  original_person: string;
  plan: string;
  plan_title: string;
  plan_revision: number;
  work_date: string;
  starts_at: string;
  ends_at: string;
  work_kind: string;
  enabled: number;
  progress: string;
  projects: Choice[];
  credential_reference?: string;
  can_edit: boolean;
  available_minutes: number;
  hr_impacts: {
    kind: string;
    starts_at: string;
    ends_at: string;
    uncertain: boolean;
  }[];
  available_periods: { starts_at: string; ends_at: string }[];
};
export type Detail = {
  row: Row;
  can_view_plan: boolean;
  history: {
    name: string;
    creation: string;
    actor: string;
    content: string;
    changes: { field: string; before: string; after: string }[];
  }[];
  related: {
    has_occupancy: boolean;
    notice?: string;
    records: {
      kind: string;
      name: string;
      starts_at: string;
      ends_at: string;
      status: string;
    }[];
  };
};
export type Action = 'adjust' | 'replace' | 'swap' | 'disable' | 'enable';
export type Preview = {
  token: string;
  action: Action;
  action_label: string;
  can_confirm: boolean;
  issues: { name: string; message: string }[];
  changes: { name: string; before: Row; after: Row }[];
};
export const actions = {
  adjust: '调整时段',
  replace: '替班',
  swap: '换班',
  disable: '停用',
  enable: '恢复',
};
export const progress = {
  Pending: '待开始',
  Ongoing: '进行中',
  Ended: '已结束',
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('roster_detail_console', method, params);
export const mutate = <T>(method: string, data: unknown) =>
  post<T>('roster_detail_console', method, data);
