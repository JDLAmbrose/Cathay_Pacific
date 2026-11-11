import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { evaluateMembers } from "../engine/evaluateMembers";
import type { MemberBoardView, MemberFilter } from "../types";
import { loadMemberSnapshot } from "./loadMemberSnapshot";

export interface MemberBoardHookResult {
  viewModel: MemberBoardView | null;
  isPending: boolean;
  error: Error | null;
}

export function useMemberBoard(tDemo: string, filter: MemberFilter): MemberBoardHookResult {
  const result = useQuery({
    queryKey: ["member-snapshot"],
    queryFn: loadMemberSnapshot,
  });
  const viewModel = useMemo(() => {
    if (!result.data) {
      return null;
    }
    return evaluateMembers(result.data, tDemo, filter);
  }, [result.data, tDemo, filter]);

  return {
    viewModel,
    isPending: result.isPending,
    error: result.error instanceof Error ? result.error : result.error ? new Error("member snapshot failed") : null,
  };
}
