using System;
using System.IO;

namespace PcAgent.Services;

// Токен станции привязывается один раз при установке и живёт локально на
// ПК — при следующих запусках виджет стартует уже привязанным, без
// повторного ввода.
public static class DeviceTokenStore
{
    private static readonly string FilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PcAgent",
        "device-token.txt");

    public static string? Load()
    {
        if (!File.Exists(FilePath)) return null;
        var token = File.ReadAllText(FilePath).Trim();
        return string.IsNullOrEmpty(token) ? null : token;
    }

    public static void Save(string token)
    {
        var dir = Path.GetDirectoryName(FilePath)!;
        Directory.CreateDirectory(dir);
        File.WriteAllText(FilePath, token);
    }

    public static void Clear()
    {
        if (File.Exists(FilePath)) File.Delete(FilePath);
    }
}
