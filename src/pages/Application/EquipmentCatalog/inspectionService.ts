import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from './service';
export const inspectionApi = <T>(
  method: string,
  params?: Record<string, unknown>,
) => get<T>('inspection_console', method, params);
export const inspectionSave = <T = { name: string }>(
  method: string,
  data: unknown,
) => post<T>('inspection_console', method, data);
export type ChecklistItem = { key: string; label: string };
export type Plan = {
  name: string;
  modified: string;
  resource?: string;
  company?: string;
  plan_title?: string;
  status?: string;
  first_due?: string;
  interval_days?: number;
  assigned_to?: string;
  reference?: string;
  created_at?: string;
  supersedes_plan?: string;
  next_due?: string;
  last_passed_at?: string;
  due_state?: string;
  can_manage?: boolean;
  can_inspect?: boolean;
};
export type InspectionOptions = {
  can_read_plans: boolean;
  can_create_plans: boolean;
  can_read_inspections: boolean;
  can_create_inspections: boolean;
  can_read_holds: boolean;
  plan_fields: string[];
  now: string;
  timezone: string;
  user: string;
  default_checklist: { label: string }[];
};
export type PlanContext = {
  plan: Plan;
  schema: ChecklistItem[];
  can_inspect: boolean;
  can_manage: boolean;
  now: string;
  timezone: string;
};
export type Inspection = {
  name: string;
  resource?: string;
  company?: string;
  inspection_plan?: string;
  performed_at?: string;
  performed_by?: string;
  result?: string;
  notes?: string;
};
export type InspectionContext = {
  inspection: Inspection;
  schema: ChecklistItem[];
  answers: Record<string, { result: string; note: string }>;
};
export type Hold = {
  name: string;
  modified: string;
  resource?: string;
  company?: string;
  status?: string;
  starts_at?: string;
  reason?: string;
  inspection?: string;
  released_at?: string;
  resolution?: string;
  resolution_reference?: string;
  can_release?: boolean;
};
export type Page<T> = {
  data: T[];
  total: number;
  success: boolean;
  read_fields?: string[];
};
export const deviceOptions = (keyword = '') =>
  inspectionApi<{ value: string; label: string }[]>('search_devices', {
    keyword,
  });
