import { request } from '@umijs/max';

export type Status = 'Active' | 'Inactive' | 'Suspended' | 'Left';
export type Employee = {
  name: string;
  modified: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  employee_name?: string;
  employee_number?: string;
  company?: string;
  department?: string;
  designation?: string;
  reports_to?: string;
  gender?: string;
  date_of_birth?: string;
  date_of_joining?: string;
  relieving_date?: string;
  status?: Status;
};
type Rights = {
  can_create: boolean;
  can_edit: boolean;
  can_status: boolean;
  read_fields: string[];
  write_fields: string[];
};
type Links = {
  account?: { name: string; enabled: number; modified: string };
  practitioners?: {
    name: string;
    practitioner_name?: string;
    status?: string;
  }[];
  counts?: Record<string, number>;
};
export type Listing = Rights & {
  data: Employee[];
  total: number;
  success: boolean;
};
export type Detail = Rights & Links & { doc: Employee };
export type Impact = Links & {
  name: string;
  modified: string;
  status: Status;
  has_account: boolean;
  can_status: boolean;
  has_active_reports: boolean;
};

export async function get<T>(method: string, params?: Record<string, unknown>) {
  return (
    await request<{ message: T }>(
      `/api/method/ione_core.console_employees.${method}`,
      { method: 'GET', params, skipErrorHandler: true },
    )
  ).message;
}
export async function post(method: string, data: unknown) {
  return (
    await request<{ message: { name: string } }>(
      `/api/method/ione_core.console_employees.${method}`,
      { method: 'POST', data: { data }, skipErrorHandler: true },
    )
  ).message;
}
export const choices = (
  field: string,
  keyword = '',
  company = '',
  current = '',
) =>
  get<{ value: string; label: string }[]>('options', {
    field,
    keyword,
    company,
    current,
  });
