import { get, post } from '../ChargeCatalog/service';

export type Medical = {
  name: string;
  modified: string;
  department?: string;
  patient_care_type?: string;
  rehab_disabled?: number;
  can_edit?: boolean;
  can_delete?: boolean;
  can_state?: boolean;
};
export type Rights = {
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_state: boolean;
  read_fields: string[];
  write_fields: string[];
};
export type Listing = Rights & {
  data: Medical[];
  total: number;
  success: boolean;
};
export type Detail = Rights & { doc: Medical };
export type Preview = {
  name: string;
  modified: string;
  disabled: number;
  message: string;
};
export const load = (name: string) =>
  get<Detail>('medical_departments', 'get_entry', { name });
export const save = (data: unknown) =>
  post('medical_departments', 'save_entry', data);
export const preview = (name: string, action: string) =>
  get<Preview>('medical_departments', 'preview_action', { name, action });
export const run = (data: unknown) =>
  post('medical_departments', 'run_action', data);
