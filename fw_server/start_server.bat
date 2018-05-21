@echo off

::查询MySQL服务状态
for /f "skip=3 tokens=4" %%i in ('sc query mysql') do set "state=%%i" & goto :start_mysql

::如果MySQL服务未开启，则启动之
:start_mysql
if not "%state%" == "RUNNING" (
	::获取管理员权限
	if not "%~1"=="H" (
		mshta vbscript:"<script language=vbs>Set UAC=CreateObject(""Shell.Application""):UAC.ShellExecute ""%~s0"", ""H"", """", ""runas"", 1:window,close</script>"
		Exit
	)

	::启动MySQL服务
	net start mysql
)

::切换到当前目录
cd /d %~dp0

::启动大厅服务器
start cmd /k "1.hall_server.bat"

::启动游戏服务器
start cmd /k "2.qzmj_game_server.bat"

::启动游戏服务器
start cmd /k "3.thirteen_game_server.bat"

pause