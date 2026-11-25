export const chargeStates = {
  Pending: { text: '待收费核对', status: 'Processing' },
  Blocked: { text: '待补齐条件', status: 'Warning' },
  Draft: { text: '收费草稿', status: 'Default' },
  Invoiced: { text: '已提交', status: 'Success' },
  Conflict: { text: '收费记录待核对', status: 'Error' },
  NotEnabled: { text: '项目未开启执行计费', status: 'Default' },
} as const;

export const settlementStates = {
  Draft: { text: '待审核', status: 'Default' },
  Unpaid: { text: '待收款', status: 'Processing' },
  PartlyPaid: { text: '部分收款', status: 'Warning' },
  Settled: { text: '已结清', status: 'Success' },
  RefundDue: { text: '待退款', status: 'Warning' },
  OffsetDue: { text: '待核销', status: 'Warning' },
} as const;

export type ChargeProgress = {
  state: keyof typeof chargeStates;
  has_return?: boolean;
};

export function chargeProgressText(progress: ChargeProgress) {
  const label = chargeStates[progress.state].text;
  return progress.has_return ? `${label} · 有退费记录` : label;
}

export type ExecutionChargeRow = ChargeProgress & {
  name: string;
  patient_name: string;
  therapy_type: string;
  practitioner_name?: string;
  company: string;
  rehab_order: string;
  rehab_treatment_task: string;
  start_date: string;
  start_time?: string;
  duration?: number;
  reason?: string;
  invoice?: string;
  settled?: boolean;
  settlement?: keyof typeof settlementStates;
  can_review: boolean;
};
