import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';

export function errorMessage(reason: unknown) {
  if (statusOf(reason) === 401)
    window.dispatchEvent(new Event('rehab:session-expired'));
  return creationError(reason, '操作失败，请核对资料或重新加载。').message;
}
