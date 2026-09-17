export class DomainError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} ${id} not found`, 404);
  }
}

export class BookingConflictError extends DomainError {
  constructor(message: string) {
    super("BOOKING_CONFLICT", message, 409);
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(message: string) {
    super("INSUFFICIENT_BALANCE", message, 422);
  }
}

export class PricingGapError extends DomainError {
  constructor(fromMinute: number, toMinute: number) {
    super(
      "PRICING_GAP",
      `No tariff rule covers ${fromMinute}-${toMinute} minutes of the day`,
      422,
    );
  }
}
