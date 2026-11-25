import { get, post } from '../ChargeCatalog/service';

const api = 'patient_visit_console';
export type Choice = {
  value: string;
  label: string;
  department?: string;
  appointment_type?: string;
  date?: string;
  time?: string;
};
export type Row = {
  key: string;
  name: string;
  kind: 'outpatient' | 'inpatient';
  patient: string;
  patient_name: string;
  sex?: string;
  age?: number | null;
  company: string;
  department?: string;
  practitioner?: string;
  practitioner_name?: string;
  date: string;
  time?: string;
  end_date?: string;
  status: string;
  docstatus: number;
  modified: string;
  limitation?: string;
  can_edit: boolean;
  can_complete: boolean;
  can_cancel: boolean;
};
export type Options = {
  can_create: boolean;
  can_read_outpatient: boolean;
  can_read_inpatient: boolean;
  write_fields: string[];
  clinical_fields: string[];
  companies: Choice[];
  departments: Choice[];
  appointment_types: Choice[];
  site_now: string;
  states: Record<string, string[]>;
};
export type Change = {
  field: string;
  label?: string;
  before: string;
  after: string;
};
export type RelatedRow = {
  note?: string;
  doctor?: string;
  name: string;
  status: string;
  date?: string;
  stage?: string;
  order?: string;
  title?: string;
};
export type Detail = {
  row: Row;
  values: Record<string, unknown>;
  related: Record<
    string,
    {
      available: boolean;
      rows: RelatedRow[];
      truncated?: boolean;
      notice?: string;
    }
  >;
  history: {
    name: string;
    actor: string;
    date: string;
    action: string;
    reason: string;
    changes: Change[];
  }[];
};
export type Preview = {
  token: string;
  notice: string;
  changes?: Change[];
  has_possible_duplicates?: boolean;
  candidates?: Row[];
};
export const states: Record<string, string> = {
  Open: '进行中',
  Ordered: '已开立',
  Completed: '已完成',
  Cancelled: '已作废',
  'Admission Scheduled': '待入院',
  Admitted: '在院',
  'Discharge Scheduled': '待出院',
  Discharged: '已出院',
};
export const actions: Record<string, string> = {
  create: '门诊登记',
  edit: '资料修改',
  complete: '完成接诊',
  cancel: '作废接诊',
};
export const options = () => get<Options>(api, 'get_options');
export const visits = (params: Record<string, unknown>) =>
  get<{ data: Row[]; total: number; success: boolean }>(
    api,
    'get_visits',
    params,
  );
export const detail = (key: string) => get<Detail>(api, 'get_detail', { key });
export const editContext = (key: string) =>
  get<{ row: Row; values: Record<string, unknown>; write_fields: string[] }>(
    api,
    'get_edit_context',
    { key },
  );
export const references = (
  kind: string,
  params: Record<string, unknown> = {},
) => get<Choice[]>(api, 'references', { kind, ...params });
export const preview = (data: unknown) =>
  post<Preview>(api, 'preview_save', data);
export const confirm = (token: string, duplicates_confirmed: boolean) =>
  post<{ key: string }>(api, 'confirm_save', { token, duplicates_confirmed });
export const receipt = (request_id: string) =>
  get<{ key?: string }>(api, 'get_receipt', { request_id });
export const previewAction = (data: unknown) =>
  post<Preview>(api, 'preview_complete', data);
export const confirmAction = (token: string) =>
  post<{ key: string }>(api, 'confirm_complete', { token });
