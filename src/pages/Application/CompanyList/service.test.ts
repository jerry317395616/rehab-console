import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@umijs/max', () => ({ request: mockRequest }));

import {
  companyValues,
  createCompany,
  getCompanies,
  getCompany,
  saveCompany,
  searchCompanyOptions,
} from './service';

describe('native company transport', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({ message: {} });
  });
  it('sends literal search, a zero group filter and server pagination', async () => {
    await getCompanies(
      { keyword: ' QA Company ', is_group: 0, current: 2, pageSize: 10 },
      { name: 'ascend' },
    );
    expect(mockRequest.mock.calls[0][1].params).toEqual({
      keyword: 'QA Company',
      is_group: 0,
      current: 2,
      page_size: 10,
      sort_field: 'name',
      sort_order: 'ascend',
    });
  });
  it('loads the exact company identifier rather than a display name', async () => {
    await getCompany('Company & Partner');
    expect(mockRequest.mock.calls[0][1].params).toEqual({
      company: 'Company & Partner',
    });
  });
  it('projects writable fields and preserves an explicit clear and false flag', () => {
    expect(
      companyValues(
        {
          company_name: 'No rename',
          tax_id: '  A123  ',
          phone_no: '',
          is_group: false,
        },
        ['tax_id', 'phone_no', 'is_group'],
      ),
    ).toEqual({ tax_id: 'A123', phone_no: null, is_group: 0 });
    expect(companyValues({ tax_id: 'X' }, ['tax_id', 'country'])).toEqual({
      tax_id: 'X',
    });
  });
  it('saves with the original record version and no permission bypasses', async () => {
    await saveCompany('Company A', 'version-1', { phone_no: '123' });
    expect(mockRequest.mock.calls[0][1]).toEqual({
      method: 'POST',
      data: {
        data: {
          company: 'Company A',
          modified: 'version-1',
          values: { phone_no: '123' },
        },
      },
      skipErrorHandler: true,
    });
  });
  it('creates using the native adapter and requests scoped link choices', async () => {
    await createCompany({ company_name: 'QA', abbr: 'QA' });
    await searchCompanyOptions('parent_company', 'Group', 'Company A');
    expect(mockRequest.mock.calls[0][0]).toBe(
      '/api/method/ione_core.console_companies.create_company',
    );
    expect(mockRequest.mock.calls[1][1].params).toEqual({
      field: 'parent_company',
      keyword: 'Group',
      company: 'Company A',
    });
  });
  it('keeps native permission and conflict errors for the edit form', async () => {
    mockRequest.mockRejectedValue(new Error('conflict'));
    await expect(saveCompany('QA', 'old', { phone_no: '1' })).rejects.toThrow(
      'conflict',
    );
  });
});
