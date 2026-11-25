import type { RoleSelection, UserRoleContext } from './service';

export function selectedRoles(
  selection: RoleSelection,
  context: UserRoleContext,
): string[] {
  if (selection.mode === 'direct') return selection.roles || [];
  return [
    ...new Set(
      (selection.role_profiles || []).flatMap(
        (name) =>
          context.profile_options.find((profile) => profile.name === name)
            ?.roles || context.roles,
      ),
    ),
  ];
}

export function losesDeskAccess(
  selection: RoleSelection,
  context: UserRoleContext,
) {
  return (
    context.user.user_type === 'System User' &&
    !selectedRoles(selection, context).some((name) =>
      context.role_options.some(
        (role) => role.name === name && role.desk_access,
      ),
    )
  );
}
