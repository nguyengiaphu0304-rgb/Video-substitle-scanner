const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export function clampMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

export function formatEditableTimecode(value: number): string {
  const totalMs = clampMs(value);
  const hours = Math.floor(
    totalMs / (MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR),
  );
  const minutes = Math.floor(
    (totalMs / (MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE)) % MINUTES_PER_HOUR,
  );
  const seconds = Math.floor((totalMs / MILLISECONDS_PER_SECOND) % SECONDS_PER_MINUTE);
  const milliseconds = totalMs % MILLISECONDS_PER_SECOND;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    `${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`,
  ].join(":");
}

export function formatSrtTimecode(value: number): string {
  return formatEditableTimecode(value).replace(".", ",");
}

export function parseTimecode(input: string): number | null {
  const cleaned = input.trim().replace(",", ".");

  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  let hours = 0;
  let minutesText = parts[0];
  let secondsText = parts[1];

  if (parts.length === 3) {
    hours = Number(parts[0]);
    minutesText = parts[1];
    secondsText = parts[2];
  }

  const minutes = Number(minutesText);
  const secondParts = secondsText.split(".");
  if (secondParts.length > 2) {
    return null;
  }

  const wholeSeconds = Number(secondParts[0]);
  const fractionText = (secondParts[1] ?? "0").padEnd(3, "0").slice(0, 3);
  const milliseconds = Number(fractionText);

  const invalidNumber =
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(wholeSeconds) ||
    !Number.isInteger(milliseconds);

  if (invalidNumber || hours < 0 || minutes < 0 || wholeSeconds < 0 || milliseconds < 0) {
    return null;
  }

  if (wholeSeconds >= SECONDS_PER_MINUTE) {
    return null;
  }

  if (parts.length === 3 && minutes >= MINUTES_PER_HOUR) {
    return null;
  }

  return (
    (((hours * MINUTES_PER_HOUR) + minutes) * SECONDS_PER_MINUTE + wholeSeconds) *
      MILLISECONDS_PER_SECOND +
    milliseconds
  );
}
