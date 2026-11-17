import { useAppStore } from '@/store/AppStore';
import type { PdfExtras } from './template';

/** Empresa e técnico que assinam o PDF (vêm da sessão do técnico). */
export function usePdfExtras(): PdfExtras {
  const { technician } = useAppStore();
  return {
    companyName: technician?.companyName || 'Lumini',
    technicianName: technician?.name ?? '',
    technicianPhone: technician?.phone || undefined,
  };
}
