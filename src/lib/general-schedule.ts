export type GeneralScheduleConfig = {
  title: string;
  summary: string;
  weekday: number;
  time: string | null;
  minutes: number;
  optional: boolean;
};
export type GeneralScheduleData = {
  templateId: string;
  version: number;
  effectiveFrom: string;
  today: string;
  config: GeneralScheduleConfig;
};
export const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
