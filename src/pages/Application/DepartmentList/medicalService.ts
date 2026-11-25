import { get } from '../ChargeCatalog/service';

export type MedicalChoice = {
  value: string;
  label: string;
  disabled?: boolean;
};
export const medicalOptions = (company = '', keyword = '', current = '') =>
  get<MedicalChoice[]>('department_mapping', 'medical_options', {
    company,
    keyword,
    current,
  });
