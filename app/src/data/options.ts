import type { AllergenId, RestrictionId } from '../api/types';

export const ALLERGENS: { id: AllergenId; label: string }[] = [
  { id: 'leite', label: 'Leite' },
  { id: 'lactose', label: 'Lactose' },
  { id: 'ovo', label: 'Ovo' },
  { id: 'trigo', label: 'Trigo' },
  { id: 'gluten', label: 'Glúten' },
  { id: 'soja', label: 'Soja' },
  { id: 'amendoim', label: 'Amendoim' },
  { id: 'castanhas', label: 'Castanhas' },
  { id: 'peixe', label: 'Peixe' },
  { id: 'crustaceos', label: 'Crustáceos' },
];

export const RESTRICTIONS: { id: RestrictionId | 'nenhuma'; label: string; hint: string }[] = [
  { id: 'nenhuma', label: 'Como de tudo', hint: 'Sem restrição alimentar' },
  { id: 'vegetariano', label: 'Vegetariano', hint: 'Sem carnes' },
  { id: 'vegano', label: 'Vegano', hint: 'Sem nenhum produto de origem animal' },
];

export const GOALS = ['Comer melhor', 'Perder peso', 'Ganhar massa', 'Controlar açúcar', 'Reduzir sódio', 'Cuidar da família'];

export const allergenLabel = (id: AllergenId) => ALLERGENS.find((a) => a.id === id)?.label ?? id;
