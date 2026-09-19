# AI 面试工作台（AI Interviewer）

本地运行的 AI 面试辅助系统：上传简历 → AI 生成面试提纲 → 面试官逐题记录回答 → AI 追问 → 下载面试报告。数据全部保存在本机 SQLite，不依赖云服务。

视觉风格：复古粗野主义（neo-brutalism），直角黑边、硬阴影、等宽字体、像素动画。

## 功能

- **岗位管理**：新建岗位/JD，删除岗位（级联清理候选人与面试记录）
- **简历导入**：支持 PDF / DOCX / TXT，自动解析姓名与经历
- **AI 提纲生成**：基于简历和岗位要求生成面试问题
- **面试进行**：
  - AI 推荐问题，面试官选用或跳过
  - 手动输入自定义问题
  - 根据回答 AI 追问，支持自定义追问
  - 随时结束面试，不限制问题数量
- **面试分析**：技能重合度对比、AI 建议、HR 备注（本地保存）
- **出题规则**：可自定义 AI 出题时参考的规则模板（Skill）
- **隐私脱敏**：自动替换姓名、手机号、邮箱等敏感信息后再发给模型
- **报告导出**：面试结束后下载 Markdown 证据报告
- **深色模式**、侧边栏收起、像素浮动背景

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite 7（手写 hash 路由，无 UI 框架） |
| 后端 | FastAPI + Pydantic |
| 数据库 | SQLite（本机文件，无需安装） |
| 简历解析 | PyMuPDF（PDF）、python-docx（DOCX） |
| AI 接口 | OpenAI 兼容协议（DeepSeek / OpenAI / OpenRouter / Ollama / 自定义） |

## 快速开始

### 环境要求

- Python 3.11+
- Node.js 22+

### 安装

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm.cmd install
cd ..
```

### 启动

**窗口一 — 后端（端口 8766）：**

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8766
```

**窗口二 — 前端（端口 8765）：**

```powershell
cd frontend
npm.cmd run dev
```

打开 http://127.0.0.1:8765 ，API 文档在 http://127.0.0.1:8766/docs 。

### 配置 AI 模型

首次使用进入「设置」页，填写：

- Provider：推荐 DeepSeek
- Base URL：`https://api.deepseek.com`
- API Key：你的密钥（仅保存在本机，Windows 下使用 DPAPI 加密）
- Model：如 `deepseek-flash`

点「测试已保存的连接」确认可用。

## 使用流程

1. 工作台点「+ 新建岗位 / JD」，填写岗位要求
2. 进入岗位，上传候选人简历（PDF/DOCX/TXT）
3. 打开候选人档案 → 确认脱敏预览 → 生成提纲
4. 开始面试：选用 AI 问题、填写回答、必要时追问或手动提问
5. 结束面试 → 下载 Markdown 报告

## 目录结构

```
ai-interviewer/
├── frontend/
│   └── src/
│       ├── main.tsx        # 外壳、首页、工作台、岗位 CRUD、侧边栏
│       ├── workflow.tsx    # 候选人档案、面试页、出题规则页
│       ├── api.ts          # fetch 封装
│       ├── style.css       # neo-brutalism 样式与动画
│       └── theme.css       # CSS 变量（深浅色）
├── backend/
│   ├── main.py             # 基础 API（项目、候选人、简历、设置）
│   ├── interview_api.py    # 提纲、面试、追问、报告、出题规则
│   ├── interview_service.py
│   ├── interview_models.py
│   ├── database.py         # SQLite
│   ├── migrations.py
│   ├── parsers.py          # PDF/DOCX/TXT 解析
│   ├── privacy.py          # 脱敏
│   ├── skills.py           # 出题规则读写
│   └── providers/          # OpenAI 兼容模型调用
├── skills/                 # 出题规则模板（SKILL.md）
├── scripts/                # 环境检查、备份恢复
├── data/                   # 运行时数据（不入 Git）
└── docs/
```

## 数据与隐私

- 所有数据保存在本机 `data/app.db`，简历原文在 `data/resumes/`
- API Key 在 Windows 上使用 DPAPI 加密存储，不会上传
- 脱敏模式会替换姓名、手机号、邮箱、身份证号；发送前请检查预览
- 备份与恢复见 `scripts/backup.py`

## 开发验证

```powershell
# 后端测试
.\.venv\Scripts\python.exe -m pytest backend\tests -q

# 前端构建检查
cd frontend
npm.cmd run build
```

## License

内部项目，未指定开源许可证。
