# 🍜 LazyNoodle · 懒得面

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue)](https://www.python.org/downloads/)

**LazyNoodle** 是一个AI驱动的自由叙事游戏引擎。无需编程，你就能与AI共同创造独一无二的故事，扮演任何你想成为的角色，在一个由文字构建的无限世界里自由探索。

“懒得面”这个名字，寓意着你可以慵懒地、随性地沉浸于故事之中。项目灵感来源于流行的“酒馆”式文字角色扮演游戏，但是设置门槛更低，对普通玩家更加友好，但将一切规则和情节推动都交给了AI。

## ✨ 核心特性

- **🤖 AI驱动的动态叙事**：世界、NPC、任务都由AI实时生成，每一次游戏都是全新的体验。
- **🎭 自由角色扮演**：你可以自由创建任何身份和背景的角色，AI会尊重并围绕你的设定展开故事。
- **📜 动态任务系统**：通过系统助手与AI聊天，即可生成任务。任务会记录在侧边栏，并随你的游戏进程自动更新。
- **💬 智能NPC对话**：与游戏中的NPC进行自由对话。你的行为和态度会影响NPC对你的看法，并更新在关系系统中。
- **🔍 静默观察**：在不被NPC察觉的情况下，静静地观察他们，获得更多环境信息。
- **🌍 多世界支持**：你可以创建多个不同的“世界”，每个世界拥有独立的世界观、地点和NPC。
- **⌨️ 兼容酒馆角色卡**：支持角色卡导入角色。但是注意，本项目只支持中文。外语角色卡可能出现对话过程中英混乱。
- **🧩 模块化设计**：前后端分离，结构清晰，方便二次开发。

## 🚀 快速开始

### 方式一：解压即玩（推荐新手）

1.  从 **[Releases](https://github.com/bigharm/LazyNoodle/releases)** 页面下载最新的 `LazyNoodle_vX.X.X.zip` 压缩包。
2.  解压到任意文件夹。
3.  **首次使用**：
    -   双击运行 `启动LazyNoodle.bat`。
    -   程序会提示你配置API Key。请按照提示，将根目录下的 `.env.example` 文件复制一份并重命名为 `.env`。
    -   在 `.env` 文件中填入你的 [DeepSeek API Key](https://platform.deepseek.com/)，并保存。
    -   **重要提示**：使用 DeepSeek API 时，请确保你的网络环境**不要开启代理或VPN**，否则可能无法正常连接。
4.  再次双击 `启动LazyNoodle.bat`，稍等片刻，浏览器会自动打开游戏界面。

### 方式二：从源码运行（适合开发者）

1.  **克隆仓库**
    ```bash
    git clone https://github.com/bigharm/LazyNoodle.git
    cd LazyNoodle
安装依赖

bash
pip install -r requirements.txt
配置环境变量

复制 .env.example 文件为 .env。

在 .env 文件中填入你的 DEEPSEEK_API_KEY。

启动应用

bash
uvicorn backend.api:app --reload
打开浏览器访问 http://127.0.0.1:8000 开始你的故事。

📖 使用指南
选择或创建世界：首次进入，你需要选择一个“世界”，这决定了游戏的整体背景和规则。

创建你的角色：在世界内，创建你想要扮演的角色。你可以手动填写，也可以简单地给AI一个“角色描述”，让它帮你完善。

开始叙事：进入游戏主界面后：

聊天区：在这里输入动作（如“走到吧台前”）和语言（如“老板，来杯酒”），AI会为你描述世界的反馈。

侧边栏：

已解锁地点：显示你已经去过的地方，点击可以快速切换场景。

周围的人：显示当前场景的NPC。可以观察或与他们对话。你也可以点击“➕”按钮，用AI创建或从文件导入新的NPC。

当前任务：显示你接取的任务。点击任务卡片右上角的“🗑️”可以删除任务。

系统助手：点击NPC列表顶部的“🤖 系统助手”，可以查看角色状态、获取游戏提示或生成新任务。

功能按钮：

🔧 测试AI：测试后端AI服务是否连接正常。

🔑 API Key：用于在游戏内更换或测试你的DeepSeek API Key。

👋 退出：返回角色选择界面。

🛠️ 技术架构
后端: FastAPI (Python 3.10+)

前端: 原生 JavaScript (ES6+), HTML5, CSS3

AI 集成: DeepSeek API

数据存储: 本地文件系统 (JSON)

🤝 贡献与反馈
欢迎提交Issue和Pull Request。如果你有任何想法或建议，请随时告诉我。

📜 许可证
本项目采用 MIT 许可证。详情请见 LICENSE 文件。