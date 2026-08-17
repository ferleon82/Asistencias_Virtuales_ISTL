import { useEffect, useMemo, useRef, useState } from 'react';

interface SpanishDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function toDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)
    ? new Date(year, month - 1, day)
    : new Date();
}

function formatValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayInEcuador(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;

  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** A date picker rendered by the app, so its language does not depend on the browser UI. */
export function SpanishDatePicker({ value, onChange, isOpen: controlledIsOpen, onOpenChange }: SpanishDatePickerProps) {
  const selectedDate = toDate(value);
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;
  const pickerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const setIsOpen = (nextIsOpen: boolean) => {
    setUncontrolledIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  };
  const days = useMemo(() => {
    const firstWeekday = (visibleMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    return Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);
  }, [visibleMonth]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  const openPicker = () => {
    setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setIsOpen(true);
  };

  return (
    <div ref={pickerRef} className="relative mt-1">
      <button
        type="button"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="input-control mt-0 flex items-center justify-between rounded-md border border-slate-300 bg-white text-left text-slate-700 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
      >
        {selectedDate.toLocaleDateString('es-EC')}
        <span aria-hidden="true" className="ml-3 text-base">▣</span>
      </button>
      {isOpen && (
        <div role="dialog" aria-label="Seleccionar fecha" className="absolute z-30 mt-1 w-72 rounded-md border border-slate-300 bg-white p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="rounded px-2 py-1 hover:bg-slate-100" aria-label="Mes anterior">‹</button>
            <span className="font-semibold capitalize text-slate-800">{MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</span>
            <button type="button" onClick={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="rounded px-2 py-1 hover:bg-slate-100" aria-label="Mes siguiente">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="py-1 font-semibold text-slate-500">{day}</span>)}
            {days.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
              const isSelected = formatValue(date) === value;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => { onChange(formatValue(date)); setIsOpen(false); }}
                  className={`rounded py-1.5 transition-colors ${isSelected ? 'bg-brand-navy font-semibold text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                  aria-label={date.toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => { onChange(todayInEcuador()); setIsOpen(false); }} className="mt-3 text-xs font-semibold text-brand-navy hover:underline">Hoy</button>
        </div>
      )}
    </div>
  );
}
