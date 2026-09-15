export type TechnicalCalendarDay = {
  isoDate: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

function parseMonthKey(monthKey: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) throw new Error("Mês inválido.");

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) throw new Error("Mês inválido.");

  return { year, monthIndex };
}

function isoDateFromUtc(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarMonths(monthKey: string, amount: number) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, monthIndex + amount, 1));
  return isoDateFromUtc(date).slice(0, 7);
}

export function formatCalendarMonth(monthKey: string) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex, 1)));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function buildCalendarMonth(monthKey: string, todayIso: string): TechnicalCalendarDay[] {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const isoDate = isoDateFromUtc(date);

    return {
      isoDate,
      dayOfMonth: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === monthIndex,
      isToday: isoDate === todayIso,
    };
  });
}

export function getInitialCalendarMonth(scheduledDates: string[], todayIso: string) {
  const validDates = scheduledDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const currentMonth = todayIso.slice(0, 7);

  if (validDates.some((date) => date.startsWith(currentMonth))) return currentMonth;

  const nextVisit = validDates.find((date) => date >= todayIso);
  return (nextVisit ?? validDates.at(-1) ?? todayIso).slice(0, 7);
}

export function getInitialCalendarDate(scheduledDates: string[], monthKey: string, todayIso: string) {
  const datesInMonth = scheduledDates
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date.startsWith(monthKey))
    .sort();

  if (datesInMonth.includes(todayIso)) return todayIso;
  return datesInMonth.find((date) => date >= todayIso) ?? datesInMonth.at(-1) ?? `${monthKey}-01`;
}
