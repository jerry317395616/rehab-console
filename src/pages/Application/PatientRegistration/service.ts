import { get, post } from '../ChargeCatalog/service';

const api = 'patient_registration_console';
export type Patient = Record<string, string | number | boolean | null> & {
  name: string;
  patient_name: string;
  modified: string;
  status: string;
  can_edit: boolean;
  can_reveal: boolean;
};
export type Options = {
  genders: { value: string; label: string }[];
  countries: { value: string; label: string }[];
  identity_types: string[];
  sources: string[];
  site_today: string;
  read_fields: string[];
  write_fields: string[];
  can_create: boolean;
  can_read_visits: boolean;
};
export type Change = {
  field: string;
  label?: string;
  before: string;
  after: string;
};
export type Detail = {
  row: Patient;
  history: {
    name: string;
    actor: string;
    creation: string;
    action: string;
    reason: string;
    changes: Change[];
  }[];
  visits: {
    name: string;
    kind: string;
    company: string;
    department: string;
    date: string;
    status?: string;
  }[];
  notice: string;
};
export type Preview = {
  token: string;
  blocked: boolean;
  has_possible_duplicates: boolean;
  candidates: {
    name: string;
    patient_name: string;
    sex?: string;
    dob?: string;
    mobile?: string;
    match: string;
  }[];
  changes: Change[];
  notice: string;
  action: string;
  can_confirm: boolean;
};
export const options = () => get<Options>(api, 'get_options');
export const patients = (params: Record<string, unknown>) =>
  get<{ data: Patient[]; total: number; success: boolean }>(
    api,
    'get_patients',
    params,
  );
export const detail = (name: string) =>
  get<Detail>(api, 'get_detail', { name });
export const editContext = (name: string) =>
  get<{
    row: Patient;
    values: Record<string, unknown>;
    saved_sensitive: Record<string, string>;
    write_fields: string[];
  }>(api, 'get_edit_context', { name });
export const preview = (data: unknown) =>
  post<Preview>(api, 'preview_save', data);
export const confirm = (token: string, duplicates_confirmed: boolean) =>
  post<{ name: string; replayed: boolean }>(api, 'confirm_save', {
    token,
    duplicates_confirmed,
  });
export const receipt = (request_id: string) =>
  get<{ name?: string }>(api, 'get_receipt', { request_id });
export const reveal = (name: string, reason: string) =>
  post<Record<string, string>>(api, 'reveal', {
    name,
    reason,
    request_id: crypto.randomUUID(),
  });
