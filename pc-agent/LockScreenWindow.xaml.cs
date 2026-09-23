using System.ComponentModel;
using System.Windows;

namespace PcAgent;

// Полноэкранный оверлей поверх всего, пока на станции нет активной сессии
// после истечения оплаченного времени. На данный момент — заглушка с
// сообщением; запуск новой сессии происходит удалённо (сайт/телефон),
// MainWindow сам обнаружит её через фоновый опрос и закроет это окно.
// Обычное закрытие (Alt+F4 и т.п.) заблокировано — окно закрывает только код.
public partial class LockScreenWindow : Window
{
    private bool _allowClose;

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
}
