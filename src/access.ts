export default function access(
  initialState:
    | {
        currentUser?: API.CurrentUser & {
          capabilities?: { can_admin: boolean };
        };
      }
    | undefined,
) {
  return {
    canAdmin: initialState?.currentUser?.capabilities?.can_admin === true,
  };
}
