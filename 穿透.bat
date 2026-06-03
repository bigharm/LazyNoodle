@echo  off
:: natapp 启动脚本（由安装程序自动生成）
:: 双击此文件即可启动 natapp 隧道
::
:: 加入系统服务（开机自启）参考: "C:\Users\koyzh\natapp.exe" -authtoken=102b9426e6aeb41f -service help
:: 运行多条隧道: 仿照此文件，将 authtoken 替换为其他隧道的 token，另存为新文件运行
"C:\Users\koyzh\natapp.exe" -authtoken=102b9426e6aeb41f
pause
