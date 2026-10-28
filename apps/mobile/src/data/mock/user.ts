import type { Technician } from '@/domain/entities';

export const mockTechnician: Technician = {
  id: 'tec-001',
  name: 'Carlos Campos',
  email: 'carlos@lumini.com',
  role: 'tecnico',
  companyId: 'emp-001',
  companyName: 'Solar Vale Energia',
  phone: '(12) 99777-1234',
  photoUri: null,
};
