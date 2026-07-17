/** Tailwind text color for a 0–100 trust score. */
export const trustScoreColor = (score: number) =>
  score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
