/** Common IANA timezones for pay-first checkout. Values are stored on CustomerOrder.timezone. */
export const COMMON_TIMEZONES = [
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Toronto", label: "Eastern Time (Toronto)" },
  { value: "America/Sao_Paulo", label: "Brasilia (São Paulo)" },
  { value: "America/Mexico_City", label: "Central Time (Mexico City)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Europe/Dublin", label: "Ireland (Dublin)" },
  { value: "Europe/Paris", label: "Central Europe (Paris)" },
  { value: "Europe/Berlin", label: "Central Europe (Berlin)" },
  { value: "Europe/Amsterdam", label: "Central Europe (Amsterdam)" },
  { value: "Europe/Madrid", label: "Central Europe (Madrid)" },
  { value: "Europe/Rome", label: "Central Europe (Rome)" },
  { value: "Europe/Stockholm", label: "Central Europe (Stockholm)" },
  { value: "Europe/Athens", label: "Eastern Europe (Athens)" },
  { value: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
  { value: "Asia/Dubai", label: "Gulf (Dubai)" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Tokyo", label: "Japan (Tokyo)" },
  { value: "Asia/Seoul", label: "Korea (Seoul)" },
  { value: "Australia/Perth", label: "Australia (Perth)" },
  { value: "Australia/Sydney", label: "Australia (Sydney)" },
  { value: "Pacific/Auckland", label: "New Zealand (Auckland)" },
  { value: "UTC", label: "UTC" },
] as const;

export const DEFAULT_CHECKOUT_TIMEZONE = "America/New_York";

const allowed = new Set<string>(COMMON_TIMEZONES.map((zone) => zone.value));

export function normalizeCheckoutTimezone(value: string | null | undefined): string {
  const candidate = (value ?? "").trim();
  return allowed.has(candidate) ? candidate : DEFAULT_CHECKOUT_TIMEZONE;
}
