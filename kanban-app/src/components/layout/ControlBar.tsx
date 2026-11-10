import { sectorLabelKey } from "../../config/sectors";
import { formatAsOf } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { LoadMetric } from "../../types/kanban";
import { InfoPopover } from "../common/InfoPopover";
import styles from "./ControlBar.module.css";

export interface ControlBarProps {
  asOf: string;
  sector: string;
  availableSectors: string[];
  windowDays: number;
  nearHours: number;
  metric: LoadMetric;
  cargoFilled: boolean;
  live: boolean;
  onLiveChange: (live: boolean) => void;
  onSectorChange: (sector: string) => void;
  onWindowDaysChange: (days: number) => void;
  onNearHoursChange: (hours: number) => void;
  onMetricChange: (metric: LoadMetric) => void;
  onFillCargo: () => void;
  onTimeStep: (hours: number) => void;
}

export function ControlBar(props: ControlBarProps) {
  const { t } = useI18n();
  return (
    <div className={styles.bar}>
      <div className={styles.group}>
        <label>
          {t("kb.ctrl.asOf")}
          <InfoPopover label={t("kb.ctrl.asOfHint")}>{t("kb.ctrl.asOfHint")}</InfoPopover>
        </label>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={() => props.onTimeStep(-1)}>
            ◀
          </button>
          <span className={`${styles.ctl} ${styles.on}`}>{formatAsOf(props.asOf)}</span>
          <button type="button" className={styles.btn} onClick={() => props.onTimeStep(1)}>
            ▶
          </button>
          <button
            type="button"
            className={`${styles.ctl} ${props.live ? styles.liveOn : ""}`}
            onClick={() => props.onLiveChange(!props.live)}
          >
            {props.live ? t("kb.ctrl.liveOn") : t("kb.ctrl.liveOff")}
          </button>
        </div>
      </div>
      <div className={styles.group}>
        <label>
          {t("kb.ctrl.sector")}
          <InfoPopover label={t("kb.ctrl.sectorHint")}>{t("kb.ctrl.sectorHint")}</InfoPopover>
        </label>
        <div className={styles.row}>
          {props.availableSectors.map((sector) => (
            <button
              key={sector}
              type="button"
              className={`${styles.ctl} ${props.sector === sector ? styles.on : ""}`}
              onClick={() => props.onSectorChange(sector)}
            >
              {t(sectorLabelKey(sector))}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.group}>
        <label>
          {t("kb.ctrl.window")}
          <InfoPopover label={t("kb.ctrl.windowHint")}>{t("kb.ctrl.windowHint")}</InfoPopover>
        </label>
        <div className={styles.row}>
          {[1, 2, 3].map((days) => (
            <button
              key={days}
              type="button"
              className={`${styles.ctl} ${props.windowDays === days ? styles.on : ""}`}
              onClick={() => props.onWindowDaysChange(days)}
            >
              {t(`kb.ctrl.window.${days}d` as "kb.ctrl.window.1d")}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.group}>
        <label>
          {t("kb.ctrl.near")}
          <InfoPopover label={t("kb.ctrl.nearHint")}>{t("kb.ctrl.nearHint")}</InfoPopover>
        </label>
        <div className={styles.row}>
          {[4, 6, 8].map((hours) => (
            <button
              key={hours}
              type="button"
              className={`${styles.ctl} ${props.nearHours === hours ? styles.on : ""}`}
              onClick={() => props.onNearHoursChange(hours)}
            >
              T−{hours}h
            </button>
          ))}
        </div>
      </div>
      <div className={styles.grow} />
      <div className={styles.group}>
        <label>{t("kb.ctrl.metric")}</label>
        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.ctl} ${props.metric === "weight" ? styles.on : ""}`}
            onClick={() => props.onMetricChange("weight")}
          >
            {t("kb.ctrl.metric.weight")}
          </button>
          <button
            type="button"
            className={`${styles.ctl} ${props.metric === "volume" ? styles.on : ""}`}
            onClick={() => props.onMetricChange("volume")}
          >
            {t("kb.ctrl.metric.volume")}
          </button>
        </div>
      </div>
      {props.sector === "HKG-LHR" ? (
        <div className={styles.group}>
          <label>{t("kb.demo.data")}</label>
          <button type="button" className={styles.solid} onClick={props.onFillCargo} disabled={props.cargoFilled}>
            {props.cargoFilled ? t("kb.demo.filled") : t("kb.demo.fillCargo")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
