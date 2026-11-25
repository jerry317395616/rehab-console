import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';
export type Choice = { value: string; label: string };
export type Person = { therapist: string; person?: string; evidence: string };
export type Slot = {
  weekday: number;
  start: string;
  end: string;
  kind: string;
  projects: string[];
};
export type Plan = {
  site_today: string;
  site_timezone?: string;
  name: string;
  modified: string;
  plan_title: string;
  company: string;
  department: string;
  starts_on: string;
  ends_on: string;
  enabled: number;
  revision: number;
  people: Person[];
  slots: Slot[];
  people_count: number;
  slots_count: number;
  can_write: boolean;
  can_generate: boolean;
  can_create: boolean;
  can_view_generated: boolean;
  hidden_links?: boolean;
  staff_choices: Choice[];
  project_choices: Choice[];
};
export type Options = {
  site_today: string;
  companies: Choice[];
  departments: Choice[];
  can_create: boolean;
};
export type PreviewRow = {
  key: string;
  person: string;
  work_date: string;
  starts_at: string;
  ends_at: string;
  work_kind: string;
  projects: string[];
  status: string;
  issue: string;
  previous_revisions: number[];
};
export type Preview = {
  token: string;
  rows: PreviewRow[];
  counts: { Ready: number; Existing: number; Past: number; Blocked: number };
  revision: number;
  can_confirm: boolean;
};
export const weekdays = {
  0: '周一',
  1: '周二',
  2: '周三',
  3: '周四',
  4: '周五',
  5: '周六',
  6: '周日',
};
export const kinds = {
  Work: '上班',
  Duty: '值班',
  Leave: '请假',
  Rest: '调休',
  Travel: '出差',
};
export const statuses = {
  Ready: '可生成',
  Existing: '已生成，跳过',
  Past: '已开始，跳过',
  Blocked: '存在问题',
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('roster_console', method, params);
export const mutate = <T = { name: string }>(method: string, data: unknown) =>
  post<T>('roster_console', method, data);
export const choices = (
  company: string,
  department: string,
  kind: string,
  keyword = '',
) => api<Choice[]>('search_options', { company, department, kind, keyword });
