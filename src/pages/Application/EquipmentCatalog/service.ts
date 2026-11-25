import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';
export { post } from '../ChargeCatalog/service';
export type Device = {
  name: string;
  modified: string;
  display_label?: string;
  resource_name?: string;
  company?: string;
  department?: string;
  equipment_category?: string;
  enabled?: number;
  asset?: string;
  can_edit?: boolean;
  edit_blocked?: boolean;
  health?: { state: string; reasons: string[] };
};
export type Options = {
  can_create: boolean;
  read_fields: string[];
  write_fields: string[];
  can_read_types: boolean;
  can_create_types: boolean;
};
export type Context = Options & {
  device: Device;
  can_edit: boolean;
  edit_blocked: boolean;
  can_bind: boolean;
  can_change_state: boolean;
  can_read_inspections: boolean;
  can_read_events: boolean;
  can_read_plans: boolean;
  identity_locked: boolean;
  health: NonNullable<Device['health']>;
};
export type EquipmentType = {
  name: string;
  modified: string;
  equipment_type_name?: string;
  description?: string;
  disabled?: number;
  can_edit?: boolean;
};
export type List<T> = {
  data: T[];
  total: number;
  success: boolean;
  read_fields?: string[];
  write_fields?: string[];
  can_create?: boolean;
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('equipment_console', method, params);
export const mutate = (method: string, data: unknown) =>
  post('equipment_console', method, data);
export const links = (
  field: string,
  keyword = '',
  company?: string,
  department?: string,
) =>
  api<{ value: string; label: string }[]>('search_options', {
    field,
    keyword,
    company,
    department,
  });
export function valuesFor(
  values: Record<string, unknown>,
  fields: string[],
  changes?: Set<string>,
) {
  return Object.fromEntries(
    fields
      .filter(
        (field) =>
          Object.hasOwn(values, field) && (!changes || changes.has(field)),
      )
      .map((field) => [
        field,
        typeof values[field] === 'boolean'
          ? Number(values[field])
          : (values[field] ?? ''),
      ]),
  );
}
