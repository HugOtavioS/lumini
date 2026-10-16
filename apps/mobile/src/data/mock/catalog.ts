import type { Equipment } from '@/domain/entities';

// Catálogo de exemplo. No app real é baixado no pull do login (RF15) e
// mantido apenas pelo gestor (RF25).
export const catalog: Equipment[] = [
  { id: 'mod-cs-550', category: 'modulo', name: 'Canadian Solar 550W HiKu6', manufacturer: 'Canadian Solar', powerW: 550, areaM2: 2.58, price: 1290, warrantyYears: 12, available: true, suppliers: ['Aldo Solar', 'WEG Distribuição'] },
  { id: 'mod-cs-650', category: 'modulo', name: 'Canadian Solar 650W BiFacial', manufacturer: 'Canadian Solar', powerW: 650, areaM2: 3.1, price: 1680, warrantyYears: 12, available: true, suppliers: ['Aldo Solar'] },
  { id: 'mod-trina-440', category: 'modulo', name: 'Trina Solar Vertex S+ 440W', manufacturer: 'Trina Solar', powerW: 440, areaM2: 1.99, price: 980, warrantyYears: 15, available: true, suppliers: ['Aldo Solar', 'Belenergy'] },
  { id: 'mod-trina-605', category: 'modulo', name: 'Trina Solar Vertex N 605W', manufacturer: 'Trina Solar', powerW: 605, areaM2: 2.7, price: 1450, warrantyYears: 15, available: false, suppliers: ['Belenergy'] },
  { id: 'mod-jinko-580', category: 'modulo', name: 'Jinko Tiger Neo 580W', manufacturer: 'Jinko', powerW: 580, areaM2: 2.58, price: 1390, warrantyYears: 12, available: true, suppliers: ['WEG Distribuição'] },
  { id: 'inv-growatt-5k', category: 'inversor', name: 'Growatt MIN 5000TL-X', manufacturer: 'Growatt', powerW: 5000, phases: 1, price: 4890, warrantyYears: 10, available: true, suppliers: ['Aldo Solar', 'Belenergy'] },
  { id: 'inv-growatt-6k', category: 'inversor', name: 'Growatt MIN 6000TL-X', manufacturer: 'Growatt', powerW: 6000, phases: 1, price: 5690, warrantyYears: 10, available: true, suppliers: ['Aldo Solar'] },
  { id: 'inv-growatt-3k', category: 'inversor', name: 'Growatt MIC 3000TL-X', manufacturer: 'Growatt', powerW: 3000, phases: 1, price: 3290, warrantyYears: 10, available: true, suppliers: ['Aldo Solar'] },
  { id: 'inv-huawei-8k', category: 'inversor', name: 'Huawei SUN2000-8KTL-M1', manufacturer: 'Huawei', powerW: 8000, phases: 3, price: 8900, warrantyYears: 10, available: true, suppliers: ['WEG Distribuição'] },
  { id: 'inv-huawei-4k', category: 'inversor', name: 'Huawei SUN2000-4KTL-L1', manufacturer: 'Huawei', powerW: 4000, phases: 1, price: 4450, warrantyYears: 10, available: true, suppliers: ['WEG Distribuição'] },
  { id: 'est-ceramica', category: 'estrutura', name: 'Suporte para telha cerâmica', manufacturer: 'Romagnole', price: 180, warrantyYears: 12, available: true, suppliers: ['Aldo Solar'] },
  { id: 'est-fibrocimento', category: 'estrutura', name: 'Suporte para fibrocimento', manufacturer: 'Romagnole', price: 150, warrantyYears: 12, available: true, suppliers: ['Aldo Solar'] },
  { id: 'est-laje', category: 'estrutura', name: 'Estrutura triangular para laje', manufacturer: 'Romagnole', price: 260, warrantyYears: 12, available: true, suppliers: ['Belenergy'] },
  { id: 'est-metalico', category: 'estrutura', name: 'Perfil para telhado metálico', manufacturer: 'Romagnole', price: 140, warrantyYears: 12, available: true, suppliers: ['Belenergy'] },
  { id: 'sb-clamper', category: 'string_box', name: 'String Box Clamper 2E/2S 1000V', manufacturer: 'Clamper', price: 690, warrantyYears: 5, available: true, suppliers: ['Aldo Solar'] },
  { id: 'cabo-6mm', category: 'cabos', name: 'Cabo solar 6 mm² (rolo 100 m)', manufacturer: 'Prysmian', price: 780, warrantyYears: 25, available: true, suppliers: ['WEG Distribuição'] },
  { id: 'con-mc4', category: 'conectores', name: 'Conector MC4 (par)', manufacturer: 'Stäubli', price: 25, warrantyYears: 5, available: true, suppliers: ['Aldo Solar'] },
];

export function findEquipment(id: string): Equipment | undefined {
  return catalog.find((equipment) => equipment.id === id);
}

export const catalogUpdatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
