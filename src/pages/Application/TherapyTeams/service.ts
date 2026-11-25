import { get, post } from '../ChargeCatalog/service';

export { errorMessage } from '../ChargeCatalog/feedback';
export type Choice = { value: string; label: string; formal?: boolean };
export type Member = {
  name?: string;
  therapist: string;
  person?: string;
  member_role: 'Member' | 'Coordinator' | 'Mentor';
  mentor?: string;
  mentor_label?: string;
  valid_from: string;
  valid_to?: string;
  ended?: boolean;
};
export type Team = {
  name?: string;
  modified?: string;
  team_name: string;
  company: string;
  department: string;
  team_lead?: string;
  leader?: string;
  enabled: number;
  notes?: string;
  members: Member[];
  formal_users?: string[];
  member_count?: number;
  can_edit?: boolean;
  hidden_links?: boolean;
};
export type Options = {
  companies: Choice[];
  departments: Choice[];
  can_create: boolean;
  can_write: boolean;
};
export const roles = {
  Member: '组员',
  Coordinator: '协调员',
  Mentor: '带教老师',
};
export const api = <T>(method: string, params?: Record<string, unknown>) =>
  get<T>('team_console', method, params);
export const saveTeam = (data: unknown) =>
  post('team_console', 'save_team', data);
