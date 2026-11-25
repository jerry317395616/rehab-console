import { request } from '@umijs/max';

export type PermissionRule = {
  permlevel: number;
  if_owner: 0 | 1;
  rights: Record<string, 0 | 1>;
};
export type PermissionObject = {
  doctype: string;
  label: string;
  module: string;
  module_label: string;
  app: string;
  can_edit: boolean;
  source: 'standard' | 'custom';
  basic_rights: string[];
  rules: PermissionRule[];
};
export type PermissionCatalog = {
  role: string;
  label: string;
  editable_role: boolean;
  supervisor: boolean;
  objects: PermissionObject[];
};
export type PermissionContext = {
  doctype: string;
  label: string;
  can_edit: boolean;
  source: 'standard' | 'custom';
  version: string;
  rules: PermissionRule[];
  rights: string[];
  levels: { level: number; rights: string[]; owner_rights: string[] }[];
  fields: {
    name: string;
    label: string;
    permlevel: number;
    read_only: boolean;
  }[];
};
export type PermissionChange = {
  doctype: string;
  version: string;
  rules: PermissionRule[];
};
export type PermissionPreview = {
  token: string;
  changes: {
    doctype: string;
    before: PermissionRule[];
    after: PermissionRule[];
  }[];
  visible_users: number;
  visible_profiles: number;
  restricted: boolean;
};

const endpoint = '/api/method/ione_core.console_role_permissions.';

async function get<T>(method: string, params: Record<string, string>) {
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
export const getPermissionCatalog = (role: string) =>
  get<PermissionCatalog>('get_catalog', { role });
export const getPermissionContext = (role: string, doctype: string) =>
  get<PermissionContext>('get_context', { role, doctype });
export const previewPermissions = (role: string, changes: PermissionChange[]) =>
  post<PermissionPreview>('preview_change', { role, changes });
export const savePermissions = (
  role: string,
  changes: PermissionChange[],
  token: string,
) =>
  post<{ role: string; saved: number }>('save_permissions', {
    role,
    changes,
    token,
  });

export const permissionLabels: Record<string, string> = {
  select: '关联选择',
  read: '查看',
  create: '新增',
  write: '修改',
  delete: '删除',
  submit: '提交',
  cancel: '取消',
  amend: '修订',
  print: '打印',
  email: '邮件',
  report: '报表',
  import: '导入',
  export: '导出',
  share: '分享',
  mask: '查看脱敏字段原文',
};
export const ruleKey = (rule: PermissionRule) =>
  `${rule.permlevel}:${rule.if_owner}`;
export function equalRules(left: PermissionRule[], right: PermissionRule[]) {
  const normalize = (rules: PermissionRule[]) =>
    rules
      .map((rule) => ({
        ...rule,
        rights: Object.fromEntries(
          Object.entries(rule.rights).sort(([a], [b]) => a.localeCompare(b)),
        ),
      }))
      .sort((a, b) => ruleKey(a).localeCompare(ruleKey(b)));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
export function permissionDelta(
  before: PermissionRule[],
  after: PermissionRule[],
) {
  const previous = new Map(before.map((rule) => [ruleKey(rule), rule]));
  const current = new Map(after.map((rule) => [ruleKey(rule), rule]));
  return [...new Set([...previous.keys(), ...current.keys()])].flatMap(
    (key) => {
      const left = previous.get(key);
      const right = current.get(key);
      const model = right || left;
      if (!model) return [];
      const changes = [
        ...new Set([
          ...Object.keys(left?.rights || {}),
          ...Object.keys(right?.rights || {}),
        ]),
      ]
        .filter(
          (name) => (left?.rights[name] || 0) !== (right?.rights[name] || 0),
        )
        .map(
          (name) =>
            `${right?.rights[name] ? '授予' : '撤销'}${permissionLabels[name] || name}`,
        );
      if (!changes.length) return [];
      return [
        `级别 ${model.permlevel} · ${model.if_owner ? '仅本人创建' : '不按创建者限制'}：${changes.join('、')}`,
      ];
    },
  );
}
