import os
import shutil
import subprocess
import sys

print("=" * 60)
print("🍜 LazyNoodle 打包工具")
print("=" * 60)

# 自定义 copytree 函数，兼容 Python 3.7
def copy_tree(src, dst):
    """复制目录，兼容 Python 3.7，如果目标存在则先删除"""
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst)

def copy_tree_ignore(src, dst, ignore_func):
    """复制目录（带忽略函数），兼容 Python 3.7"""
    if os.path.exists(dst):
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=ignore_func)

# 1. 清理旧文件
print("\n[1/6] 清理旧文件...")
if os.path.exists("dist"):
    shutil.rmtree("dist")
if os.path.exists("build"):
    shutil.rmtree("build")

# 2. 创建临时目录
print("\n[2/6] 创建临时目录...")
os.makedirs("dist/temp", exist_ok=True)

# 3. 复制静态文件
print("\n[3/6] 复制静态文件...")
copy_tree("prompts", "dist/temp/prompts")
copy_tree("js", "dist/temp/js")
copy_tree("css", "dist/temp/css")
shutil.copy("index.html", "dist/temp/")
if os.path.exists("lazynoodle.png"):
    shutil.copy("lazynoodle.png", "dist/temp/")

# 复制现有的 worlds 目录（排除 sessions 用户数据）
if os.path.exists("worlds"):
    print("  复制现有 worlds 目录（排除用户存档）...")
    
    def ignore_user_data(src, names):
        """忽略 sessions 目录（用户数据）"""
        ignored = set()
        if "sessions" in names:
            ignored.add("sessions")
            print(f"    跳过: {os.path.join(src, 'sessions')}")
        # 也跳过 __pycache__
        if "__pycache__" in names:
            ignored.add("__pycache__")
        return ignored
    
    copy_tree_ignore("worlds", "dist/temp/worlds", ignore_user_data)
else:
    # 如果没有，创建默认 worlds 目录
    os.makedirs("dist/temp/worlds/default", exist_ok=True)
    with open("dist/temp/worlds/default/worldview.txt", "w", encoding="utf-8") as f:
        f.write("# 默认世界\n\n这是一个充满奇幻与冒险的自由世界。你可以在这里扮演任何角色，开始你的故事。")

# 4. 创建 .env.example
print("\n[4/6] 创建配置文件...")
with open("dist/temp/.env.example", "w", encoding="utf-8") as f:
    f.write("""# LazyNoodle 配置文件
# 复制此文件为 .env 并填入你的 API Key

DEEPSEEK_API_KEY=your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEBUG=False
APP_HOST=127.0.0.1
APP_PORT=8000
APP_DEBUG=False
""")

# 5. 使用 PyInstaller 打包
print("\n[5/6] 打包中（约2-3分钟，请耐心等待）...")

# 获取 Python 路径
python_path = sys.executable

# 排除不必要的包，避免 PyQt5 等错误
exclude_modules = [
    'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
    'matplotlib', 'tkinter', 'IPython', 'jupyter',
    'PIL', 'pillow', 'numpy', 'pandas', 'scipy',
    'curses', 'readline', 'gtk', 'gi',
    'selenium', 'scrapy', 'django', 'flask'
]

exclude_args = []
for mod in exclude_modules:
    exclude_args.extend(['--exclude-module', mod])

cmd = [
    python_path, "-m", "PyInstaller",
    "--name", "LazyNoodle",
    "--onefile",
    "--console",
    "--noconfirm",
    *exclude_args,
    "--add-data", f"dist/temp/prompts{os.pathsep}prompts",
    "--add-data", f"dist/temp/js{os.pathsep}js",
    "--add-data", f"dist/temp/css{os.pathsep}css",
    "--add-data", f"dist/temp/index.html{os.pathsep}.",
    "--add-data", f"dist/temp/lazynoodle.png{os.pathsep}.",
    "--add-data", f"dist/temp/worlds{os.pathsep}worlds",
    "--add-data", f"dist/temp/.env.example{os.pathsep}.",
    "--hidden-import", "uvicorn",
    "--hidden-import", "fastapi",
    "--hidden-import", "openai",
    "--hidden-import", "dotenv",
    "--hidden-import", "requests",
    "--hidden-import", "httpx",
    "backend/api.py"
]

