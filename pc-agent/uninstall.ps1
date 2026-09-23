# Полностью удаляет PC Agent с этой станции: останавливает процесс, снимает
# автозапуск из реестра и стирает локальные данные (токен станции, флаг
# блокировки). Сам PcAgent.exe после этого можно удалить вручную (или
# каталог, где он лежит).
#
# Запуск: правый клик по файлу -> "Выполнить с помощью PowerShell",
# либо: powershell -ExecutionPolicy Bypass -File uninstall.ps1
# Запускать под той же учёткой Windows, под которой работал агент.

Write-Host "Останавливаем PcAgent, если он запущен..."
Get-Process -Name "PcAgent" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Убираем автозапуск..."
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "PcAgent" -ErrorAction SilentlyContinue

Write-Host "Удаляем токен станции и флаг блокировки..."
$dataDir = Join-Path $env:LOCALAPPDATA "PcAgent"
Remove-Item -Path $dataDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Готово. Автозапуск снят, данные станции удалены."
Write-Host "Файл PcAgent.exe (и его папку) теперь можно удалить вручную."
