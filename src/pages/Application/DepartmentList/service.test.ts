import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  departmentValues,
  getDepartments,
  previewDepartment,
  renameDepartment,
  saveDepartment,
  searchDepartmentParents,
} from './service';
import { departmentTree } from './tree';

describe('native department scope and transport', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ message: {} });
  });
  it('retains zero filters, scoped tree selection and native pagination', async () => {
    await getDepartments({
      company: 'A',
      department: 'Group - A',
      disabled: 0,
      is_group: 0,
      keyword: ' QA ',
      pageSize: 10,
      current: 2,
    });
    expect(mockRequest.mock.calls[0][1].params).toEqual({
      company: 'A',
      department: 'Group - A',
      disabled: 0,
      is_group: 0,
      keyword: 'QA',
      page_size: 10,
      current: 2,
      sort_field: 'modified',
      sort_order: 'descend',
    });
  });
  it('projects writable fields while preserving explicit clears and false switches', () => {
    expect(
      departmentValues(
        {
          department_name: 'Do not rename',
          company: 'Do not move',
          parent_department: '',
          disabled: false,
          is_group: true,
        },
        ['parent_department', 'disabled', 'is_group'],
      ),
    ).toEqual({ parent_department: null, disabled: 0, is_group: 1 });
    expect(
      departmentValues({ disabled: false }, ['parent_department', 'disabled']),
    ).toEqual({ disabled: 0 });
  });
  it('binds confirmed changes to the original version and preview token', async () => {
    await previewDepartment('A - B', 'v1', { disabled: 1 });
    await saveDepartment('A - B', 'v1', { disabled: 1 }, 'token');
    expect(mockRequest.mock.calls[1][1].data.data).toEqual({
      department: 'A - B',
      modified: 'v1',
      values: { disabled: 1 },
      token: 'token',
    });
  });
  it('uses full native identifiers for rename confirmation and excludes the current subtree from parent choices', async () => {
    await renameDepartment('Old - A', 'v2', 'New', 'Old - A');
    await searchDepartmentParents('A', 'Group', 'Old - A');
    expect(mockRequest.mock.calls[0][1].data.data.confirm_name).toBe('Old - A');
    expect(mockRequest.mock.calls[1][1].params).toEqual({
      company: 'A',
      keyword: 'Group',
      department: 'Old - A',
    });
  });
  it('preserves visible hierarchy without reconstructing inaccessible ancestors', () => {
    const tree = departmentTree([
      {
        name: 'Visible',
        department_name: '可见部门',
        company: 'A',
        parent_department: 'Secret',
      },
      { name: 'Child', company: 'A', parent_department: 'Visible' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].department).toBe('Visible');
    expect(tree[0].children[0].children[0].department).toBe('Child');
    expect(JSON.stringify(tree)).not.toContain('Secret');
  });
  it('keeps public roots and different companies separate', () => {
    const tree = departmentTree([
      { name: 'Root', company: null },
      { name: 'A', company: 'Company A', parent_department: 'Root' },
      { name: 'B', company: 'Company B', parent_department: 'A', disabled: 1 },
    ]);
    expect(tree).toHaveLength(3);
    expect(tree[2].children[0].title).toContain('已停用');
    expect(tree[1].children[0].children).toHaveLength(0);
  });
});
