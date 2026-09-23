using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using PcAgent.Services;

namespace PcAgent;

public partial class SetupWindow : Window
{
    private static readonly SolidColorBrush MintBrush = new(Color.FromRgb(0x3E, 0xD5, 0x98));
    private static readonly SolidColorBrush MintTextBrush = new(Color.FromRgb(0x0B, 0x1D, 0x14));
    private static readonly SolidColorBrush IdleBrush = new(Color.FromRgb(0x21, 0x2B, 0x38));
    private static readonly SolidColorBrush MutedTextBrush = new(Color.FromRgb(0x85, 0x92, 0xA3));

    private readonly ApiClient _api = new();
    private bool _saving;

    public SetupWindow()
    {
        InitializeComponent();
    }

    private void TokenInput_TextChanged(object sender, TextChangedEventArgs e)
    {
        UpdateSaveButtonState();
    }

    private void UpdateSaveButtonState()
    {
        var ready = NormalizeToken(TokenInput.Text).Length > 0 && !_saving;
        SaveButton.IsEnabled = ready;
        SaveButton.Background = ready ? MintBrush : IdleBrush;
        SaveButton.Foreground = ready ? MintTextBrush : MutedTextBrush;
    }

    // Токен диктуют/вводят вручную — не важно, с дефисом, пробелом или в
    // нижнем регистре, нормализуем перед отправкой (тот же приём, что и в
    // frontend/pc-widget.html).
    private static string NormalizeToken(string raw)
    {
        var chars = raw.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant);
        return new string(chars.ToArray());
    }

    private async void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        var token = NormalizeToken(TokenInput.Text);
        if (token.Length == 0 || _saving) return;

        _saving = true;
        ErrorText.Visibility = Visibility.Collapsed;
        SaveButton.Content = "Проверяем…";
        UpdateSaveButtonState();

        var result = await _api.CheckDeviceTokenAsync(token);

        _saving = false;
        SaveButton.Content = "Сохранить";

        if (result == TokenCheckResult.Valid)
        {
            DeviceTokenStore.Save(token);
            new MainWindow(token).Show();
            Close();
            return;
        }

        ErrorText.Text = result == TokenCheckResult.Invalid
            ? "Неверный токен станции"
            : "Не удалось проверить токен — нет связи с сервером";
        ErrorText.Visibility = Visibility.Visible;
        UpdateSaveButtonState();
    }
}
