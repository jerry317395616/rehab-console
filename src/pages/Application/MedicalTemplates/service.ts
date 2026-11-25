import { request } from '@umijs/max';
import { get, post } from '../ChargeCatalog/service';

const api = 'medical_templates';
export const kinds = {
  Communication: '医患沟通',
  Plan: '诊疗计划',
  Consent: '知情告知',
  Treatment: '治疗记录',
};
export const scopes = { Personal: '个人模板', Department: '科室模板' };
export const states = {
  Draft: '草稿',
  'In Review': '待审核',
  Rejected: '已驳回',
  Published: '已发布',
  Superseded: '历史版本',
  Withdrawn: '已停用',
  Discarded: '已作废',
};
export type Values = {
  template_title: string;
  company: string;
  category: string;
  document_kind: keyof typeof kinds;
  scope: keyof typeof scopes;
  department?: string;
  body?: string;
};
export type Header = Values & {
  name: string;
  revision: number;
  status: keyof typeof states;
  authored_by: string;
  modified: string;
};
export type Detail = Header & {
  rich_body?: string;
  previous_template?: string;
  review_note?: string;
  reviewed_by_name?: string;
  can_edit: boolean;
  can_revise: boolean;
  can_review: boolean;
  can_withdraw: boolean;
  history: Pick<Header, 'name' | 'revision' | 'status'>[];
};
export type Category = {
  name: string;
  category_title: string;
  company: string;
  parent_category?: string;
  enabled: number;
  modified: string;
  children?: Category[];
};
export type Option = { value: string; label: string };
export type Options = {
  companies: Option[];
  departments: Option[];
  categories: Category[];
  placeholders: Record<string, string>;
  can_manage_categories: boolean;
  writer_ready: boolean;
};
export type Preview = { body: string; html?: string; revision: number };
export type WriterSession = { url: string; modified: string };

async function command<T>(method: string, data: object) {
  return (
    await request<{ message: T }>(`/api/method/rehab.${api}.${method}`, {
      method: 'POST',
      data,
      skipErrorHandler: true,
    })
  ).message;
}
export const options = () => get<Options>(api, 'options');
export const directory = (params: Record<string, unknown>) =>
  get<{ rows: Header[]; total: number }>(api, 'directory', params);
export const detail = (name: string) => get<Detail>(api, 'detail', { name });
export const preview = (name: string) => get<Preview>(api, 'preview', { name });
export const save = (data: object) => command<Detail>('save', data);
export const transition = (data: object) => command<Detail>('transition', data);
export const saveCategory = (data: object) =>
  command<Pick<Category, 'name' | 'modified'>>('save_category', data);
export const launch = (name: string, expected: string) =>
  post<WriterSession>('medical_template_writer', 'open_editor', {
    name,
    expected,
  });
export const sync = (name: string, expected: string, html: string) =>
  post<Detail>('medical_template_writer', 'save_body', {
    name,
    expected,
    html,
  });
