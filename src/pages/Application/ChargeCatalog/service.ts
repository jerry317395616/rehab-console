import { request } from '@umijs/max';

export type Capability = {
  can_read: boolean;
  can_create: boolean;
  can_write: boolean;
  can_delete: boolean;
  read_fields: string[];
  write_fields: string[];
};
export type ChargeOptions = {
  item: Capability;
  price: Capability;
  can_read_groups: boolean;
  can_read_therapies: boolean;
  can_read_schemes: boolean;
  can_read_order_items: boolean;
};
export type ChargeItem = {
  name: string;
  modified: string;
  item_code?: string;
  item_name?: string;
  item_group?: string;
  stock_uom?: string;
  description?: string;
  disabled?: number;
  can_edit: boolean;
  can_delete: boolean;
  price?: {
    status: 'priced' | 'missing' | 'ambiguous';
    amount?: number;
    currency?: string;
    uom?: string;
  };
};
export type Group = {
  name: string;
  parent_item_group?: string;
  is_group?: number;
};
export type LinkOption = { value: string; label: string; uom?: string };
export type Price = {
  name: string;
  modified: string;
  item_code: string;
  price_list: string;
  uom: string;
  currency: string;
  price_list_rate: number;
  valid_from?: string;
  valid_upto?: string;
  note?: string;
  can_edit?: boolean;
  can_change?: boolean;
};
export type OrderItem = {
  charge_count?: number | null;
  name: string;
  modified: string;
  code: string;
  item_name: string;
  order_type?: string;
  order_category?: string;
  order_type_label?: string;
  order_category_label?: string;
  order_term?: string;
  default_sessions?: number;
  description?: string;
  disabled?: number;
  can_edit?: boolean;
};
export type ChargeLine = {
  _key: string;
  item_code?: string;
  uom?: string;
  default_qty?: number;
  quantity_mode?: 'Fixed' | 'Actual';
  requirement?: 'Required' | 'Optional';
  enabled?: number;
};
export type DirectCharge = ChargeLine & { name?: string; item_name?: string };
export type Scheme = {
  name: string;
  modified: string;
  order_item: string;
  company: string;
  therapy_type?: string;
  version: number;
  docstatus: number;
  valid_from: string;
  valid_upto?: string;
  enabled: number;
  change_reason?: string;
  lines?: ChargeLine[];
  can_edit?: boolean;
  can_publish?: boolean;
};
export type List<T> = {
  data: T[];
  total: number;
  success: boolean;
  read_fields?: string[];
  can_create?: boolean;
};
export type ItemContext = {
  item: ChargeItem;
  read_fields: string[];
  write_fields: string[];
  can_edit: boolean;
  can_delete: boolean;
  delete_blocked: boolean;
};
export async function get<T>(
  module: string,
  method: string,
  params?: Record<string, unknown>,
) {
  const result = await request<{ message: T }>(
    `/api/method/rehab.${module}.${method}`,
    { method: 'GET', params, skipErrorHandler: true },
  );
  return result.message;
}
export async function post<T = { name: string }>(
  module: string,
  method: string,
  data: unknown,
) {
  const result = await request<{ message: T }>(
    `/api/method/rehab.${module}.${method}`,
    { method: 'POST', data: { data }, skipErrorHandler: true },
  );
  return result.message;
}
export const getOptions = () =>
  get<ChargeOptions>('charge_catalog_api', 'get_options');
export const getGroups = () =>
  get<{ nodes: Group[] }>('charge_catalog_api', 'get_groups');
export const getItem = (item_code: string) =>
  get<ItemContext>('charge_catalog_api', 'get_item', { item_code });
export const searchItemOptions = (field: string, keyword = '') =>
  get<LinkOption[]>('charge_catalog_api', 'search_options', { field, keyword });
export const searchPriceOptions = (
  field: string,
  keyword = '',
  item_code?: string,
) =>
  get<LinkOption[]>('charge_price_api', 'search_price_options', {
    field,
    keyword,
    item_code,
  });
export const searchSchemeOptions = (field: string, keyword = '') =>
  get<LinkOption[]>('charge_scheme', 'search_scheme_options', {
    field,
    keyword,
  });
export const getPrices = (
  item_code: string,
  params: { current?: number; pageSize?: number },
) =>
  get<List<Price>>('charge_price_api', 'get_prices', {
    item_code,
    current: params.current,
    page_size: params.pageSize,
  });
export const getSchemes = (params: {
  order_item?: string;
  item_code?: string;
  current?: number;
  pageSize?: number;
}) =>
  get<List<Scheme>>('charge_scheme', 'get_schemes', {
    ...params,
    page_size: params.pageSize,
    pageSize: undefined,
  });
export const getScheme = (name: string) =>
  get<{ scheme: Scheme; can_edit: boolean; can_publish: boolean }>(
    'charge_scheme',
    'get_scheme',
    { name },
  );
export const getOrderItem = (name: string) =>
  get<{
    item: OrderItem;
    charge_items: DirectCharge[];
    use_direct_charges: boolean;
    charge_read_fields: string[];
    charge_write_fields: string[];
    can_select_items: boolean;
    can_read_prices: boolean;
    read_fields: string[];
    write_fields: string[];
    can_edit: boolean;
    can_read_treatments: boolean;
  }>('charge_order_item', 'get_order_item', { name });
export function projectValues(
  values: Record<string, unknown>,
  fields: string[],
) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(values, field))
      .map((field) => [
        field,
        field === 'disabled' || field === 'enabled'
          ? Number(Boolean(values[field]))
          : typeof values[field] === 'string'
            ? values[field].trim()
            : values[field],
      ]),
  );
}
export function getItems(
  params: Record<string, unknown> & { current?: number; pageSize?: number },
  sort: Record<string, 'ascend' | 'descend' | null> = {},
) {
  const order = Object.entries(sort).find(([, value]) => value);
  return get<List<ChargeItem>>('charge_catalog_api', 'get_items', {
    ...params,
    current: params.current ?? 1,
    page_size: params.pageSize ?? 20,
    pageSize: undefined,
    sort_field: order?.[0] || 'modified',
    sort_order: order?.[1] || 'descend',
  });
}
export const getOrderItems = (
  params: Record<string, unknown> & { pageSize?: number },
) =>
  get<List<OrderItem>>('charge_order_item', 'get_order_items', {
    ...params,
    page_size: params.pageSize ?? 20,
    pageSize: undefined,
  });
