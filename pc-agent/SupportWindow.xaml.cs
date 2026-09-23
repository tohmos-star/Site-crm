using System.Windows;
using System.Windows.Media;

namespace PcAgent;

// Пока без реального бэкенда — на сервере нет эндпоинта для заявок в
// техподдержку (см. frontend/pc-widget.html sendSupport() — там то же
// самое, только локальное подтверждение). Нужно будет завести отдельную
// ручку, чтобы заявка реально доходила до администратора.
public partial class SupportWindow : Window
{
    private static readonly SolidColorBrush MintBrush = new(Color.FromRgb(0x3E, 0xD5, 0x98));
    private static readonly SolidColorBrush MintTextBrush = new(Color.FromRgb(0x0B, 0x1D, 0x14));

    public SupportWindow()
    {
        InitializeComponent();
    }

    private void Reason_Checked(object sender, RoutedEventArgs e)
    {
        SendButton.IsEnabled = true;
        SendButton.Background = MintBrush;
        SendButton.Foreground = MintTextBrush;
    }

    private void SendButton_Click(object sender, RoutedEventArgs e)
    {
        FormPanel.Visibility = Visibility.Collapsed;
        SentText.Visibility = Visibility.Visible;
    }
}
