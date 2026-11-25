import { request } from '@umijs/max';

export type CompanyField =
  | 'company_name'
  | 'abbr'
  | 'country'
  | 'default_currency'
  | 'is_group'
  | 'parent_company'
  | 'tax_id'
  | 'phone_no'
  | 'email'
  | 'website'
  | 'valuation_method';
export type CompanyValues = Partial<
  Record<Exclude<CompanyField, 'is_group'>, string | null>
> & { is_group?: boolean | 0 | 1 };
export type CompanyRow = CompanyValues & {
  name: string;
  modified: string;
  can_edit: boolean;
};
export type CompanyOptions = {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  read_fields: CompanyField[];
  create_fields: CompanyField[];
  write_fields: CompanyField[];
  defaults: CompanyValues;
  valuation_methods: string[];
};
export type CompanyContext = {
  company: Omit<CompanyRow, 'can_edit'>;
  can_edit: boolean;
  write_fields: CompanyField[];
  read_fields: CompanyField[];
  valuation_methods: string[];
};
export type CompanySearch = { keyword?: string; is_group?: number | string };
const endpoint = '/api/method/ione_core.console_companies.';
async function get<T>(method: string, params?: Record<string, unknown>) {
  const response = await request<{ message: T }>(`${endpoint}${method}`, {
    method: 'GET',
    params,
    skipErrorHandler: true,
  });
  return response.message;
}
async function post<T>(method: string, data: unknown) {
  const response = await request<{ message: T }>(`${endpoint}${method}`, {
    method: 'POST',
    data: { data },
    skipErrorHandler: true,
  });
  return response.message;
}
export const getCompanyOptions = () => get<CompanyOptions>('get_options');
export const getCompany = (company: string) =>
  get<CompanyContext>('get_company', { company });
export const searchCompanyOptions = (
  field: 'country' | 'default_currency' | 'parent_company',
  keyword = '',
  company?: string,
) =>
  get<{ value: string; label: string }[]>('search_options', {
    field,
    keyword,
    company,
  });
export function companyValues(values: CompanyValues, fields: CompanyField[]) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(values, field))
      .map((field) => {
        const value = values[field];
        return [
          field,
          field === 'is_group'
            ? Number(Boolean(value))
            : typeof value === 'string'
              ? value.trim() || null
              : null,
        ];
      }),
  );
}
export const createCompany = (values: Record<string, unknown>) =>
  post<{ name: string; modified: string }>('create_company', { values });
export const saveCompany = (
  company: string,
  modified: string,
  values: Record<string, unknown>,
) =>
  post<{ name: string; modified: string }>('save_company', {
    company,
    modified,
    values,
  });
export function getCompanies(
  params: CompanySearch & { current?: number; pageSize?: number },
  sort: Record<string, 'ascend' | 'descend' | null> = {},
) {
  const order = Object.entries(sort).find(([, value]) => value);
  return get<{ data: CompanyRow[]; total: number; success: boolean }>(
    'get_companies',
    {
      current: params.current ?? 1,
      page_size: params.pageSize ?? 20,
      keyword: params.keyword?.trim() || undefined,
      is_group: params.is_group === '' ? undefined : params.is_group,
      sort_field: order?.[0] || 'modified',
      sort_order: order?.[1] || 'descend',
    },
  );
}
