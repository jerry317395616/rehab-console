import { get, post } from '../ChargeCatalog/service';

export type Person = {
  name: string;
  modified: string;
  practitioner_name?: string;
  first_name?: string;
  last_name?: string;
  rehab_staff_kind?: string;
  rehab_staff_company?: string;
  rehab_staff_post?: string;
  department?: string;
  status?: 'Active' | 'Disabled';
  designation?: string;
  employee?: string;
  employee_number?: string;
  employee_company?: string;
  organization_department?: string;
  user_id?: string;
  can_edit?: boolean;
};
export type Rights = {
  can_create: boolean;
  can_edit: boolean;
  can_select_user: boolean;
  can_select_employee: boolean;
  can_search_code?: boolean;
  read_fields: string[];
  write_fields: string[];
};
export type Counts = Record<string, number>;
export const list = (params: Record<string, unknown>) =>
  get<Rights & { data: Person[]; total: number; success: boolean }>(
    'medical_staff',
    'listing',
    params,
  );
export const detail = (name: string) =>
  get<Rights & { doc: Person }>('medical_staff', 'detail', { name });
export const relations = (name: string) =>
  get<Counts>('medical_staff', 'relationships', { name });
export const options = (field: string, keyword = '', company = '') =>
  get<{ value: string; label: string }[]>('medical_staff', 'options', {
    field,
    keyword,
    company,
  });
export const save = (data: unknown) => post('medical_staff', 'save', data);
export const preview = (name: string) =>
  get<{
    name: string;
    status: Person['status'];
    modified: string;
    counts: Counts;
  }>('medical_staff', 'preview_status', { name });
export const setStatus = (data: unknown) =>
  post('medical_staff', 'set_status', data);
