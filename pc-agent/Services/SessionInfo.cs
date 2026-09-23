using System;

namespace PcAgent.Services;

// Форма ответа реального /api/pc/session, /api/pc/redeem-code,
// /api/pc/session/:id/extend — см. describeSession() на сервере
// (src/modules/pcAgent/service.ts). Имена свойств совпадают по буквам без
// учёта регистра — десериализация идёт с PropertyNameCaseInsensitive.
public class SessionInfo
{
    public string Id { get; set; } = "";
    public string Status { get; set; } = "";
    public string StationLabel { get; set; } = "";
    public DateTime EndsAt { get; set; }
    public int TariffPerHour { get; set; }
    public int GuestBalanceRub { get; set; }
}

public class ApiResult<T>
{
    public bool Ok { get; init; }
    public bool Unauthorized { get; init; }
    public T? Data { get; init; }
    public string? ErrorMessage { get; init; }
}
