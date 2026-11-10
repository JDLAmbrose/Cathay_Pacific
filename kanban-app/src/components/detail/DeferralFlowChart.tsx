import { formatSectorCode } from "../../config/sectors";
import { formatDep, formatIntPct, formatKg } from "../../format/display";
import { useI18n } from "../../i18n/useI18n";
import type { CandidateFlightView, CandidateRejectReason, DeferralPlan, HoldLoadView } from "../../types/kanban";
import type { TranslationKey } from "../../i18n/dictionary";
import { InfoPopover } from "../common/InfoPopover";
import { rejectLinkPath, ribbonPath } from "./ribbonPath";
import styles from "./DeferralFlowChart.module.css";

const VIEW_W = 1390;
const X1 = 20;
const W1 = 150;
const Y0 = 40;
const X2 = 400;
const W2 = 20;
const X3 = 870;
const CARD_W = 500;
const CARD_H = 54;
const CARD_GAP = 22;
const KG_SCALE = 0.11;
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif';

function reasonColor(reason: CandidateRejectReason | null): string {
  if (reason === "CARGO_UNK") {
    return "#d99a12";
  }
  return "#d6453d";
}

function candidateWhy(candidate: CandidateFlightView, t: (key: TranslationKey) => string): string {
  if (candidate.decision === "ACCEPT" && candidate.allocatedKg > 0) {
    return `+${candidate.allocatedPieceCount} pcs · ${formatKg(candidate.allocatedKg)} kg · LOAD ${formatIntPct(candidate.loadRatioBefore)} → ${formatIntPct(candidate.loadRatioAfter ?? candidate.loadRatioBefore)}`;
  }
  if (candidate.decision === "ACCEPT") {
    return `LOAD ${formatIntPct(candidate.loadRatioBefore)}`;
  }
  if (candidate.reason === "OVER") {
    return `OVER ${formatIntPct(candidate.loadRatioBefore)}（${t("kb.reason.over")}）`;
  }
  if (candidate.reason === "CAUTION_VOL") {
    return `CAUTION VOL ${formatIntPct(candidate.volumeLoadRatio)}（${t("kb.reason.cautionVol")}）`;
  }
  if (candidate.reason === "CARGO_UNK") {
    return `CARGO UNK（${t("kb.reason.cargoUnk")}）`;
  }
  return t("kb.reason.insufficient");
}

function CandidateCard({
  candidate,
  x,
  y,
  t,
}: {
  candidate: CandidateFlightView;
  x: number;
  y: number;
  t: (key: TranslationKey) => string;
}) {
  const accepted = candidate.decision === "ACCEPT";
  const color = accepted ? "#2f9e6b" : reasonColor(candidate.reason);
  const why = candidateWhy(candidate, t);
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={CARD_W}
        height={CARD_H}
        rx={8}
        fill={accepted ? "#eef8f2" : "#fff"}
        stroke={accepted ? "#2f9e6b" : "#d5dedc"}
        strokeWidth={accepted ? 2 : 1}
      />
      <text x={x + 16} y={y + 21} fontSize={14} fontWeight={700} fill="#17302e" fontFamily={FONT}>
        {candidate.flightId}
      </text>
      <text x={x + 16} y={y + 37} fontSize={11} fill="#5d6f6d" fontFamily={FONT}>
        {formatDep(candidate.dep)}
      </text>
      <rect
        x={x + 100}
        y={y + 15}
        width={62}
        height={18}
        rx={4}
        fill={accepted ? "#2f9e6b" : "#fff"}
        stroke={accepted ? "none" : color}
      />
      <text
        x={x + 131}
        y={y + 28}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill={accepted ? "#fff" : color}
        fontFamily={FONT}
      >
        {accepted ? t("kb.candidate.accept") : t("kb.candidate.nogo")}
      </text>
      <text
        x={x + 176}
        y={y + 29}
        fontSize={13}
        fill={accepted ? "#17302e" : "#5d6f6d"}
        fontWeight={accepted ? 700 : 400}
        fontFamily={FONT}
      >
        {why}
      </text>
    </g>
  );
}

