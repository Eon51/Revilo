export function getCurrentStreak(completedDates: string[], today: string): number {
  const parsedToday = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(parsedToday.getTime()) || parsedToday.toISOString().slice(0, 10) !== today) return 0;

  const completed = new Set(completedDates.filter((date) => {
    const parsedDate = new Date(`${date}T00:00:00Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
  }));
  const cursor = parsedToday;
  if (!completed.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);

  let streak = 0;
  while (completed.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
