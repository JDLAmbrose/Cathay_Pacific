import { useEffect, useId, useRef, useState } from "react";
import { fmt } from "../engine/booking";
import { href } from "../config/routes";
import {
  getFamilyMilestones,
  type FamilyMilestones,
} from "../services/familyMilestones";
import { t } from "../services/i18n";
import { cssVars, cx } from "./primitives";
import { icon } from "./shared";

// One gift silhouette, with broad ribbons and either stitched or solid edges.
function GiftIcon({ stitched = false }: { stitched?: boolean }) {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className={cx("milestone-gift")}>
      <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={stitched ? "4 3" : undefined}>
        <path d="M31 20C14 19 12 7 20 6c7-1 11 9 12 14M33 20C50 19 52 7 44 6c-7-1-11 9-12 14" />
        <rect x="13" y="30" width="38" height="27" rx="2" />
        <rect x="10" y="21" width="44" height="10" rx="2" />
      </g>
      <path d="M28 21h8v36h-8z" fill="currentColor" />
      <path d="M12 24h40v5H12z" fill="currentColor" opacity=".2" />
    </svg>
  );
}

function MilestoneSummary({ milestones }: { milestones: FamilyMilestones }) {
  return (
    <div
      className={cx("milestone-summary")}
      role="progressbar"
      aria-label={t("benefit.completedMoves")}
      aria-valuemin={0}
      aria-valuemax={milestones.target}
      aria-valuenow={milestones.completed}
      aria-valuetext={t("benefit.milestonesTitle", {
        n: fmt(milestones.completed), total: fmt(milestones.target),
      })}
    >
      <strong className={cx("milestone-fraction")} dir="ltr">
        {fmt(milestones.completed)}<span>{" / "}{fmt(milestones.target)}</span>
      </strong>
      <p>{t("benefit.completedMoves")}</p>
    </div>
  );
}

export function FamilyMilestonesCard({
  milestones = getFamilyMilestones(),
}: {
  milestones?: FamilyMilestones;
}) {
  const id = useId();
  const [entered, setEntered] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const previouslyUnlocked = useRef(milestones.unlocked);
  useEffect(() => {
    let revealFrame = 0;
    const initialFrame = window.requestAnimationFrame(() => {
      revealFrame = window.requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(revealFrame);
    };
  }, []);
  useEffect(() => {
    // Only a qualification change celebrates; revisiting an unlocked card does not.
    if (milestones.unlocked && !previouslyUnlocked.current) setCelebrate(true);
    if (!milestones.unlocked) setCelebrate(false);
    previouslyUnlocked.current = milestones.unlocked;
  }, [milestones.unlocked]);
  const positions = [[100, 205], [300, 42], [500, 205]];
  const rewardKey = `benefit.nextMilestone.${milestones.completed}`;
  return (
    <article
      className={cx("card benefit-card milestone-card")}
      aria-labelledby={`${id}-title`}
      data-entered={entered}
      style={cssVars({
        "--milestone-offset": 1 - milestones.progress,
      })}
    >
      <header className={cx("milestone-heading")}>
        <h2 id={`${id}-title`}>{t("benefit.milestoneHeading")}</h2>
        <span className={cx("milestone-demo")} title={t("benefit.rewardConceptHint")}>
          {t("benefit.rewardConcept")}
        </span>
      </header>
      <p className={cx("milestone-subtitle")}>
        {t("benefit.milestoneSubtitle")}
      </p>
      <div className={cx("milestone-journey")}>
        <div className={cx("milestone-orbit")}>
          <svg className={cx("milestone-arc")} viewBox="0 0 600 250" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-arc`} x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#02544f" />
                <stop offset="55%" stopColor="#00a37c" />
                <stop offset="100%" stopColor="#69c979" />
              </linearGradient>
            </defs>
            <path className={cx("milestone-arc-track")} d="M100 205A200 163 0 0 1 500 205" />
            <path
              className={cx("milestone-arc-fill")}
              d="M100 205A200 163 0 0 1 500 205"
              pathLength={1}
              stroke={`url(#${id}-arc)`}
              strokeDasharray={1}
              strokeDashoffset={1 - milestones.progress}
              data-milestone-arc
            />
            {milestones.moves.map((move, index) => {
              const [x, y] = positions[index];
              return (
                <g
                  key={move.id}
                  transform={`translate(${x} ${y})`}
                  data-milestone-node={move.status}
                  className={cx("milestone-node")}
                >
                  <circle className={cx("milestone-node-disc")} r="32" />
                  <g transform="translate(-22 -22) scale(.6875)">
                    <GiftIcon stitched={move.status !== "counted"} />
                  </g>
                  {move.status === "counted" && (
                    <g className={cx("milestone-check")} transform="translate(25 25)" data-milestone-check>
                      <circle r="14" />
                      <path d="m-7 0 5 5 10-11" />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          <ol className={cx("milestone-stages")}>
            {milestones.moves.map((move, index) => (
              <li key={move.id} className={cx("milestone-stage")}>
                <div className={cx("milestone-stage-copy")}>
                  <h3>{t("benefit.moveStage", { n: fmt(index + 1) })}</h3>
                  <span className={cx("status-chip " + (move.status === "counted" ? "counted" : "notStarted"))}>
                    {t(move.status === "counted" ? "benefit.status.counted" : "benefit.milestonePending")}
                  </span>
                </div>
                {index === 1 && <MilestoneSummary milestones={milestones} />}
              </li>
            ))}
          </ol>
        </div>
      </div>
      {milestones.source === "unlinked" && (
        <div className={cx("benefit-empty")}>
          {icon("parent")}
          <p>{t("benefit.unlinkedText")}</p>
          <a className={cx("btn slim light")} href={href("family")}>
            {t("benefit.linkCta")}
          </a>
        </div>
      )}
      <div
        className={cx("milestone-reward")}
        data-reward-state={milestones.unlocked ? "unlocked" : "locked"}
        data-celebrate={celebrate}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={cx("milestone-reward-copy")}>
          <strong>{t(rewardKey + ".title")}</strong>
          <p>{t(rewardKey + ".description")}</p>
        </div>
        {icon("bag", "milestone-reward-luggage")}
      </div>
      <svg className={cx("milestone-waves")} viewBox="0 0 600 95" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 12C145 99 210 97 360 62S530 43 600 13V95H0Z" fill="#d7ebe5" opacity=".48" />
        <path d="M0 77C150 24 193 101 340 87S493 56 600 45V95H0Z" fill="#b7dcd0" opacity=".42" />
      </svg>
    </article>
  );
}
