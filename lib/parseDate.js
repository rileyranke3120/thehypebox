const MONTH_MAP = {
  january: 1,  jan: 1,
  february: 2, feb: 2,
  march: 3,    mar: 3,
  april: 4,    apr: 4,
  may: 5,
  june: 6,     jun: 6,
  july: 7,     jul: 7,
  august: 8,   aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const DAY_MAP = {
  sunday: 0,    sun: 0,
  monday: 1,    mon: 1,
  tuesday: 2,   tue: 2,  tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4,  thu: 4,  thur: 4, thurs: 4,
  friday: 5,    fri: 5,
  saturday: 6,  sat: 6,
};

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a caller-provided date string into YYYY-MM-DD.
 *
 * Accepts:
 *   - YYYY-MM-DD
 *   - MM/DD/YYYY
 *   - MM/DD/YY
 *   - "April 24" / "April 24th" / "April 24, 2025"
 *   - "today", "tomorrow"
 *   - "this Saturday", "this Monday", etc.
 *   - "next Saturday", "next Monday", etc.
 *   - bare day names: "Saturday", "Monday", etc.
 *
 * Returns YYYY-MM-DD string, or null if unparseable.
 */
export function parseDate(input) {
  if (!input) return null;
  const s = String(input).trim();

  // YYYY-MM-DD — pass through
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // MM/DD/YYYY
  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) {
    const [, m, d, y] = mdy4;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YY
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const [, m, d, y] = mdy2;
    const year = parseInt(y) >= 50 ? `19${y}` : `20${y}`;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "April 24" / "April 24th" / "April 24, 2025"
  const named = s.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?$/i);
  if (named) {
    const [, monthStr, dayStr, yearStr] = named;
    const month = MONTH_MAP[monthStr.toLowerCase()];
    if (month) {
      const day = parseInt(dayStr, 10);
      const now = new Date();
      const currentYear = now.getFullYear();
      let year = yearStr ? parseInt(yearStr, 10) : currentYear;
      if (!yearStr) {
        const today = new Date(currentYear, now.getMonth(), now.getDate());
        const candidate = new Date(currentYear, month - 1, day);
        if (candidate < today) year = currentYear + 1;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const lower = s.toLowerCase().replace(/\s+/g, ' ').trim();

  // "today"
  if (lower === 'today') {
    return ymd(new Date());
  }

  // "tomorrow"
  if (lower === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return ymd(d);
  }

  // "this Saturday", "this Monday", etc.
  const thisDay = lower.match(/^this\s+(\w+)$/);
  if (thisDay) {
    const target = DAY_MAP[thisDay[1]];
    if (target !== undefined) {
      const now = new Date();
      const todayDow = now.getDay();
      let ahead = target - todayDow;
      if (ahead < 0) ahead += 7; // already passed this week — go to next occurrence
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
      return ymd(d);
    }
  }

  // "next Saturday", "next Monday", etc.
  const nextDay = lower.match(/^next\s+(\w+)$/);
  if (nextDay) {
    const target = DAY_MAP[nextDay[1]];
    if (target !== undefined) {
      const now = new Date();
      const todayDow = now.getDay();
      let ahead = target - todayDow;
      if (ahead <= 0) ahead += 7; // get to the next occurrence first
      ahead += 7;                 // then add a full week for "next"
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
      return ymd(d);
    }
  }

  // Bare day name: "Saturday", "Monday", etc. — treated as "this [day]"
  const bareDay = DAY_MAP[lower];
  if (bareDay !== undefined) {
    const now = new Date();
    const todayDow = now.getDay();
    let ahead = bareDay - todayDow;
    if (ahead < 0) ahead += 7;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    return ymd(d);
  }

  return null;
}

/**
 * Parse a caller-provided time string into HH:MM (24-hour).
 *
 * Accepts:
 *   - "2pm", "10am"
 *   - "2:30pm", "10:30 AM"
 *   - "14:00", "09:30"
 *
 * Returns HH:MM string, or null if unparseable.
 */
export function parseTime(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().replace(/\s+/g, '');

  // Already HH:MM (24-hour)
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  // "2pm", "2:30pm", "10am", "10:30am"
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?([ap]m)$/);
  if (ampm) {
    const [, h, m, period] = ampm;
    let hours = parseInt(h, 10);
    const mins = (m || '00').padStart(2, '0');
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${mins}`;
  }

  // H:MM without am/pm — treat as 24-hour
  const bare = s.match(/^(\d{1,2}):(\d{2})$/);
  if (bare) {
    const [, h, m] = bare;
    return `${h.padStart(2, '0')}:${m}`;
  }

  return null;
}
