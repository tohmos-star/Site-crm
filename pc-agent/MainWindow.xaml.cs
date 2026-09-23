using System.Windows;

namespace PcAgent;

public partial class MainWindow : Window
{
    public MainWindow() : this(null)
    {
    }

    public MainWindow(string? deviceToken)
    {
        InitializeComponent();
        StatusText.Text = deviceToken is null
            ? "PC Agent — в разработке"
            : $"Станция привязана.\nТокен: {deviceToken}\n\n(опрос сессии и блокировка — следующий шаг)";
    }
}
