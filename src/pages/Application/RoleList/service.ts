import { request } from '@umijs/max';

export type RoleRow = {
  name: string;
  role_name: string;
  label: string;
  disabled: 0 | 1;
  desk_access: 0 | 1;
  modified: string;
  is_reserved: boolean;
};

export type RoleDetail = RoleRow & {
  home_page?: string | null;
  restrict_to_domain?: string | null;
  two_factor_auth?: 0 | 1;
};

export type RoleSearch = {
  keyword?: string;
  disabled?: number | string;
  desk_access?: number | string;
};

export type RoleActions = {
  can_edit: boolean;
  can_delete: boolean;
  can_rename: boolean;
  self_protected: boolean;
};
export type ManagedRoleRow = RoleRow & RoleActions;
export type RoleField =
  | 'role_name'
  | 'disabled'
  | 'desk_access'
  | 'home_page'
  | 'restrict_to_domain'
  | 'two_factor_auth';
export type RoleValues = {
  role_name: string;
  disabled: 0 | 1;
  desk_access: boolean;
  home_page?: string;
  restrict_to_domain?: string;
  two_factor_auth: boolean;
};
export type RoleOptions = {
  can_configure_permissions: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  create_fields: RoleField[];
  write_fields: RoleField[];
  domains: string[];
};
export type RoleContext = RoleActions & {
  role: RoleDetail;
  write_fields: RoleField[];
  domains: string[];
  delete_blocked: boolean;
};
export type RoleChange = {
  role: string;
  modified: string;
  values: Partial<Record<RoleField, string | number | boolean | null>>;
};
export type RolePreview = {
  reasons: string[];
  token: string | null;
  visible_users?: number;
  visible_profiles?: number;
  restricted?: boolean;
  other_associations?: boolean;
};

const management = '/api/method/ione_core.console_role_management.';

export async function getRoles(
  params: RoleSearch & { current?: number; pageSize?: number },
  sort: Record<string, 'ascend' | 'descend' | null> = {},
) {
  const order = Object.entries(sort).find(([, direction]) => direction);
  const result = await request<{
    message: { data: ManagedRoleRow[]; total: number; success: boolean };
  }>(`${management}get_roles`, {
    method: 'GET',
    params: {
      current: params.current ?? 1,
      page_size: params.pageSize ?? 20,
      keyword: params.keyword?.trim() || undefined,
      disabled: params.disabled === '' ? undefined : params.disabled,
      desk_access: params.desk_access === '' ? undefined : params.desk_access,
      sort_field: order?.[0] || 'role_name',
      sort_order: order?.[1] || 'ascend',
    },
    skipErrorHandler: true,
  });
  return result.message;
}

export async function getRole(role: string) {
  const result = await request<{ message: RoleDetail }>(
    '/api/method/ione_core.console_roles.get_role',
    { method: 'GET', params: { role }, skipErrorHandler: true },
  );
  return result.message;
}

export async function getRoleOptions() {
  const result = await request<{ message: RoleOptions }>(
    `${management}get_options`,
    {
      method: 'GET',
      skipErrorHandler: true,
    },
  );
  return result.message;
}

export async function getRoleContext(role: string) {
  const result = await request<{ message: RoleContext }>(
    `${management}get_context`,
    {
      method: 'GET',
      params: { role },
      skipErrorHandler: true,
    },
  );
  return result.message;
}

export function roleValues(
  values: RoleValues,
  fields: RoleField[],
  creating: boolean,
) {
  const result: RoleChange['values'] = {};
  for (const field of fields) {
    if (field === 'role_name' && !creating) continue;
    const value = values[field];
    if (
      value === undefined &&
      field !== 'home_page' &&
      field !== 'restrict_to_domain'
    )
      continue;
    if (value === undefined && !Object.hasOwn(values, field)) continue;
    result[field] =
      typeof value === 'string' ? value.trim() || null : (value ?? null);
  }
  return result;
}

async function post<T>(method: string, data: unknown) {
  const result = await request<{ message: T }>(`${management}${method}`, {
    method: 'POST',
    data: { data },
    skipErrorHandler: true,
  });
  return result.message;
}

export function createRole(values: RoleChange['values']) {
  return post<{ name: string; modified: string }>('create_role', { values });
}
export function previewRoleChange(change: RoleChange) {
  return post<RolePreview>('preview_change', change);
}
export function saveRole(change: RoleChange, token: string | null) {
  return post<{ name: string; modified: string }>('save_role', {
    ...change,
    confirmation_token: token,
  });
}
export function renameRole(role: string, modified: string, newName: string) {
  return post<{ name: string; modified: string }>('rename_role', {
    role,
    modified,
    new_name: newName.trim(),
    confirm_name: role,
  });
}
export function deleteRole(
  role: string,
  modified: string,
  confirmation: string,
) {
  return post<{ name: string; deleted: boolean }>('delete_role', {
    role,
    modified,
    confirm_name: confirmation,
  });
}
