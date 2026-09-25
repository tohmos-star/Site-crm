using System;
using System.IO;

namespace PcAgent.Services;

// PcAgent — portable exe без инсталлятора (см. README): после распаковки
// zip из артефакта сборки у него нет ни ярлыка на рабочем столе, ни записи
// в "Пуск" — единственный способ запустить/перезапустить станцию вручную
// был через папку в проводнике. Создаём оба ярлыка сами при первом запуске,
// указывая на текущее расположение exe (может лежать где угодно).
public static class ShortcutManager
{
    private const string ShortcutName = "404 Станция.lnk";

    public static void EnsureShortcuts()
    {
        var exePath = Environment.ProcessPath;
        if (string.IsNullOrEmpty(exePath)) return;

        try
        {
            CreateShortcutIfMissing(
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), ShortcutName),
                exePath);

            var startMenuPrograms = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.StartMenu), "Programs");
            CreateShortcutIfMissing(Path.Combine(startMenuPrograms, ShortcutName), exePath);
        }
        catch (Exception)
        {
            // Ярлыки — удобство, не критичная функция: не даём сбою здесь
            // помешать обычному запуску приложения.
        }
    }

    private static void CreateShortcutIfMissing(string shortcutPath, string targetPath)
    {
        if (File.Exists(shortcutPath)) return;

        var shellType = Type.GetTypeFromProgID("WScript.Shell");
        if (shellType is null) return;

        dynamic shell = Activator.CreateInstance(shellType)!;
        dynamic shortcut = shell.CreateShortcut(shortcutPath);
        shortcut.TargetPath = targetPath;
        shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
        shortcut.Description = "404 · станция";
        shortcut.Save();
    }
}
