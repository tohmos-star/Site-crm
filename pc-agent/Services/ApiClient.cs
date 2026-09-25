using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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

    // Клубные сети нередко сидят за прокси с NTLM/Kerberos-аутентификацией:
    // браузер на том же ПК проходит его прозрачно (WinINet берёт креды
    // текущего пользователя Windows), а голый HttpClient — нет, и запрос
    // до нашего сервера падает уже на прокси ("Нет связи с сервером",
    // хотя сервер и порт снаружи доступны). DefaultProxyCredentials чинит
    // именно это: подставляет текущие Windows-креды для прокси, не трогая
    // авторизацию к самому серверу (она идёт через Bearer-токен станции).
    private readonly HttpClient _http = new(new HttpClientHandler
    {
        DefaultProxyCredentials = CredentialCache.DefaultCredentials,
    })
    { BaseAddress = new Uri(BaseUrl) };

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

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    // GET /api/pc/session отдаёт {session: SessionInfo|null} — станция
    // свободна, если session == null.
    public Task<ApiResult<SessionInfo?>> GetSessionAsync(string token) =>
        SendAsync<SessionWrapper, SessionInfo?>(HttpMethod.Get, "/api/pc/session", token, null, wrapper => wrapper?.Session);

    public Task<ApiResult<SessionInfo>> RedeemCodeAsync(string token, string code) =>
        SendAsync<SessionInfo, SessionInfo>(HttpMethod.Post, "/api/pc/redeem-code", token, new { code }, s => s!);

    public Task<ApiResult<SessionInfo>> ExtendAsync(string token, string sessionId, int minutes) =>
        SendAsync<SessionInfo, SessionInfo>(HttpMethod.Post, $"/api/pc/session/{sessionId}/extend", token, new { minutes }, s => s!);

    public Task<ApiResult<bool>> CompleteAsync(string token, string sessionId) =>
        SendAsync<object, bool>(HttpMethod.Post, $"/api/pc/session/{sessionId}/complete", token, null, _ => true);

    private class SessionWrapper
    {
        public SessionInfo? Session { get; set; }
    }

    private async Task<ApiResult<TOut>> SendAsync<TRaw, TOut>(
        HttpMethod method, string path, string token, object? body, Func<TRaw?, TOut> project)
    {
        try
        {
            using var request = new HttpRequestMessage(method, path);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (body is not null)
            {
                request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            }

            using var response = await _http.SendAsync(request);
            var text = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var raw = string.IsNullOrWhiteSpace(text)
                    ? default
                    : JsonSerializer.Deserialize<TRaw>(text, JsonOptions);
                return new ApiResult<TOut> { Ok = true, Data = project(raw) };
            }

            var error = ExtractErrorMessage(text) ?? $"Ошибка сервера ({(int)response.StatusCode})";
            return new ApiResult<TOut> { Ok = false, Unauthorized = (int)response.StatusCode == 401, ErrorMessage = error };
        }
        catch (HttpRequestException)
        {
            return new ApiResult<TOut> { Ok = false, ErrorMessage = "Нет связи с сервером" };
        }
        catch (TaskCanceledException)
        {
            return new ApiResult<TOut> { Ok = false, ErrorMessage = "Нет связи с сервером" };
        }
    }

    private static string? ExtractErrorMessage(string body)
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var errorProp)) return errorProp.GetString();
            if (doc.RootElement.TryGetProperty("message", out var messageProp)) return messageProp.GetString();
        }
        catch (JsonException)
        {
        }
        return null;
    }
}
