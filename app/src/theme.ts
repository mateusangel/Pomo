export const colors = {
  ink: '#0B0B0F',
  ink2: '#1C1C22',
  mute: '#6B6B76',
  line: '#E2E4DD',
  paper: '#F4F5F1',
  card: '#FFFFFF',
  leaf: '#4ADE80',
  leafDeep: '#0F5A2E',
  leafSoft: '#DDF7E6',
  danger: '#D92D3A',
  dangerSoft: '#FDE8EA',
  amberSoft: '#FFF3CF',
  amberDeep: '#7A5200',
};

export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayMid: 'BricolageGrotesque_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

export const radius = { sm: 10, md: 16, lg: 24, xl: 32 };

export type Band = 'excelente' | 'bom' | 'regular' | 'ruim';

export const bandStyle: Record<Band, { bg: string; label: string }> = {
  excelente: { bg: '#4ADE80', label: 'Excelente' },
  bom: { bg: '#BEF264', label: 'Bom' },
  regular: { bg: '#FCD34D', label: 'Regular' },
  ruim: { bg: '#FB7185', label: 'Ruim' },
};

export function bandOf(score: number): Band {
  if (score >= 80) return 'excelente';
  if (score >= 60) return 'bom';
  if (score >= 40) return 'regular';
  return 'ruim';
}
