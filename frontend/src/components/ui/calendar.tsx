'use client';
import { DayPicker } from 'react-day-picker';
import { vi } from 'date-fns/locale';
import 'react-day-picker/style.css';
export function Calendar(props: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={vi}
      showOutsideDays
      className="stayhub-calendar"
      labels={{
        labelNext: () => 'Tháng sau',
        labelPrevious: () => 'Tháng trước',
      }}
      {...props}
    />
  );
}
