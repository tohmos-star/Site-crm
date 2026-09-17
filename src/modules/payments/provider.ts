// Приём платежей (СБП/эквайринг): решение — Т-Банк, но интеграция отложена
// (заглушка по явному решению). Реальная интеграция — follow-up, точка
// расширения ограничена этим адаптером.

export interface PaymentChargeResult {
  externalId: string;
  succeeded: boolean;
}

export interface PaymentProviderPort {
  charge(input: { guestId: string; amount: string }): Promise<PaymentChargeResult>;
}

export class StubPaymentProvider implements PaymentProviderPort {
  async charge(input: { guestId: string; amount: string }): Promise<PaymentChargeResult> {
    // TODO: заменить на реальный вызов Т-Банк (СБП/эквайринг) при подключении.
    return {
      externalId: `stub_${input.guestId}_${Date.now()}`,
      succeeded: true,
    };
  }
}
