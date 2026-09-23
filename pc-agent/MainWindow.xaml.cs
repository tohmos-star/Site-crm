using System;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using PcAgent.Services;

namespace PcAgent;

public partial class MainWindow : Window
{
    private readonly ApiClient _api = new();
    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromSeconds(1) };
    private readonly string? _deviceToken;
    private SessionInfo? _session;
    private bool _busy;

    public MainWindow() : this(null)
    {
    }

    public MainWindow(string? deviceToken)
    {
        InitializeComponent();
        _deviceToken = deviceToken;
        _timer.Tick += Timer_Tick;

        if (_deviceToken is not null)
        {
            Loaded += async (_, _) => await CheckSessionAsync();
        }
    }

    private void ShowPanel(FrameworkElement panel)
    {
        CheckingPanel.Visibility = Visibility.Collapsed;
        CodePanel.Visibility = Visibility.Collapsed;
        SessionPanel.Visibility = Visibility.Collapsed;
        panel.Visibility = Visibility.Visible;
    }

    // Проверяет, есть ли на этой станции активная сессия — вызывается при
    // старте, а также когда локальный отсчёт времени дошёл до нуля (сервер
    // — источник истины, локальный таймер только для отображения).
    private async Task CheckSessionAsync()
    {
        ShowPanel(CheckingPanel);
        var result = await _api.GetSessionAsync(_deviceToken!);

        if (result.Unauthorized)
        {
            ReturnToSetup();
            return;
        }

        if (!result.Ok)
        {
            ShowPanel(CodePanel);
            CodeErrorText.Text = result.ErrorMessage ?? "Нет связи с сервером";
            CodeErrorText.Visibility = Visibility.Visible;
            return;
        }

        if (result.Data is { } session)
        {
            ApplySession(session);
        }
        else
        {
            _session = null;
            _timer.Stop();
            ShowPanel(CodePanel);
        }
    }

    private void ApplySession(SessionInfo session)
    {
        _session = session;
        RenderSession();
        ShowPanel(SessionPanel);
        _timer.Stop();
        _timer.Start();
    }

    private void RenderSession()
    {
        if (_session is null) return;

        StationNameText.Text = $"404 · {_session.StationLabel}";
        BalanceText.Text = $"Баланс: {_session.GuestBalanceRub} ₽";

        var remaining = _session.EndsAt.ToLocalTime() - DateTime.Now;
        if (remaining < TimeSpan.Zero) remaining = TimeSpan.Zero;

        TimerText.Text = remaining.Hours > 0
            ? $"{remaining.Hours}:{remaining.Minutes:D2}:{remaining.Seconds:D2}"
            : $"{remaining.Minutes:D2}:{remaining.Seconds:D2}";

        SessionStatusText.Text = remaining == TimeSpan.Zero
            ? "Сессия завершена"
            : $"оплачено до {_session.EndsAt.ToLocalTime():HH:mm}";
    }

    private async void Timer_Tick(object? sender, EventArgs e)
    {
        if (_session is null) return;
        RenderSession();

        if (_session.EndsAt.ToLocalTime() <= DateTime.Now)
        {
            _timer.Stop();
            await CheckSessionAsync();
        }
    }

    private void CodeInput_TextChanged(object sender, TextChangedEventArgs e)
    {
        var digitsOnly = new string(CodeInput.Text.Where(char.IsDigit).ToArray());
        if (digitsOnly != CodeInput.Text)
        {
            CodeInput.Text = digitsOnly;
            CodeInput.CaretIndex = digitsOnly.Length;
            return;
        }
        CodeSubmitButton.IsEnabled = digitsOnly.Length == 6 && !_busy;
    }

    private async void CodeSubmitButton_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || CodeInput.Text.Length != 6) return;

        _busy = true;
        CodeErrorText.Visibility = Visibility.Collapsed;
        CodeSubmitButton.Content = "Проверяем…";
        CodeSubmitButton.IsEnabled = false;

        var result = await _api.RedeemCodeAsync(_deviceToken!, CodeInput.Text);

        _busy = false;
        CodeSubmitButton.Content = "Подтвердить";

        if (result.Unauthorized)
        {
            ReturnToSetup();
            return;
        }

        if (!result.Ok)
        {
            CodeErrorText.Text = result.ErrorMessage ?? "Код не найден или уже использован";
            CodeErrorText.Visibility = Visibility.Visible;
            CodeSubmitButton.IsEnabled = CodeInput.Text.Length == 6;
            return;
        }

        CodeInput.Text = "";
        ApplySession(result.Data!);
    }

    private void ChangeToken_Click(object sender, MouseButtonEventArgs e)
    {
        ReturnToSetup();
    }

    private void ReturnToSetup()
    {
        DeviceTokenStore.Clear();
        new SetupWindow().Show();
        Close();
    }

    private async void Extend30Button_Click(object sender, RoutedEventArgs e) => await ExtendAsync(30);
    private async void Extend60Button_Click(object sender, RoutedEventArgs e) => await ExtendAsync(60);

    private async Task ExtendAsync(int minutes)
    {
        if (_busy || _session is null) return;

        _busy = true;
        SessionErrorText.Visibility = Visibility.Collapsed;

        var result = await _api.ExtendAsync(_deviceToken!, _session.Id, minutes);

        _busy = false;

        if (result.Unauthorized)
        {
            ReturnToSetup();
            return;
        }

        if (!result.Ok)
        {
            SessionErrorText.Text = result.ErrorMessage ?? "Не удалось продлить";
            SessionErrorText.Visibility = Visibility.Visible;
            return;
        }

        ApplySession(result.Data!);
    }

    private async void CompleteButton_Click(object sender, RoutedEventArgs e)
    {
        if (_busy || _session is null) return;

        var confirmed = MessageBox.Show(
            "Завершить сессию? Оплаченное время сгорит.",
            "Подтверждение",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question) == MessageBoxResult.Yes;
        if (!confirmed) return;

        _busy = true;
        SessionErrorText.Visibility = Visibility.Collapsed;

        var result = await _api.CompleteAsync(_deviceToken!, _session.Id);

        _busy = false;

        if (result.Unauthorized)
        {
            ReturnToSetup();
            return;
        }

        if (!result.Ok)
        {
            SessionErrorText.Text = result.ErrorMessage ?? "Не удалось завершить сессию";
            SessionErrorText.Visibility = Visibility.Visible;
            return;
        }

        _session = null;
        _timer.Stop();
        ShowPanel(CodePanel);
    }

    // Заявка пока без реального бэкенда (см. PcAgent.Services и
    // SupportWindow) — как и в веб-версии, только локальное подтверждение.
    private void SupportButton_Click(object sender, RoutedEventArgs e)
    {
        new SupportWindow { Owner = this }.ShowDialog();
    }
}
