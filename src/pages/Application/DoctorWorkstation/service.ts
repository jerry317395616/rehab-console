import { get, post } from '../ChargeCatalog/service';
import type {
  Row as Visit,
  Detail as VisitDetail,
} from '../PatientVisits/service';

const api = 'doctor_workstation';
export type Choice = {
  value: string;
  label: string;
  roles?: string[];
  sessions?: number;
  order_term?: string;
  duration?: number;
  duration_defaults?: OrderDuration;
  duration_error?: string;
};
export type OrderDuration = {
  planned_duration: number;
  duration_min: number;
  duration_max: number;
};
export type Prescription = {
  specialty?: {
    points: { point: string; side: string }[];
    device_modes: { resource: string; mode: string }[];
    vr_scenes: { scene: string; difficulty: string }[];
  };
  schema: string;
  duration_min: number;
  duration_max: number;
  planned_duration?: number;
  period_kind: string;
  period_days: number;
  period_limit: number;
  gap_minutes: number;
  weekdays: number[];
  equipment: string;
  risk: {
    disposition: string;
    assessed_at: string;
    checks: { key: string; label: string; result: string; finding: string }[];
    precautions: string;
  };
};
export type OrderItem = {
  kind: 'Treatment' | 'Assessment';
  order_item?: string;
  therapy_type?: string;
  sessions?: number;
  order_term?: string;
  care_setting?: string;
  start_date?: string;
  end_date?: string;
  team?: string;
  clinical_reviewer: string;
  assigned_therapist?: string;
  notes: string;
  prescription?: Prescription;
  execution_role?: string;
  overlap_reason?: string;
  reuse_order?: string;
  template?: string;
  assignee?: string;
  role?: string;
  stage?: string;
  due_date?: string;
  reuse_assessment?: boolean;
};
export type OrderSummary = Pick<
  OrderItem,
  | 'kind'
  | 'order_item'
  | 'therapy_type'
  | 'start_date'
  | 'end_date'
  | 'sessions'
  | 'template'
  | 'stage'
  | 'due_date'
>;
export type OrderRow = {
  name: string;
  doctype: string;
  kind: string;
  title: string;
  status: string;
  modified: string;
  author: string;
  reviewer: string;
  reviewer_name?: string;
  order_items?: OrderSummary[];
  can_edit: boolean;
  can_review: boolean;
  can_cancel: boolean;
  can_stop: boolean;
};
export type Options = {
  doctor: Choice[];
  can_open: boolean;
  can_review: boolean;
  notice: string;
  site_now: string;
  timezone: string;
};
export type Context = {
  context: {
    key: string;
    modified: string;
    patient: string;
    company: string;
    department: string;
  };
  visit: VisitDetail;
  records: OrderRow[];
  can_open: boolean;
  assessment_history: {
    name: string;
    assessment_template: string;
    stage: string;
    status: string;
    assessed_at?: string;
  }[];
  history_truncated: boolean;
};
export type OrderDetail = {
  row: OrderRow;
  content: Record<string, unknown> & { items?: OrderItem[] };
  events?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
};
export type Draft = {
  name: string;
  modified: string;
  items: OrderItem[];
  status: string;
};
export type PreviewRow = {
  index: number;
  item: OrderItem;
  action: string;
  candidates: { name: string; status: string }[];
};
export type Preview = {
  token: string;
  action: string;
  notice: string;
  summary: {
    patient_name?: string;
    key?: string;
    rows?: PreviewRow[];
    row?: OrderRow;
    booking_order?: {
      patient_name: string;
      therapy_type: string;
      sessions_planned: number;
      start_date: string;
      end_date?: string;
      clinical_notes?: string;
    };
    reason?: string;
    decision?: string;
    effective_at?: string;
    plan?: Record<string, unknown>;
  };
};
export type Receipt = {
  name?: string;
  status?: string;
  found?: boolean;
  message?: string;
  blocked?: boolean;
};
export const states: Record<string, string> = {
  Draft: '草稿',
  'Pending Review': '待临床确认',
  'Awaiting Signature': '待核对原确认',
  'Pending Signature': '待核对原确认',
  Authorized: '已临床确认',
  Returned: '已退回',
  Rejected: '已驳回',
  Cancelled: '已撤销',
  Completed: '已完成',
  Assigned: '待评估',
  'In Progress': '评估中',
  Scheduled: '已排程',
  Accepted: '已接单',
  Effective: '生效中',
};
export const kindName = (kind: string) =>
  ({
    Treatment: '康复医嘱',
    Assessment: '评估医嘱',
    AssessmentOrder: '评估医嘱',
    OrderDraft: '组合草稿',
  })[kind] || kind;
export const options = () => get<Options>(api, 'get_options');
export type PatientChoice = Pick<
  Visit,
  'patient' | 'patient_name' | 'sex' | 'age'
>;
export type PatientEncounter = Pick<
  Visit,
  | 'key'
  | 'name'
  | 'kind'
  | 'patient_name'
  | 'company'
  | 'department'
  | 'date'
  | 'time'
  | 'status'
>;
export type VisitKind = Visit['kind'];
export type PatientScope = 'mine' | 'authorized';
export type VisitView = 'today' | 'current' | 'history';
type PickerQuery = {
  kind: VisitKind;
  scope: PatientScope;
  current: number;
  page_size: number;
};
export const patientChoices = (
  params: PickerQuery & { keyword: string; view: VisitView },
) =>
  get<{ data: PatientChoice[]; total: number }>(
    api,
    'get_patient_choices',
    params,
  );
export const patientEncounters = (params: PickerQuery & { patient: string }) =>
  get<{ data: PatientEncounter[]; total: number }>(
    api,
    'get_patient_encounters',
    params,
  );
export const context = (key: string) =>
  get<Context>(api, 'get_context', { key });
type ReferenceFilters = { therapy_type?: string; care_setting?: string };
export const references = (
  key: string,
  kind: string,
  keyword = '',
  filters?: ReferenceFilters,
) => get<Choice[]>(api, 'references', { key, kind, keyword, ...filters });
export const save = (data: unknown) => post<Draft>(api, 'save_draft', data);
export const previewSubmit = (data: unknown) =>
  post<Preview>(api, 'preview_submit', data);
export const previewAction = (data: unknown) =>
  post<Preview>(api, 'preview_action', data);
export const confirm = (data: unknown) => post<Receipt>(api, 'confirm', data);
export const receipt = (request_id: string) =>
  get<Receipt>(api, 'get_receipt', { request_id });
export const order = ({ name, doctype }: Pick<OrderRow, 'name' | 'doctype'>) =>
  get<OrderDetail>(api, 'get_order', { name, doctype });
export const editOriginal = (
  row: OrderRow,
  request_id: string,
  reason?: string,
) =>
  post<Draft>(api, 'edit_original', {
    name: row.name,
    doctype: row.doctype,
    modified: row.modified,
    request_id,
    reason,
  });
export const assessment = (name: string) =>
  get<Record<string, unknown>>(api, 'get_assessment', { name });
