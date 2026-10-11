export class UseCaseError extends Error {
  readonly code: "BAD_REQUEST" | "PRECONDITION_FAILED";

  constructor(code: "BAD_REQUEST" | "PRECONDITION_FAILED", message: string) {
    super(message);
    this.code = code;
    this.name = "UseCaseError";
  }
}
