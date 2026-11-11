import { useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { bookmarkById, DEFAULT_BOOKMARK_ID } from "../config/bookmarks";
import { useMemberBoard } from "../services/useMemberBoard";
import type { AudienceFilter, BookmarkId } from "../types";
import { FamilyFlow } from "../components/FamilyFlow";
import { IncrementBars } from "../components/IncrementBars";
import { JoinSpark } from "../components/JoinSpark";
import { LagRuler } from "../components/LagRuler";
import { MemberControlBar } from "../components/MemberControlBar";
import { PromoSplit } from "../components/PromoSplit";
import { RevenueComposition } from "../components/RevenueComposition";
import { RouteMap } from "../components/RouteMap";
import { ServiceFunnel } from "../components/ServiceFunnel";
import { TierColumns } from "../components/TierColumns";
import styles from "./MemberBoardPage.module.css";

export function MemberBoardPage() {
  const { t } = useI18n();
  const [bookmarkId, setBookmarkId] = useState<BookmarkId>(DEFAULT_BOOKMARK_ID);
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const bookmark = bookmarkById(bookmarkId);
  const { viewModel, isPending, error } = useMemberBoard(bookmark.at, { audience, corridor: "all" });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("mb.title")}</h1>
      <MemberControlBar
        bookmarkId={bookmarkId}
        at={bookmark.at}
        audience={audience}
        onBookmarkChange={setBookmarkId}
        onAudienceChange={setAudience}
      />
      {error ? <p className={styles.error}>{error.message}</p> : null}
      {isPending || !viewModel ? (
        <p className={styles.note}>{t("mb.loading")}</p>
      ) : (
        <div className={styles.board}>
          <div className={styles.wide}>
            <RevenueComposition revenue={viewModel.revenue} audience={audience} />
          </div>
          <RouteMap
            map={viewModel.map}
            showScopeAll={audience !== "all"}
          />
          <JoinSpark join={viewModel.join} />
          <ServiceFunnel service={viewModel.service} />
          <IncrementBars increment={viewModel.increment} />
          <div className={styles.wide}>
            <FamilyFlow family={viewModel.family} audience={audience} />
          </div>
          <LagRuler lag={viewModel.lag} />
          <TierColumns tiers={viewModel.tiers} />
          <div className={styles.wide}>
            <PromoSplit promo={viewModel.promo} audience={audience} />
          </div>
        </div>
      )}
    </div>
  );
}
