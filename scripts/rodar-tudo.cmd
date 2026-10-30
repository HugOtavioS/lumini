@echo off
REM Lumini: sobe API (banco SQLite), painel web do gestor e o app ligado a API.
REM Duplo clique. Fecha cada janela para parar o servico correspondente.
setlocal
cd /d "%~dp0.." || exit /b 1

REM IP do PC na rede local: o celular (Expo Go) precisa dele para achar a API.
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VirtualBox' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress"`) do set IP=%%i
if "%IP%"=="" set IP=localhost
echo === API em http://%IP%:3000

netstat -ano | findstr ":3000 " | findstr LISTENING >nul
if errorlevel 1 (
  start "Lumini API" cmd /k "npm run api"
) else (
  echo API ja estava rodando na porta 3000.
)
timeout /t 4 >nul
start "Lumini Painel" cmd /k "npm run painel -- --port 5180 --strictPort"

echo === App: login com carlos@lumini.com / lumini123 (painel: gestora@solarvale.com.br / lumini123)
cd apps\mobile
set EXPO_PUBLIC_API_URL=http://%IP%:3000
REM --clear: sem isso o Metro reaproveita o cache e o app ignora a URL da API.
call npx.cmd expo start --web --clear
