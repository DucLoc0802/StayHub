export function calendarAvailability(units: number | undefined) {
  if (units === undefined)
    return { tone: 'unknown', label: 'Đang kiểm tra phòng' };
  if (units === 0) return { tone: 'sold-out', label: 'Hết phòng' };
  if (units >= 5) return { tone: 'green', label: 'Còn nhiều phòng' };
  if (units >= 3) return { tone: 'yellow', label: 'Còn 3 đến 4 phòng' };
  return { tone: 'red', label: 'Chỉ còn 1 đến 2 phòng' };
}
