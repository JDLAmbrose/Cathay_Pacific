import { HKT_TIME_ZONE } from "../config/thresholds";
import type { DeferralAssessment, HoldStatus } from "../types/kanban";
import type { TranslationKey } from "../i18n/dictionary";

export function formatKg(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatM3(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function formatPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatIntPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatCountdown(hours: number): string {
  const sign = hours < 0 ? "+" : "−";
  const abs = Math.abs(hours);
  let mins = Math.round((abs % 1) * 60);
  let hrs = Math.floor(abs);
  if (mins === 60) {
    hrs += 1;
    mins = 0;
  }
  return `T${sign}${hrs}:${String(mins).padStart(2, "0")}`;
}

export function formatDep(iso: string): string {
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

export function formatAsOf(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} HKT`;
}

export function addHoursIso(iso: string, hours: number): string {
  const next = new Date(Date.parse(iso) + hours * 3_600_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HKT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(next);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}+08:00`;
}

export function statusLabelKey(status: HoldStatus): TranslationKey {
  switch (status) {
    case "OVER":
      return "kb.status.overShort";
    case "CAUTION":
      return "kb.status.cautionShort";
    case "NORMAL":
      return "kb.status.normalShort";
    case "CARGO_UNK":
      return "kb.status.unkShort";
  }
}

export function assessmentLabelKey(assessment: DeferralAssessment): TranslationKey {
  switch (assessment) {
    case "CLEAR":
      return "kb.assess.clearShort";
    case "PARTIAL":
      return "kb.assess.partialShort";
    case "NO_GO":
      return "kb.assess.nogoShort";
    case "MONITOR":
      return "kb.assess.monitorShort";
  }
}

export function statusTone(status: HoldStatus): "bad" | "warn" | "ok" | "off" {
  switch (status) {
    case "OVER":
      return "bad";
    case "CAUTION":
      return "warn";
    case "NORMAL":
      return "ok";
    case "CARGO_UNK":
      return "off";
  }
}

export function assessmentTone(assessment: DeferralAssessment): "bad" | "warn" | "ok" | "off" {
  switch (assessment) {
    case "CLEAR":
      return "ok";
    case "PARTIAL":
      return "warn";
    case "NO_GO":
      return "bad";
    case "MONITOR":
      return "off";
  }
}
