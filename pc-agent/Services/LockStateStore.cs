using System;
using System.IO;

namespace PcAgent.Services;

// Отмечает, что станция ушла в перезагрузку из-за окончания оплаченного
// времени — после перезапуска Windows MainWindow смотрит на этот флаг,
// чтобы показать полноэкранный "экран блокировки" вместо обычного экрана
// ввода кода. Снимается, как только на станции снова появляется активная
// сессия.
public static class LockStateStore
{
    private static readonly string FilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "PcAgent",
        "locked.flag");

    public static bool IsLocked() => File.Exists(FilePath);

    public static void SetLocked()
    {
        var dir = Path.GetDirectoryName(FilePath)!;
        Directory.CreateDirectory(dir);
        File.WriteAllText(FilePath, DateTime.UtcNow.ToString("O"));
    }

    public static void ClearLocked()
    {
        if (File.Exists(FilePath)) File.Delete(FilePath);
    }
}
