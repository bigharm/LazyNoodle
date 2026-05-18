# backend/api.py
# 主入口文件 - 只负责创建应用和注册路由

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import sys

from backend.config import APP_HOST, APP_PORT, APP_DEBUG
from backend.routes import register_routes
from backend.routes.system import mount_static_files

# 创建 FastAPI 应用
app = FastAPI(title="互动叙事系统 API", version="4.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册所有路由
register_routes(app)

# 挂载静态文件
mount_static_files(app)

# 添加根路径处理
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
    print(f"打包模式，程序目录: {BASE_DIR}")
else:
    BASE_DIR = Path(__file__).parent.parent
    print(f"开发模式，程序目录: {BASE_DIR}")


@app.get("/")
async def serve_index():
    """服务首页"""
    index_path = BASE_DIR / "index.html"
    print(f"查找 index.html 路径: {index_path}")
    print(f"文件是否存在: {index_path.exists()}")
    
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "LazyNoodle API is running"}


# ========== 启动配置 ==========
if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("🚀 互动叙事系统后端启动")
    print(f"📍 地址: http://{APP_HOST}:{APP_PORT}")
    print("=" * 50)
    uvicorn.run(app, host=APP_HOST, port=APP_PORT)