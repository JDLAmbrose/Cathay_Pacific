export const BOARD_SECTORS = ["HKG-LHR", "HKG-MEL", "HKG-SYD"] as const;

export type BoardSector = (typeof BOARD_SECTORS)[number];

export const DEFAULT_SECTOR: BoardSector = "HKG-LHR";

export function isBoardSector(value: string): value is BoardSector {
  return (BOARD_SECTORS as readonly string[]).includes(value);
}

export function formatSectorCode(sector: string): string {
  const [origin, destination] = sector.split("-");
  return origin && destination ? `${origin} → ${destination}` : sector;
}

export function sectorLabelKey(sector: string): "kb.sector.lhr" | "kb.sector.mel" | "kb.sector.syd" {
  if (sector === "HKG-MEL") {
    return "kb.sector.mel";
  }
  if (sector === "HKG-SYD") {
    return "kb.sector.syd";
  }
  return "kb.sector.lhr";
}

export function listBoardSectors(values: readonly string[]): string[] {
  const seen = new Set(values);
  const known = BOARD_SECTORS.filter((sector) => seen.has(sector));
  const extra = [...seen].filter((sector) => !isBoardSector(sector)).sort();
  return [...known, ...extra];
}
