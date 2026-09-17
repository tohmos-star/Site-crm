// Wake-on-LAN magic-пакет шлёт MikroTik CCR2004 (`/tool wol` через RouterOS API),
// не Home Assistant и не локальный агент (согласованное решение).
//
// Реальная интеграция с MikroTik — часть модуля "умный дом/CCBoot" (следующий
// по очереди после биллинга). Здесь — только интерфейс точки расширения:
// бронирование вызывает wake() за 5 минут до старта, сейчас это no-op с логом.

export interface WakeOnLanPort {
  wake(mac: string): Promise<void>;
}

export class StubMikrotikWolProvider implements WakeOnLanPort {
  async wake(mac: string): Promise<void> {
    // TODO: RouterOS API `/tool wol` on MikroTik CCR2004 once smart-home module lands.
    console.log(`[wol:stub] would send magic packet to ${mac}`);
  }
}
