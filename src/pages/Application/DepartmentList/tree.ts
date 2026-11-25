import type { DepartmentNode } from './service';

export type DepartmentTreeNode = {
  key: string;
  title: string;
  children: DepartmentTreeNode[];
  department?: string;
  company?: string;
};
export function departmentTree(rows: DepartmentNode[]): DepartmentTreeNode[] {
  const nodes = new Map(
    rows.map((row) => [
      row.name,
      {
        key: `d:${row.name}`,
        title: `${row.department_name || row.name}${row.disabled ? '（已停用）' : ''}`,
        department: row.name,
        company: row.company || undefined,
        children: [] as DepartmentTreeNode[],
      },
    ]),
  );
  const groups = new Map<string, DepartmentTreeNode>();
  for (const row of rows) {
    const node = nodes.get(row.name);
    if (!node) continue;
    const parent = row.parent_department
      ? nodes.get(row.parent_department)
      : undefined;
    if (parent && parent !== node && parent.company === node.company)
      parent.children.push(node);
    else {
      const company = row.company || '';
      let group = groups.get(company);
      if (!group) {
        group = {
          key: `c:${company}`,
          title: company || '公共部门',
          company: company || undefined,
          children: [],
        };
        groups.set(company, group);
      }
      group.children.push(node);
    }
  }
  return [...groups.values()];
}
