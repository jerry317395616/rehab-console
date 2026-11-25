import { get, post } from '../ChargeCatalog/service';

const api = 'scale_bank';

export const labels = {
  Native: '原生量表',
  Draft: '草稿',
  'Pending Review': '待审核',
  Rejected: '已退回',
  Published: '已发布',
  Withdrawn: '已停用',
  Superseded: '已被替代',
};
export type Status = keyof typeof labels;
export const colors: Partial<Record<Status, string>> = {
  'Pending Review': 'gold',
  Published: 'green',
  Rejected: 'orange',
};

export type Item = {
  parameter: string;
  description: string;
  kind: 'Choices' | 'Range';
  minimum: number | null;
  maximum: number | null;
  options: { score: number | null; label: string }[];
};

export type Values = {
  title: string;
  description: string;
  source_reference: string;
  reviewer: string;
  items: Item[];
  rules?: RuleDefinition;
};

export type Context = {
  care: string;
  stage: string;
  age?: number | null;
  sex?: string;
};
export type Cohort = {
  care?: string[];
  stages?: string[];
  sexes?: string[];
  age_min?: number;
  age_max?: number;
};
type Numeric = string | number;
type Condition = { item?: string; operator?: string; score?: Numeric };
type Interval = {
  min?: Numeric;
  max?: Numeric;
  include_min?: boolean;
  include_max?: boolean;
};
export type RuleDefinition = {
  rounding?: string;
  precision?: number;
  missing?: string;
  minimum_answered?: number;
  total_mode?: string;
  direction?: string;
  applicability?: { label?: string; when?: Cohort }[];
  questions?: {
    item?: string;
    reverse?: boolean;
    weight?: Numeric;
    required?: boolean;
    show_if?: Condition | null;
    require_if?: Condition | null;
  }[];
  dimensions?: {
    id?: string;
    label?: string;
    items?: string[];
    weight?: Numeric;
  }[];
  bands?: (Interval & {
    metric?: string;
    label?: string;
    interpretation?: string;
  })[];
  norms?: {
    id?: string;
    label?: string;
    version?: string;
    reference?: string;
    when?: Cohort;
    rows?: (Interval & { value?: Numeric })[];
  }[];
  comparisons?: {
    version?: number;
    factor?: Numeric;
    offset?: Numeric;
    reference?: string;
  }[];
  cases?: {
    label?: string;
    context?: Context;
    answers?: Record<string, number>;
    expected_state?: string;
    expected_total?: number;
    expected_grade?: string;
  }[];
};

export type ScoreDetails = {
  total: number;
  exact_total: string;
  applicability?: string;
  ready: boolean;
  dimensions: { id: string; label: string; score: string }[];
  norm?: { label?: string; version?: string; value?: string; status: string };
  grades: Record<string, { label: string; interpretation: string } | null>;
  trace: {
    idx: number;
    item: string;
    state: 'Answered' | 'Unanswered' | 'Skipped';
    raw?: number;
    transformed?: number;
    weighted?: string;
    required: boolean;
  }[];
};

export type Header = {
  name: string;
  template?: string;
  title: string;
  modified: string;
  version: number;
  status: Status;
  created_by: string;
  reviewer?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_note?: string;
  mine?: boolean;
};
type Content = Pick<
  Values,
  'title' | 'source_reference' | 'items' | 'rules'
> & {
  base_snapshot?: { description: string };
  description?: string;
};
export type CatalogRow = {
  key: string;
  template: string;
  modified: string;
  title: string;
  status: Status;
  count: number;
  range?: [number, number];
  active?: Header;
  revision?: Header;
  latest?: Header;
};
export type EditorData = {
  template: string;
  stamp: string;
  profile?: Header;
  values: Values;
  reviewers: { name: string; label: string }[];
};
export type Version = {
  profile: Header;
  content: Content;
  baseline?: { profile: Header; content: Content };
  original?: Values;
  source_current: boolean;
  can_review: boolean;
  can_withdraw: boolean;
  versions: Header[];
  events: {
    name: string;
    actor: string;
    action: string;
    reason: string;
    event_time: string;
  }[];
};
export type TrialResult = {
  total: number;
  answered: number;
  count: number;
  range: [number, number];
  details?: ScoreDetails;
  comparison?: {
    version: number;
    total?: number;
    details?: ScoreDetails;
    error?: string;
  };
};
export type CaseResult = {
  label: string;
  state: string;
  total?: number;
  grade?: string;
  error?: string;
  passes: boolean;
};
export const catalog = (params: Record<string, unknown>) =>
  get<{
    data: CatalogRow[];
    total: number;
    can_author: boolean;
    can_new: boolean;
  }>(api, 'get_catalog', params);
export const editor = (params: {
  template?: string;
  name?: string;
  copy_from?: string;
}) => get<EditorData>(api, 'get_editor', params);
export const version = (name: string) =>
  get<Version>(api, 'get_version', { name });
export const history = (template: string) =>
  get<Header[]>(api, 'get_history', { template });
export const save = (data: Record<string, unknown>) =>
  post<Version>(api, 'save_draft', data);
export const submit = (data: { name: string; modified: string }) =>
  post<Version>(api, 'submit_revision', data);
export const review = (data: Record<string, unknown>) =>
  post<Version>(api, 'review_revision', data);
export const withdraw = (data: {
  name: string;
  modified: string;
  reason: string;
}) => post<Version>(api, 'withdraw', data);
export const preview = (data: Record<string, unknown>) =>
  post<TrialResult>(api, 'preview_scores', data);
export const runCases = (data: Record<string, unknown>) =>
  post<{ cases: CaseResult[] }>(api, 'preview_scores', {
    ...data,
    cases_only: true,
  });

export function itemRange(item: Item): [number, number] | undefined {
  if (item.kind === 'Range') {
    const { minimum, maximum } = item;
    return minimum == null || maximum == null || minimum > maximum
      ? undefined
      : [minimum, maximum];
  }
  const scores = item.options.map(({ score }) => score);
  if (!scores.length || scores.some((score) => score == null)) return;
  return [Math.min(...(scores as number[])), Math.max(...(scores as number[]))];
}

export function totalRange(items: Item[]): [number, number] | undefined {
  if (!items.length) return;
  const total: [number, number] = [0, 0];
  for (const item of items) {
    const bounds = itemRange(item);
    if (!bounds) return;
    total[0] += bounds[0];
    total[1] += bounds[1];
  }
  return total;
}
