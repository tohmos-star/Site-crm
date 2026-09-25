using System.Windows;
using PcAgent.Services;

namespace PcAgent;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        AutostartManager.Enable();
        ShortcutManager.EnsureShortcuts();

        var savedToken = DeviceTokenStore.Load();
        Window window = savedToken is null
            ? new SetupWindow()
            : new MainWindow(savedToken);
        window.Show();
    }
}
