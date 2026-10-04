import { addDays, parseISO } from 'date-fns';

export function earliestCheckInDate(checkInTime: string, now = new Date()) {
  const today = new Date(now.getTime() + 7 * 3600000)
    .toISOString()
    .slice(0, 10);
  const cutoff = new Date(`${today}T${checkInTime}:00+07:00`);
  const date = parseISO(today);
  return now.getTime() > cutoff.getTime() ? addDays(date, 1) : date;
}
