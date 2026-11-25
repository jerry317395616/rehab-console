import { request } from '@umijs/max';
import { setCsrfToken } from './session';

export type RehabUser = API.CurrentUser & {
  userid: string; name: string; roles: string[]; site: string;
  capabilities: { can_admin: boolean };
};
export type Verification = { method: string; prompt?: string; setup?: boolean; token_delivery?: boolean; otp_secret?: string };
export type LoginResponse = { message?: string; tmp_id?: string; verification?: Verification };
export function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}
export function authErrorMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { exc_type?: string } } })?.response;
  if (response?.status === 401) return '账号、密码或验证码不正确，请重新核对。';
  if (response?.data?.exc_type === 'CSRFTokenError') return '登录状态已更新，请刷新页面后重试。';
  if (response?.status === 403) return '当前账号无法访问应用桌面，请联系管理员。';
  if (response?.status === 429) return '尝试次数过多，请稍后重试。';
  if (response?.status === 417) return '当前账号暂时无法登录，请联系管理员核对账号状态。';
  return '暂时无法连接服务器，请检查网络后重试。';
}
export async function getSession(): Promise<RehabUser> {
  const result = await request<{ message: RehabUser & { csrf_token: string } }>(
    '/api/method/rehab.frontend_auth.get_session', { method: 'GET', skipErrorHandler: true });
  const { csrf_token, ...user } = result.message;
  setCsrfToken(csrf_token);
  return user;
}
export function login(values: { usr?: string; pwd?: string; otp?: string; tmp_id?: string }) {
  return request<LoginResponse>('/api/method/login', { method: 'POST', data: values, skipErrorHandler: true });
}
export async function logout() {
  await request('/api/method/logout', { method: 'POST', skipErrorHandler: true });
  setCsrfToken('');
}
