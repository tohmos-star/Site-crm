using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;

namespace PcAgent;

// Полноэкранный оверлей поверх всего, пока на станции нет активной сессии
// после истечения оплаченного времени. На данный момент — заглушка с
// сообщением; запуск новой сессии происходит удалённо (сайт/телефон),
// MainWindow сам обнаружит её через фоновый опрос и закроет это окно.
// Обычное закрытие (Alt+F4 и т.п.) заблокировано — окно закрывает только код.
//
// Аварийный выход (Ctrl+Alt+Shift+U) — чтобы станцию нельзя было
// "окирпичить": если сервер недоступен или что-то пошло не так и оверлей
// завис, персонал клуба может вручную снять блокировку, не переустанавливая
// и не сносив агент. Полное удаление агента — pc-agent/uninstall.ps1.
public partial class LockScreenWindow : Window
{
    private bool _allowClose;

    public event EventHandler? EmergencyUnlockRequested;

    public LockScreenWindow()
    {
        InitializeComponent();
    }

    public void ForceClose()
    {
        _allowClose = true;
        Close();
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_allowClose)
        {
            e.Cancel = true;
            return;
        }
        base.OnClosing(e);
    }

    private void Window_KeyDown(object sender, KeyEventArgs e)
    {
        // Пока зажат Alt, WPF маршрутизирует нажатие как "системное":
        // e.Key приходит как Key.System, а настоящая клавиша лежит в
        // e.SystemKey. Без этой проверки Ctrl+Alt+Shift+U никогда не
        // сработает, и аварийный выход молча не работает.
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (Keyboard.Modifiers == (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Shift) && key == Key.U)
        {
            EmergencyUnlockRequested?.Invoke(this, EventArgs.Empty);
        }
    }
}
