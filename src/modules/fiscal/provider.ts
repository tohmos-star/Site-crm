// Фискализация (54-ФЗ): каждая операция приёма денег обязана пробивать чек
// через ККТ/ОФД. Решение — заглушка: реальная интеграция с Т-Банк (облачная
// касса) — follow-up, не блокирует запуск биллинга. Swap STUB -> TBANK_OFD
// touches only this adapter.

export interface FiscalReceiptResult {
  fiscalDocNumber: string;
  fiscalUrl?: string;
}

export interface FiscalProviderPort {
  issueReceipt(input: { paymentTransactionId: string; amount: string }): Promise<FiscalReceiptResult>;
}

export class StubFiscalProvider implements FiscalProviderPort {
  async issueReceipt(input: { paymentTransactionId: string; amount: string }): Promise<FiscalReceiptResult> {
    // TODO: заменить на реальный вызов Т-Банк ОФД (облачная касса) при подключении.
    return {
      fiscalDocNumber: `STUB-${input.paymentTransactionId}`,
    };
  }
}
