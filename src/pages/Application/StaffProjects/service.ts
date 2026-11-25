import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';

export type Choice = {
  value: string;
  label: string;
  modified?: string | null;
  is_intern?: boolean;
};
export type Options = {
  companies: Choice[];
  can_create: boolean;
  can_write: boolean;
};
export type Profile = {
  name?: string;
  company: string;
  therapist: string;
  person: string;
  departments?: string[];
  modified: string | null;
  scope_mode: 'Restricted' | 'Exceptions';
  mentor?: string;
  projects: (Choice & { allowed: number })[];
  hidden_links: boolean;
  can_edit: boolean;
  project_count?: number;
  is_intern?: boolean;
};
export type Pair = Profile & {
  therapy_type: string;
  status: 'Allowed' | 'Removed';
};
export type Row = Profile & Partial<Pick<Pair, 'therapy_type' | 'status'>>;
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('staff_project_console', method, params);
export const mutate = (method: string, data: unknown) =>
  post('staff_project_console', method, data);
export const choices = (company: string, kind: string, keyword = '') =>
  api<Choice[]>('search_options', { company, kind, keyword });
export const modes = {
  Restricted: '仅允许所选项目',
  Exceptions: '历史开放范围',
};
