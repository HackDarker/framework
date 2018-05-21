for %%i in (%0) do (set "name=%%~ni") 
title %name%
set MAIN_JS=%~dp0\bsc_server\app.js
set CONFIG=%~dp0\configs_win.js
call node.exe %MAIN_JS% %CONFIG%
pause