window.WorldCupDateTime = (() => {
  const sourceTimeZone = "Europe/Istanbul";
  const sourceOffsetHours = 3;
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || sourceTimeZone;
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

  function parse(dateText, timeText = "00:00") {
    const [day, monthName, shortYear] = String(dateText || "").split("-");
    const [hour = 0, minute = 0] = String(timeText || "").split(":").map(Number);
    const month = months[monthName];
    if (!day || month === undefined || !shortYear) return null;

    const timestamp = Date.UTC(
      2000 + Number(shortYear),
      month,
      Number(day),
      hour - sourceOffsetHours,
      minute
    );
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatInZone(date, timeZone, options = {}) {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      ...options
    }).format(date);
  }

  function formatMatch(match) {
    const date = parse(match.match_date, match.match_time);
    if (!date) return "";
    const local = formatInZone(date, userTimeZone);
    if (userTimeZone === sourceTimeZone) return `${local} (Türkiye saati)`;
    return `${local} (yerel) • ${formatInZone(date, sourceTimeZone)} (Türkiye)`;
  }

  function dateKey(date, timeZone = userTimeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function dayDifference(date) {
    const todayKey = dateKey(new Date());
    const targetKey = dateKey(date);
    const today = new Date(`${todayKey}T00:00:00Z`);
    const target = new Date(`${targetKey}T00:00:00Z`);
    return Math.round((target - today) / 86400000);
  }

  function toIcsUtc(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  }

  return {
    sourceTimeZone,
    userTimeZone,
    parse,
    formatMatch,
    dayDifference,
    toIcsUtc
  };
})();
