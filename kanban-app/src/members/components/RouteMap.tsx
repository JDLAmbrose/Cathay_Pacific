import { useLayoutEffect, useRef, useState } from "react";
import { publicUrl } from "../../config/publicUrl";
import { useI18n } from "../../i18n/useI18n";
import type { MapView } from "../types";
import styles from "./RouteMap.module.css";

const HKG = { x: 816.4, y: 178.7 };
const LHR = { x: 498.7, y: 85.1 };
const ARC = "M816.4,178.7 Q657.6,61.9 498.7,85.1";
const WORLD = { w: 1000, h: 430 };
/** Window that keeps the London label, the arc, and Hong Kong inside the crop. */
const ROUTE = { x0: 428, y0: 28, x1: 862, y1: 214 };
const DEFAULT_BOX = { x: 430, y: 28, w: 430, h: 196 };
const DESKTOP_MAP = "(min-width: 901px)";

interface MapBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function roundBox(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Crop whose aspect matches the frame, always contains the route, and spends extra height south of it. */
function viewBoxFor(frameW: number, frameH: number): MapBox {
  const aspect = frameW / frameH;
  let w = ROUTE.x1 - ROUTE.x0;
  let h = ROUTE.y1 - ROUTE.y0;
  if (w / h > aspect) {
    h = w / aspect;
  } else {
    w = h * aspect;
  }
  w = Math.min(w, WORLD.w);
  h = Math.min(h, WORLD.h);
  if (w / h > aspect) {
    w = h * aspect;
  } else {
    h = w / aspect;
  }
  w = Math.min(w, WORLD.w);
  h = Math.min(h, WORLD.h);

  const x = clamp((ROUTE.x0 + ROUTE.x1) / 2 - w / 2, 0, WORLD.w - w);
  const extraSouth = Math.max(0, h - (ROUTE.y1 - ROUTE.y0));
  const y = clamp(ROUTE.y0 - extraSouth * 0.16, 0, WORLD.h - h);
  return { x: roundBox(x), y: roundBox(y), w: roundBox(w), h: roundBox(h) };
}

function sameBox(a: MapBox, b: MapBox): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function strokeWidth(count: number, widest: number): number {
  if (count <= 0 || widest <= 0) {
    return 1.4;
  }
  return 1.8 + (count / widest) * 7.2;
}

export function RouteMap({
  map,
  showScopeAll,
}: {
  map: MapView;
  showScopeAll: boolean;
}) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<MapBox>(DEFAULT_BOX);
  const widest = Math.max(...map.corridors.map((row) => row.activeMembers), 1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return undefined;
    }
    const desktop = window.matchMedia(DESKTOP_MAP);
    const fit = () => {
      if (!desktop.matches) {
        setBox((current) => (sameBox(current, DEFAULT_BOX) ? current : DEFAULT_BOX));
        return;
      }
      const rect = frame.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) {
        return;
      }
      const next = viewBoxFor(rect.width, rect.height);
      setBox((current) => (sameBox(current, next) ? current : next));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    desktop.addEventListener("change", fit);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", fit);
    };
  }, []);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2>
          {t("mb.map.title")}
          {showScopeAll ? <span className={styles.badge}>{t("mb.scopeAll")}</span> : null}
        </h2>
        <p className={styles.total}>
          <b>{map.paidMembers}</b>
          <small>{t("mb.map.paidMembers")}</small>
        </p>
      </div>
      <div className={styles.mapFrame} ref={frameRef}>
        <svg
          className={styles.map}
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={t("mb.map.title")}
        >
          <image href={publicUrl("maps/world-outline.svg")} x="0" y="0" width="1000" height="430" />
          {map.corridors.map((row) => (
            <path
              key={row.corridor}
              d={ARC}
              fill="none"
              stroke="#02544f"
              strokeWidth={strokeWidth(row.activeMembers, widest)}
              strokeLinecap="round"
              className={styles.arc}
            />
          ))}
          <circle cx={HKG.x} cy={HKG.y} r="5.5" fill="#02544f" />
          <text x={HKG.x} y={HKG.y + 22} textAnchor="middle" className={styles.city}>HKG</text>
          <circle cx={LHR.x} cy={LHR.y} r="4.5" fill="#043f39" />
          <text x={LHR.x - 12} y={LHR.y - 16} textAnchor="end" className={styles.city}>LHR</text>
        </svg>
      </div>
      <div className={styles.routes}>
        {map.corridors.map((row) => (
          <div key={row.corridor} className={`${styles.route} ${styles.on}`}>
            <div className={styles.identity}>
              <em>{row.corridor}</em>
              <strong>{row.activeMembers}</strong>
              <span>{t("mb.map.inUse")}</span>
            </div>
            <div className={styles.counts}>
              <span>{t("mb.map.students")} {row.students}</span>
              <span>{t("mb.map.parents")} {row.parents}</span>
              <span>{t("mb.map.business")} {row.business}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
