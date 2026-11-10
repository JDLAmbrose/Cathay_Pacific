export class InvalidFlightDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFlightDataError";
  }
}

export class UnknownAircraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownAircraftError";
  }
}

export class InvalidSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSnapshotError";
  }
}
