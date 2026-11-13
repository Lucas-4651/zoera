/**
 * « Appels » du modèle.
 *
 * La page /predictions ne publie pas des probabilités en vrac : elle publie
 * des paris tenables, à la manière de la page prédictions de BSD (« we only
 * call it when we're sure »). Un appel est dérivé d'un marché dont la
 * probabilité atteint le seuil : double chance (1X / X2), lignes de buts
 * (plus de 1,5 / 2,5 / 3,5) et « les deux équipes marquent ».
 *
 * Rien n'est inventé : chaque appel est une somme ou une valeur déjà
 * fournie par le modèle (prob_home + prob_draw, prob_over_15, …).
 */
import type { Prediction } from './bsd/types';

/** En dessous de 80 %, on ne publie pas. C'est la règle affichée sur la page. */
export const PREDICTION_THRESHOLD = 0.8;

export type CallKey = '1X' | 'X2' | 'O15' | 'O25' | 'O35' | 'BTTS';

export interface PredictionCall {
  key: CallKey;
  /** Libellé prêt à afficher, en français. */
  label: string;
  /** Probabilité 0–1 du marché concerné. */
  probability: number;
}

function sum(...values: Array<number | null>): number | null {
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) return null;
    total += v;
  }
  return total;
}

/** Les appels d'un match, du plus fort au plus faible. */
export function buildCalls(p: Prediction, threshold: number = PREDICTION_THRESHOLD): PredictionCall[] {
  const calls: PredictionCall[] = [];
  const home = p.homeTeam || 'Équipe à domicile';
  const away = p.awayTeam || 'Équipe à l’extérieur';

  const doubleChanceHome = sum(p.homeProb, p.drawProb);
  const doubleChanceAway = sum(p.awayProb, p.drawProb);
  if (doubleChanceHome !== null) {
    calls.push({ key: '1X', label: `${home} gagne ou fait match nul`, probability: doubleChanceHome });
  }
  if (doubleChanceAway !== null) {
    calls.push({ key: 'X2', label: `${away} gagne ou fait match nul`, probability: doubleChanceAway });
  }
  if (p.over15 !== null) {
    calls.push({ key: 'O15', label: 'Plus de 1,5 but', probability: p.over15 });
  }
  if (p.over25 !== null) {
    calls.push({ key: 'O25', label: 'Plus de 2,5 buts', probability: p.over25 });
  }
  if (p.over35 !== null) {
    calls.push({ key: 'O35', label: 'Plus de 3,5 buts', probability: p.over35 });
  }
  if (p.btts !== null) {
    calls.push({ key: 'BTTS', label: 'Les deux équipes marquent', probability: p.btts });
  }

  return calls
    .filter((c) => Number.isFinite(c.probability) && c.probability >= threshold)
    .sort((a, b) => b.probability - a.probability);
}

/** Libellé court pour la ligne secondaire (« Aussi : Plus de 2,5 buts 84 % »). */
export function callShortLabel(call: PredictionCall): string {
  switch (call.key) {
    case 'O15':
      return '+1,5 but';
    case 'O25':
      return '+2,5 buts';
    case 'O35':
      return '+3,5 buts';
    case 'BTTS':
      return 'Les 2 marquent';
    default:
      return 'double chance';
  }
}
