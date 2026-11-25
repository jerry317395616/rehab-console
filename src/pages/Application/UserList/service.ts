import { request } from '@umijs/max';

export type UserRow = {
  name: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  enabled: 0 | 1;
  user_type?: 'System User' | 'Website User';
  modified: string;
};

export type UserSearch = {
  keyword?: string;
  enabled?: number | string;
  user_type?: string;
};

export async function getUsers(
  params: UserSearch & { current?: number; pageSize?: number },
  sort: Record<string, 'ascend' | 'descend' | null> = {},
) {
  const order = Object.entries(sort).find(([, direction]) => direction);
  const response = await request<{
    message: { data: UserRow[]; total: number; success: boolean };
  }>('/api/method/ione_core.console_users.get_users', {
    method: 'GET',
    params: {
      current: params.current ?? 1,
      page_size: params.pageSize ?? 20,
      keyword: params.keyword?.trim() || undefined,
      enabled: params.enabled === '' ? undefined : params.enabled,
      user_type: params.user_type || undefined,
      sort_field: order?.[0] || 'modified',
      sort_order: order?.[1] || 'descend',
    },
    skipErrorHandler: true,
  });
  return response.message;
}

export type CreationOptions = {
  can_create: boolean;
  can_assign_roles: boolean;
  email_invitation_available: boolean;
  roles: { name: string; label: string; desk_access: boolean }[];
};

export type CreateUserValues = {
  email: string;
  first_name: string;
  last_name?: string;
  username?: string;
  enabled: boolean;
  roles?: string[];
  credential_mode: 'password' | 'invitation';
  password?: string;
  password_confirm?: string;
};

export type CreatedUser = {
  name: string;
  enabled: boolean;
  can_login_console: boolean;
  credential_mode: 'password' | 'invitation';
};

export async function getCreationOptions() {
  const response = await request<{ message: CreationOptions }>(
    '/api/method/ione_core.console_user_creation.get_creation_options',
    { method: 'GET', skipErrorHandler: true },
  );
  return response.message;
}

export async function createUser(values: CreateUserValues) {
  const response = await request<{ message: CreatedUser }>(
    '/api/method/ione_core.console_user_creation.create_user',
    {
      method: 'POST',
      skipErrorHandler: true,
      data: {
        data: {
          email: values.email.trim(),
          first_name: values.first_name.trim(),
          last_name: values.last_name?.trim(),
          username: values.username?.trim(),
          enabled: values.enabled,
          roles: values.roles || [],
          credential_mode: values.credential_mode,
          ...(values.credential_mode === 'password'
            ? {
                password: values.password,
                password_confirm: values.password_confirm,
              }
            : {}),
        },
      },
    },
  );
  return response.message;
}

export type RoleAccess = {
  can_view: boolean;
  can_edit: boolean;
  is_administrator: boolean;
};
export type RoleSelection = {
  mode: 'direct' | 'profiles';
  roles: string[];
  role_profiles: string[];
};
export type UserRoleContext = RoleSelection & {
  user: Pick<UserRow, 'name' | 'email' | 'full_name' | 'modified'> & {
    enabled: boolean;
    user_type: string;
  };
  can_edit: boolean;
  can_use_profiles: boolean;
  protected: boolean;
  automatic_roles: string[];
  role_options: { name: string; label: string; desk_access: boolean }[];
  profile_options: { name: string; roles: string[]; available: boolean }[];
};

export async function getRoleAccess() {
  const result = await request<{ message: RoleAccess }>(
    '/api/method/ione_core.console_user_roles.get_role_access',
    { method: 'GET', skipErrorHandler: true },
  );
  return result.message;
}

export async function getUserRoles(user: string) {
  const result = await request<{ message: UserRoleContext }>(
    '/api/method/ione_core.console_user_roles.get_user_roles',
    { method: 'GET', params: { user }, skipErrorHandler: true },
  );
  return result.message;
}

export async function saveUserRoles(
  user: string,
  modified: string,
  selection: RoleSelection,
  confirmLoss: boolean,
) {
  const result = await request<{
    message: { name: string; modified: string; can_login_console: boolean };
  }>('/api/method/ione_core.console_user_roles.save_user_roles', {
    method: 'POST',
    skipErrorHandler: true,
    data: {
      data: {
        user,
        modified,
        mode: selection.mode,
        roles: selection.mode === 'direct' ? selection.roles : [],
        role_profiles:
          selection.mode === 'profiles' ? selection.role_profiles : [],
        confirm_loss_of_desk_access: confirmLoss,
      },
    },
  });
  return result.message;
}
