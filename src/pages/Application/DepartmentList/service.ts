import { request } from '@umijs/max';

export type DepartmentField =
  | 'department_name'
  | 'company'
  | 'parent_department'
  | 'is_group'
  | 'disabled';
export type DepartmentValues = Partial<
  Record<'department_name' | 'company' | 'parent_department', string | null>
> & { is_group?: boolean | number; disabled?: boolean | number };
export type DepartmentNode = DepartmentValues & { name: string };
export type DepartmentRow = DepartmentNode & {
  modified: string;
  can_edit: boolean;
  can_delete: boolean;
  can_rename: boolean;
  is_root: boolean;
};
export type DepartmentOptions = {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  read_fields: DepartmentField[];
  create_fields: DepartmentField[];
  write_fields: DepartmentField[];
};
export type DepartmentContext = Pick<
  DepartmentOptions,
  'read_fields' | 'write_fields'
> &
  Pick<DepartmentRow, 'can_edit' | 'can_delete' | 'can_rename' | 'is_root'> & {
    department: DepartmentNode & { modified: string };
    delete_blocked: boolean;
  };
export type DepartmentSearch = {
  keyword?: string;
  company?: string;
  department?: string;
  disabled?: string | number;
  is_group?: string | number;
};
export type LinkOption = { value: string; label: string };
const endpoint = '/api/method/ione_core.console_departments.';
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
export const getDepartmentOptions = () => get<DepartmentOptions>('get_options');
export const getDepartmentTree = (company?: string) =>
  get<{ nodes: DepartmentNode[] }>('get_tree', { company });
export const getDepartment = (department: string) =>
  get<DepartmentContext>('get_department', { department });
export const searchDepartmentCompanies = (keyword = '') =>
  get<LinkOption[]>('search_companies', { keyword });
export const searchDepartmentParents = (
  company: string,
  keyword = '',
  department?: string,
) => get<LinkOption[]>('search_parents', { company, keyword, department });
export function departmentValues(
  values: DepartmentValues,
  fields: DepartmentField[],
) {
  return Object.fromEntries(
    fields
      .filter((field) => Object.hasOwn(values, field))
      .map((field) => {
        const value = values[field];
        return [
          field,
          field === 'is_group' || field === 'disabled'
            ? Number(Boolean(value))
            : typeof value === 'string'
              ? value.trim() || null
              : null,
        ];
      }),
  );
}
export const createDepartment = (values: Record<string, unknown>) =>
  post<{ name: string; modified: string }>('create_department', { values });
export const previewDepartment = (
  department: string,
  modified: string,
  values: Record<string, unknown>,
) =>
  post<{ reasons: string[]; token: string | null }>('preview_change', {
    department,
    modified,
    values,
  });
export const saveDepartment = (
  department: string,
  modified: string,
  values: Record<string, unknown>,
  token?: string | null,
) =>
  post<{ name: string; modified: string }>('save_department', {
    department,
    modified,
    values,
    token,
  });
export const renameDepartment = (
  department: string,
  modified: string,
  new_name: string,
  confirm_name: string,
) =>
  post<{ name: string }>('rename_department', {
    department,
    modified,
    new_name,
    confirm_name,
  });
export const deleteDepartment = (
  department: string,
  modified: string,
  confirm_name: string,
) =>
  post<{ name: string }>('delete_department', {
    department,
    modified,
    confirm_name,
  });
export function getDepartments(
  params: DepartmentSearch & { current?: number; pageSize?: number },
  sort: Record<string, 'ascend' | 'descend' | null> = {},
) {
  const order = Object.entries(sort).find(([, value]) => value);
  return get<{ data: DepartmentRow[]; total: number; success: boolean }>(
    'get_departments',
    {
      current: params.current ?? 1,
      page_size: params.pageSize ?? 20,
      company: params.company || undefined,
      department: params.department || undefined,
      keyword: params.keyword?.trim() || undefined,
      disabled: params.disabled === '' ? undefined : params.disabled,
      is_group: params.is_group === '' ? undefined : params.is_group,
      sort_field: order?.[0] || 'modified',
      sort_order: order?.[1] || 'descend',
    },
  );
}
