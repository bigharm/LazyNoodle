# backend/config.py

import os
from pathlib import Path
from dotenv import load_dotenv
import sys

# 加载 .env 文件
load_dotenv()

# ========== 路径配置 ==========
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent.parent

WORLDS_DIR = BASE_DIR / "worlds"
PROMPTS_DIR = BASE_DIR / "prompts"

# ========== AI 配置（完全从环境变量读取）==========
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY")
if not DEEPSEEK_API_KEY:
    raise ValueError("请在 .env 文件中设置 DEEPSEEK_API_KEY")

DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")

# AI 默认参数
DEFAULT_TEMPERATURE = float(os.environ.get("DEFAULT_TEMPERATURE", "0.3"))
DEFAULT_TEMPERATURE_HIGH = float(os.environ.get("DEFAULT_TEMPERATURE_HIGH", "0.8"))

# 调试模式
DEBUG = os.environ.get("APP_DEBUG", "True").lower() == "true"

# ========== 应用配置 ==========
APP_HOST = os.environ.get("APP_HOST", "127.0.0.1")
APP_PORT = int(os.environ.get("APP_PORT", "8000"))
APP_DEBUG = os.environ.get("APP_DEBUG", "True").lower() == "true"

# ========== 默认世界 ==========
DEFAULT_WORLD_ID = "default"

SUMMARIZE_CONFIG = {
    "level1_size": 50,          # 第一层总结粒度（条数）
    "level2_size": 10,          # 第二层总结粒度（多少个第一层总结）
    "keep_recent_count": 30,    # 保留的最近原始对话条数
    "keep_recent_summaries": 1,  # 保留的最近第一层总结数量
    "enable_summarize": True,    # 是否启用总结功能
}

# ========== 辅助函数 ==========
def ensure_directories():
    """确保所有必要目录存在"""
    WORLDS_DIR.mkdir(parents=True, exist_ok=True)
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)
    
    # 确保 default 世界目录存在
    default_world_path = WORLDS_DIR / DEFAULT_WORLD_ID
    default_world_path.mkdir(parents=True, exist_ok=True)
    (default_world_path / "locations").mkdir(exist_ok=True)
    (default_world_path / "npcs").mkdir(exist_ok=True)
    (default_world_path / "sessions" / "characters").mkdir(parents=True, exist_ok=True)