try:
    subprocess.run(cmd, check=True)
except subprocess.CalledProcessError as e:
    print(f"打包失败: {e}")
    sys.exit(1)

# 6. 清理临时文件
print("\n[6/6] 清理临时文件...")
if os.path.exists("dist/temp"):
    shutil.rmtree("dist/temp")

# 7. 创建启动脚本
print("\n生成启动脚本...")
with open("dist/启动LazyNoodle.bat", "w", encoding="utf-8") as f:
    f.write("""@echo off
chcp 65001 > nul
title LazyNoodle - 懒得面

echo ================================================
echo   🍜 LazyNoodle - 懒得面
echo   AI驱动的自由叙事游戏
echo ================================================
echo.

:: 检查 .env 文件
if not exist .env (
    echo [提示] 首次运行，请先配置 API Key
    echo.
    echo 1. 复制 .env.example 为 .env
    echo 2. 用记事本打开 .env，填入你的 DeepSeek API Key
    echo 3. 保存后重新运行此脚本
    echo.
    echo 注意：使用 DeepSeek 时不要开启代理/VPN
    echo.
    pause
    exit /b 1
)

echo [信息] 正在启动服务器...
echo [信息] 首次启动较慢，请耐心等待...
echo [信息] 浏览器将自动打开 http://127.0.0.1:8000
echo [信息] 关闭此窗口可停止服务器
echo.

start /b LazyNoodle.exe

:: 等待服务器启动
timeout /t 4 /nobreak > nul

:: 打开浏览器
start http://127.0.0.1:8000

echo.
echo [信息] 服务器已启动
echo [信息] 游戏地址: http://127.0.0.1:8000
echo.
echo 按任意键退出此窗口（不会关闭服务器）
pause > nul
""")

# 8. 创建停止脚本
with open("dist/停止服务.bat", "w", encoding="utf-8") as f:
    f.write("""@echo off
chcp 65001 > nul
title LazyNoodle - 停止服务

echo ================================================
echo   停止 LazyNoodle 服务
echo ================================================
echo.

:: 查找并结束 LazyNoodle 进程
tasklist /FI "IMAGENAME eq LazyNoodle.exe" 2>NUL | find /I /N "LazyNoodle.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo 正在停止服务...
    taskkill /F /IM LazyNoodle.exe > nul 2>&1
    echo [信息] 服务已停止
) else (
    echo [信息] 服务未运行
)

echo.
pause
""")

# 9. 创建使用说明
with open("dist/使用说明.txt", "w", encoding="utf-8") as f:
    f.write("""LazyNoodle 懒得面 - 使用说明

1. 首次使用
   - 双击 "启动LazyNoodle.bat"
   - 如果提示缺少 API Key，请将 .env.example 复制为 .env
   - 用记事本打开 .env，将 your-api-key-here 替换为你的 DeepSeek API Key
   - 保存后重新双击 "启动LazyNoodle.bat"

2. 获取 API Key
   - 访问 https://platform.deepseek.com
   - 注册账号，在控制台获取 API Key

3. 重要提示
   - 使用 DeepSeek API 时，请关闭代理/VPN
   - 首次启动较慢（约10-20秒），请耐心等待
   - 如果浏览器没有自动打开，请手动访问 http://127.0.0.1:8000

4. 停止服务
   - 双击 "停止服务.bat" 即可

5. 常见问题
   Q: 启动后提示端口被占用
   A: 先运行"停止服务.bat"，再重新启动

   Q: AI 没有回应
   A: 检查网络是否正常，确认已关闭代理，检查 API Key 是否正确

有问题请访问: https://github.com/bigharm/LazyNoodle
""")

print("\n" + "=" * 60)
print("✅ 打包完成！")
print("=" * 60)
print("\n输出目录: dist/")
print("\n文件列表:")
for f in os.listdir("dist"):
    if os.path.isfile(os.path.join("dist", f)):
        print(f"  - {f}")
    else:
        print(f"  - {f}/ (文件夹)")
print("\n使用方法:")
print("  1. 将 dist 文件夹压缩成 zip")
print("  2. 用户解压后，编辑 .env 填入 API Key")
print("  3. 双击 启动LazyNoodle.bat")
print("\n注意: 打包后的 exe 约 80-100 MB")
print("=" * 60)