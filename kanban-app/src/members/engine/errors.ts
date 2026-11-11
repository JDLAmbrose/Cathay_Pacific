export class InvalidMemberSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMemberSnapshotError";
  }
}

export class UnknownBookmarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownBookmarkError";
  }
}
