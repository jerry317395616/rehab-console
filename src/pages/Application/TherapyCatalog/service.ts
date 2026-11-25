import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';
export type Relation = {
  _key: string;
  name?: string;
  order_item?: string;
  item_name?: string;
  order_term?: string;
  default_sessions?: number;
  company?: string;
  department?: string;
  is_default?: number | boolean;
  equipment_type?: string;
  quantity?: number;
};
export type Treatment = {
  name: string;
  modified: string;
  rehab_treatment_code?: string;
  rehab_display_label?: string;
  rehab_category?: string;
  rehab_short_name?: string;
  rehab_search_code?: string;
  rehab_category_ref?: string;
  category_label?: string;
  category_disabled?: boolean;
  rehab_project_kind?: 'Treatment' | 'Assessment';
  rehab_assessment_template?: string;
  assessment_setup_required?: boolean;
  rehab_allow_outpatient?: number | boolean;
  rehab_allow_inpatient?: number | boolean;
  rehab_allow_bedside?: number | boolean;
  default_duration?: number;
  rehab_duration_min?: number | null;
  rehab_duration_max?: number | null;
  description?: string;
  rehab_catalog_disabled?: number | boolean;
  rehab_requires_therapist?: number | boolean;
  rehab_requires_equipment?: number | boolean;
  rehab_gap_minutes?: number;
  rehab_execution_mode?: 'Serial' | 'Parallel';
  rehab_booking_mode?: 'Personnel' | 'Equipment';
  rehab_booking_limit?: number;
  rehab_is_package?: number | boolean;
  rehab_auto_split?: number | boolean;
  rehab_multi_booking?: number | boolean;
  rehab_batch_booking?: number | boolean;
  rehab_online_booking?: number | boolean;
  rehab_fixed_time_booking?: number | boolean;
  rehab_independent_booking?: number | boolean;
  rehab_reverse_association?: number | boolean;
  rehab_therapist_prescribing?: number | boolean;
  rehab_charge_on_execution?: number | boolean;
  rehab_bedside_treatment?: number | boolean;
  rehab_therapist_count?: number;
  rehab_booking_required?: number | boolean;
  rehab_equipment_count?: number;
  rehab_equipment_mode?: 'Any' | 'All';
  rehab_room_buffer?: number;
  rehab_equipment_buffer?: number;
  rehab_order_items?: Relation[];
  rehab_departments?: Relation[];
  rehab_equipment_types?: Relation[];
  can_edit?: boolean;
  enabled?: boolean;
};
export type Rights = {
  can_read_reference_prices: boolean;
  can_read_booking_rules: boolean;
  can_read_tasks: boolean;
  read_fields: string[];
  write_fields: string[];
  can_create: boolean;
  can_read_state: boolean;
  can_select_orders: boolean;
  child_read_fields: Record<string, string[]>;
  child_write_fields: Record<string, string[]>;
  can_read_categories: boolean;
  can_create_categories: boolean;
  can_select_categories: boolean;
  can_select_departments: boolean;
  can_select_companies: boolean;
  can_select_equipment_types: boolean;
  can_select_assessment_templates: boolean;
};
export type Context = Rights & {
  definition: { schema_version: number; attributes: Partial<Treatment> };
  item: Treatment;
  can_edit: boolean;
  can_delete: boolean;
  native_disabled: boolean;
  hidden_links: boolean;
};
export type Link = {
  value: string;
  label: string;
  item_name?: string;
  order_term?: string;
  default_sessions?: number;
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('therapy_catalog', method, params);
export const mutate = (method: string, data: unknown) =>
  post('therapy_catalog', method, data);
export const links = (field: string, keyword = '', company = '') =>
  api<Link[]>('search_options', { field, keyword, company });
export const propertiesApi = <T>(
  method: string,
  params?: Record<string, unknown>,
) => get<T>('therapy_properties', method, params);
export const propertiesMutation = (method: string, data: unknown) =>
  post('therapy_properties', method, data);
export const careSettings = [
  { value: 'Outpatient', field: 'rehab_allow_outpatient', label: '门诊' },
  { value: 'Inpatient', field: 'rehab_allow_inpatient', label: '住院治疗区' },
  { value: 'Bedside', field: 'rehab_allow_bedside', label: '床旁' },
] as const;
export const relationFields = [
  'rehab_order_items',
  'rehab_departments',
  'rehab_equipment_types',
] as const;
export type RelationField = (typeof relationFields)[number];
export const definitionFlags = [
  ['rehab_is_package', '组套'],
  ['rehab_auto_split', '自拆'],
  ['rehab_multi_booking', '多人预约'],
  ['rehab_batch_booking', '批量预约'],
  ['rehab_online_booking', '线上预约'],
  ['rehab_fixed_time_booking', '固定时段'],
  ['rehab_independent_booking', '独立预约'],
  ['rehab_reverse_association', '反向关联'],
  ['rehab_therapist_prescribing', '治疗师开单'],
  ['rehab_charge_on_execution', '执行计费'],
  ['rehab_bedside_treatment', '床旁治疗'],
] as const;