export function DeferralFlowChart({
  load,
  plan,
  windowDays,
  sector,
}: {
  load: HoldLoadView;
  plan: DeferralPlan;
  windowDays: number;
  sector: string;
}) {
  const { t } = useI18n();
  const kg = [
    Math.max(0, load.plumeOnFlightKg - plan.deferKg),
    load.plumeArrivedKg,
    plan.deferKg,
  ];
  const heights = kg.map((value) => Math.max(value * KG_SCALE, 14));
  const splitY = [Y0 - 14, Y0 + heights[0] + 22, Y0 + heights[0] + heights[1] + 62];
  const totalH = heights.reduce((sum, value) => sum + value, 0);
  const labels = [t("kb.flow.onFlight"), t("kb.flow.arrived"), t("kb.flow.defer")];
  const counts = [
    `${load.plumeOnFlightPieceCount - plan.deferPieceCount} pcs · ${formatKg(kg[0])} kg · ${t("kb.flow.onFlightSub")}`,
    `${load.plumeArrivedPieceCount} pcs · ${formatKg(kg[1])} kg · ${t("kb.flow.arrivedSub")}`,
    `${plan.deferPieceCount} pcs · ${formatKg(kg[2])} kg · ${t("kb.flow.deferSub")}`,
  ];
  const cardY = (index: number) => 26 + index * (CARD_H + CARD_GAP);
  const srcX = X2 + W2;
  const srcY = splitY[2];
  const srcH = heights[2];
  const splitBottom = splitY[2] + heights[2];
  const cardsBottom = plan.candidates.length === 0 ? 0 : cardY(plan.candidates.length - 1) + CARD_H;
  const viewH = Math.max(300, splitBottom + 24, cardsBottom + 24);
  const allocated = plan.candidates.filter((candidate) => candidate.allocatedKg > 0);
  const rejected = plan.candidates.filter((candidate) => candidate.decision === "NO_GO");

  let acc = Y0;
  const splitRibbons = heights.map((height, index) => {
    const path = ribbonPath(X1 + W1, acc, acc + height, X2, splitY[index], splitY[index] + height);
    acc += height;
    return {
      path,
      fill: index === 1 ? "#9aa5a3" : "#2f6fb5",
      opacity: index === 2 ? 0.55 : 0.4,
    };
  });

  return (
    <section className={styles.card}>
      <h3>
        {t("kb.flow.title")}
        <InfoPopover label={t("kb.flow.hint")}>{t("kb.flow.hint")}</InfoPopover>
      </h3>
      <div className={styles.scroller}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${viewH}`}
          className={styles.svg}
          role="img"
          aria-label={t("kb.flow.title")}
        >
          <defs>
            <pattern
              id="defer-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="#dbe8f6" />
              <rect width="2.6" height="6" fill="#2f6fb5" />
            </pattern>
          </defs>
          <text x={20} y={14} fontSize={12} fill="#5d6f6d" fontWeight={700} fontFamily={FONT}>
            {t("kb.flow.declared")}
          </text>
          <text x={400} y={14} fontSize={12} fill="#5d6f6d" fontWeight={700} fontFamily={FONT}>
            {t("kb.flow.split")}
          </text>
          <text x={870} y={14} fontSize={12} fill="#5d6f6d" fontWeight={700} fontFamily={FONT}>
            {t("kb.flow.candidates")} ({windowDays}D, {formatSectorCode(sector)})
          </text>
          <rect x={X1} y={Y0} width={W1} height={totalH} fill="#2f6fb5" />
          <text x={X1 + W1 / 2} y={Y0 + totalH / 2 - 6} textAnchor="middle" fontSize={14} fill="#fff" fontWeight={700} fontFamily={FONT}>
            {load.flightId}
          </text>
          <text x={X1 + W1 / 2} y={Y0 + totalH / 2 + 12} textAnchor="middle" fontSize={12} fill="#fff" fontFamily={FONT}>
            {load.plumePieceCount} pcs · {formatKg(load.plumeDeclaredKg)} kg
          </text>
          {splitRibbons.map((ribbon) => (
            <path key={ribbon.path} d={ribbon.path} fill={ribbon.fill} opacity={ribbon.opacity} />
          ))}
          {heights.map((height, index) => (
            <rect
              key={`bar-${labels[index]}`}
              x={X2}
              y={splitY[index]}
              width={W2}
              height={height}
              fill={index === 2 ? "url(#defer-hatch)" : index === 1 ? "#9aa5a3" : "#2f6fb5"}
              stroke={index === 2 ? "#2f6fb5" : "none"}
            />
          ))}
          {allocated.length > 0 ? (
            <rect x={srcX} y={srcY} width={270} height={srcH} fill="#2f6fb5" opacity={0.55} />
          ) : null}
          {allocated.map((candidate) => {
            const index = plan.candidates.indexOf(candidate);
            const cy = cardY(index) + CARD_H / 2;
            const band = Math.max(candidate.allocatedKg * KG_SCALE, 14);
            return (
              <path
                key={`${candidate.flightId}-ribbon`}
                d={ribbonPath(srcX + 270, srcY, srcY + srcH, X3, cy - band / 2, cy + band / 2)}
                fill="#2f6fb5"
                opacity={0.55}
              />
            );
          })}
          {rejected.map((candidate) => {
            const index = plan.candidates.indexOf(candidate);
            const cy = cardY(index) + CARD_H / 2;
            return (
              <g key={`${candidate.flightId}-reject`}>
                <path
                  d={rejectLinkPath(srcX + 270, srcY + srcH / 2, X3 - 26, cy)}
                  fill="none"
                  stroke="#9aa5a3"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                />
                <text
                  x={X3 - 14}
                  y={cy + 6}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={700}
                  fill={reasonColor(candidate.reason)}
                  fontFamily={FONT}
                >
                  ✕
                </text>
              </g>
            );
          })}
          {heights.map((height, index) => (
            <g key={labels[index]}>
              <text
                x={X2 + W2 + 10}
                y={splitY[index] + height / 2 - 2}
                fontSize={13.5}
                fontWeight={700}
                fill="#17302e"
                fontFamily={FONT}
                stroke="#fff"
                strokeWidth={4}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {labels[index]}
              </text>
              <text
                x={X2 + W2 + 10}
                y={splitY[index] + height / 2 + 14}
                fontSize={12}
                fill="#5d6f6d"
                fontFamily={FONT}
                stroke="#fff"
                strokeWidth={4}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                {counts[index]}
              </text>
            </g>
          ))}
          {plan.candidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.flightId}
              candidate={candidate}
              x={X3}
              y={cardY(index)}
              t={t}
            />
          ))}
        </svg>
      </div>
      {plan.residualKg > 0 ? (
        <p className={styles.residual}>
          <b>RESIDUAL {formatKg(plan.residualKg)} kg</b>
          {" · "}
          {t("kb.flow.residualNote")}
        </p>
      ) : null}
    </section>
  );
}
