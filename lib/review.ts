export type ReviewState = {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string;
};

export function scheduleCard(
  state: ReviewState,
  quality: number,
  reviewedAt: Date = new Date()
): ReviewState {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError('La note doit être comprise entre 0 et 5.');
  }

  let easeFactor = state.easeFactor;
  let interval = state.interval;
  let repetitions = state.repetitions;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else if (repetitions === 0) {
    repetitions = 1;
    interval = 1;
  } else if (repetitions === 1) {
    repetitions = 2;
    interval = 6;
  } else {
    repetitions += 1;
    interval = Math.max(1, Math.round(interval * easeFactor));
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  const nextReviewAt = new Date(reviewedAt);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt: nextReviewAt.toISOString().slice(0, 10),
  };
}
