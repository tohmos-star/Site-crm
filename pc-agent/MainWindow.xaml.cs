using System;
using System.Diagnostics;
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
    // Пока активной сессии нет (код ещё не введён, либо станция заблокирована
    // после истечения времени), опрашиваем сервер — сессию теперь можно
    // запустить удалённо (сайт/телефон), а не только вводом кода на месте.
    private readonly DispatcherTimer _pollTimer = new() { Interval = TimeSpan.FromSeconds(10) };
    private readonly string? _deviceToken;
    private SessionInfo? _session;
    private LockScreenWindow? _lockScreen;
    private bool _busy;

    public MainWindow() : this(null)
    {
    }

    public MainWindow(string? deviceToken)
    {
        InitializeComponent();
        _deviceToken = deviceToken;
        _timer.Tick += Timer_Tick;
        _pollTimer.Tick += async (_, _) => await CheckSessionAsync();
        Closed += (_, _) => HideLockScreen();

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
    // старте, регулярно фоновым опросом, а также когда локальный отсчёт
    // времени дошёл до нуля (сервер — источник истины, локальный таймер
    // только для отображения).
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
            ShowNoSessionState(result.ErrorMessage ?? "Нет связи с сервером");
            return;
        }

        if (result.Data is { } session)
        {
            ApplySession(session);
        }
        else
        {
            ShowNoSessionState(null);
        }
    }

    private void ApplySession(SessionInfo session)
    {
        _session = session;
        LockStateStore.ClearLocked();
        HideLockScreen();
        _pollTimer.Stop();
        RenderSession();
        ShowPanel(SessionPanel);
        _timer.Stop();
        _timer.Start();
    }

    // Активной сессии нет: либо станция ещё ни разу не бронировалась (показываем
    // обычный ввод кода), либо она заблокирована после истечения оплаченного
    // времени (см. LockStateStore) — тогда вместо ввода кода показываем
    // полноэкранный "экран блокировки". В обоих случаях включаем фоновый опрос,
    // чтобы подхватить сессию, запущенную удалённо.
    private void ShowNoSessionState(string? errorMessage)
    {
        _session = null;
        _timer.Stop();
        if (!_pollTimer.IsEnabled) _pollTimer.Start();

        if (LockStateStore.IsLocked())
        {
            ShowPanel(CheckingPanel);
            ShowLockScreen();
            return;
        }

        HideLockScreen();
        ShowPanel(CodePanel);
        CodeErrorText.Visibility = errorMessage is null ? Visibility.Collapsed : Visibility.Visible;
        if (errorMessage is not null) CodeErrorText.Text = errorMessage;
    }

    private void ShowLockScreen()
    {
        if (_lockScreen is not null) return;
        _lockScreen = new LockScreenWindow();
        _lockScreen.Closed += (_, _) => _lockScreen = null;
        _lockScreen.Show();
    }

    private void HideLockScreen()
    {
        _lockScreen?.ForceClose();
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
            await HandleSessionExpiredAsync();
        }
    }

    // Локальный отсчёт дошёл до нуля — сверяемся с сервером (вдруг гость
    // успел продлить в последний момент удалённо) и, только если сессии
    // действительно больше нет, перезагружаем ПК и показываем полноэкранную
    // блокировку. Сетевую ошибку не считаем поводом для перезагрузки "вслепую".
    private async Task HandleSessionExpiredAsync()
    {
        var result = await _api.GetSessionAsync(_deviceToken!);

        if (result.Unauthorized)
        {
            ReturnToSetup();
            return;
        }

        if (!result.Ok)
        {
            _timer.Start();
            return;
        }

        if (result.Data is { } session)
        {
            ApplySession(session);
            return;
        }

        LockStateStore.SetLocked();
        ShowNoSessionState(null);
        TriggerReboot("Оплаченное время закончилось — 404 PC Agent");
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
        LockStateStore.ClearLocked();
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

        ShowNoSessionState(null);
    }

    // Заявка пока без реального бэкенда (см. PcAgent.Services и
    // SupportWindow) — как и в веб-версии, только локальное подтверждение.
    private void SupportButton_Click(object sender, RoutedEventArgs e)
    {
        new SupportWindow { Owner = this }.ShowDialog();
    }

    // В отличие от frontend/pc-widget.html (где "Перезагрузить" — просто
    // анимация), здесь это нативное приложение и вызывает настоящую
    // перезагрузку Windows через shutdown.exe. Сессия/оплаченное время при
    // этом не трогаем — это чисто перезагрузка ОС по просьбе гостя.
    private void RebootButton_Click(object sender, RoutedEventArgs e)
    {
        var confirmed = MessageBox.Show(
            "Перезагрузить ПК? Оплаченное время не пострадает, компьютер уйдёт в перезагрузку через несколько секунд.",
            "Подтверждение",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question) == MessageBoxResult.Yes;
        if (!confirmed) return;

        TriggerReboot("Перезагрузка запрошена гостем через 404 PC Agent");
    }

    private void TriggerReboot(string reasonComment)
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "shutdown",
                Arguments = $"/r /t 5 /c \"{reasonComment}\"",
                CreateNoWindow = true,
                UseShellExecute = false,
            });
        }
        catch (Exception ex)
        {
            SessionErrorText.Text = $"Не удалось запустить перезагрузку: {ex.Message}";
            SessionErrorText.Visibility = Visibility.Visible;
        }
    }
}
