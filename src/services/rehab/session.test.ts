import { describe, expect, it } from 'vitest';
import { HOME_PATH, safeReturnPath } from './session';

describe('console login return path', () => {
  it('keeps console deep links and their query and fragment', () => {
    expect(safeReturnPath('/console/session?tab=roles#account')).toBe('/console/session?tab=roles#account');
  });
  it.each([null, '', 'https://evil.test/console/session', '//evil.test', '/desk',
    '/console/../desk', '/console/user/login', '/console/\\evil.test', '/console/%2f%2fevil.test',
    '/console/session\n', '/consoleevil/session'])('rejects external, ambiguous and looping return path %s', (path) => {
    expect(safeReturnPath(path)).toBe(HOME_PATH);
  });
});
