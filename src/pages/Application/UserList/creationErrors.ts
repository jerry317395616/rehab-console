import { statusOf } from '@/services/rehab/auth';
import type { CreateUserValues } from './service';

const fields = new Set([
  'email',
  'first_name',
  'last_name',
  'username',
  'enabled',
  'roles',
  'credential_mode',
  'password',
  'password_confirm',
]);
export function creationError(
  error: unknown,
  fallback = '添加失败，请稍后重试。',
) {
  const body = (
    error as {
      response?: {
        data?: {
          field_errors?: Record<string, unknown>;
          _server_messages?: string;
        };
      };
    }
  )?.response?.data;
  const fieldErrors = Object.entries(body?.field_errors || {}).flatMap(
    ([name, value]) =>
      fields.has(name) && typeof value === 'string'
        ? [{ name: name as keyof CreateUserValues, errors: [value] }]
        : [],
  );
  let message = fallback;
  try {
    const messages = JSON.parse(body?._server_messages || '[]');
    const last = messages.at(-1);
    const parsed = typeof last === 'string' ? JSON.parse(last) : last;
    if (typeof parsed?.message === 'string') {
      message =
        new DOMParser().parseFromString(parsed.message, 'text/html').body
          .textContent || message;
    }
  } catch {
    /* Native validation messages may be absent on transport errors. */
  }
  if (statusOf(error) === 403)
    message = '当前账号没有执行此操作的权限，请重新核对授权。';
  if (statusOf(error) === 401) message = '登录已失效，请重新登录。';
  return { fieldErrors, message };
}
