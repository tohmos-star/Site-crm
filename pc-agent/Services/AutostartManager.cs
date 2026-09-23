using System;
using Microsoft.Win32;

namespace PcAgent.Services;

// Автозапуск через HKCU\...\Run — не требует прав администратора и работает
// в рамках текущего пользователя Windows, чего достаточно для клубного ПК
// с одной постоянной учёткой. Регистрируется при каждом запуске приложения
// (идемпотентно), чтобы пережить ручное удаление записи или переустановку.
public static class AutostartManager
{
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "PcAgent";

    public static void Enable()
    {
        var exePath = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exePath)) return;

        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKeyPath, writable: true);
            key?.SetValue(ValueName, $"\"{exePath}\"");
        }
        catch (Exception)
        {
            // Автозапуск — не критичная функция: если запись в реестр не
            // удалась (нет прав, политика групп и т.п.), приложение всё
            // равно должно нормально запускаться.
        }
    }
}
