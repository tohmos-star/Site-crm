using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace PcAgent.Services;

public enum TokenCheckResult
{
    Valid,
    Invalid,
    NetworkError,
}

// Обёртка над реальным /api/pc/* (см. src/modules/pcAgent на сервере) —
// авторизация статичным токеном станции, а не гостевым/админским JWT.
public class ApiClient
{
    // TODO: сделать настраиваемым (сейчас один клуб на фиксированном
    // сервере) — см. pc-agent/README.md.
    private const string BaseUrl = "http://92.242.60.149:3000";

    private readonly HttpClient _http = new() { BaseAddress = new Uri(BaseUrl) };

    public async Task<TokenCheckResult> CheckDeviceTokenAsync(string deviceToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/pc/session");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", deviceToken);
            using var response = await _http.SendAsync(request);

            if (response.IsSuccessStatusCode) return TokenCheckResult.Valid;
            if ((int)response.StatusCode == 401) return TokenCheckResult.Invalid;
            return TokenCheckResult.NetworkError;
        }
        catch (HttpRequestException)
        {
            return TokenCheckResult.NetworkError;
        }
        catch (TaskCanceledException)
        {
            return TokenCheckResult.NetworkError;
        }
    }
}
