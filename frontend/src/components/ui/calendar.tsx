'use client';
import { DayPicker } from 'react-day-picker';
import { vi } from 'date-fns/locale';
import type { CSSProperties } from 'react';
import 'react-day-picker/style.css';
export function Calendar(props: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={vi}
      showOutsideDays
      className="stayhub-calendar"
      style={
        {
          '--rdp-accent-color': 'var(--ring)',
          '--rdp-accent-background-color': 'var(--accent)',
          '--rdp-range_middle-background-color': 'var(--accent)',
          '--rdp-range_start-background': 'var(--primary)',
          '--rdp-range_end-background': 'var(--primary)',
        } as CSSProperties
      }
      labels={{
        labelNext: () => 'Tháng sau',
        labelPrevious: () => 'Tháng trước',
      }}
      {...props}
    />
  );
}
