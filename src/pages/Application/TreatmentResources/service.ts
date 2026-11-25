import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';

export type LinkField =
  | 'company'
  | 'department'
  | 'area'
  | 'native_service_unit';
export type RoomField =
  | LinkField
  | 'resource_name'
  | 'display_label'
  | 'notes'
  | 'enabled';
export type Room = Partial<Record<Exclude<RoomField, 'enabled'>, string>> & {
  name: string;
  modified: string;
  enabled?: number;
  can_edit?: boolean;
};
export type Options = {
  can_create: boolean;
  read_fields: RoomField[];
  write_fields: RoomField[];
  link_fields: LinkField[];
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('resource_console', method, params);
export const links = (
  field: LinkField,
  keyword = '',
  company?: string,
  department?: string,
) =>
  api<{ label: string; value: string }[]>('search_options', {
    field,
    keyword,
    company,
    department,
  });
export const save = (values: Record<string, unknown>, room?: Room) =>
  post('resource_console', 'save_room', {
    name: room?.name,
    modified: room?.modified,
    values,
  });
