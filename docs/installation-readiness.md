> 状态更新（2026-09-18）：本文保留接入前的准备记录。P0/P1 现已独立实现并通过真实 DeepSeek 验收，详见 [完成报告](progress-report.md) 和 [最新使用说明](../README.md)。下方“尚未实现”等描述为准备阶段快照，不是当前功能状态。七个上游应用仍未安装。

# 安装与接入准备

日期：2026-09-18。准备目标：在现有本地 Web 工程内分阶段吸收参考仓库的能力。尚未将任何上游仓库安装到 Codex/OpenClaw，也没有作为业务依赖安装。

## 已经准备好

- 7 个参考仓库的固定提交、文件路径、许可证初查、采用/暂缓理由已记录于 [github-research.md](github-research.md) 与 [reference-repositories.json](reference-repositories.json)。
- 现有 Windows 环境已检查：Python 3.14.5、Node 24.15.0、npm 11.12.1、Git 2.54.0。
- 第一阶段的 6 个直接 Python 依赖已安装，前端 node_modules 存在；前后端及 /api 代理的 HTTP 检查均返回 200。
- SQLite 的 projects、candidates、resumes、settings 表存在。
- 后续扩展入口已有 backend/providers/ 与 skills/；前者只有接口，后者只有示例。
- 提供只读检查脚本，可重复核对环境、表结构和服务，不输出密钥、不上传简历、不安装包。

在项目根目录执行：

```powershell
.\.venv\Scripts\python.exe scripts\check_readiness.py
```

脚本结果中的服务不可达表示需要先按 README 启动，不等于源码不可用。脚本只初查依赖和结构，不替代 pytest、前端构建与浏览器验收；上游安装数量来自版本清单，并非扫描整个电脑。

## 接入清单

| 资源 | 准备结果 | 未来方式 | 暂未安装的具体原因 |
|---|---|---|---|
| claude-hiring-assistant | 适合设计参考 | 自写岗位模板与问题生成 service | 是 Agent/提示词框架，非 FastAPI 插件；组织模板还需自备 |
| resume-integrity-checker | 中立检查格式可借鉴 | Provider + 自写 JSON 校验 | 无明确许可文件；Anthropic 专用调用需适配 |
| resume-reality-check | 证据链与评测可借鉴 | 后续独立 Evidence service | 无明确许可文件；引入 Gemini、嵌入下载和检索依赖 |
| adaptive-ai-interviewer | 轮次状态和覆盖度可借鉴 | 后续 Interview service | 代码许可待查，模型/科学计算依赖重，超出当前阶段 |
| interview-skills | 可改造的 Skill 候选 | 先设计本项目只读 Skill 格式 | LICENSE 缺失；原内容面向求职者，应用还没有 Loader |
| ResumeInterviewAnalyzer | 分层与 Prompt 管理可借鉴 | 自写轻量服务 | 整套依赖含 LangGraph、Redis、MinIO、ASR 等 |
| interview-copilot | Provider 参考优先级高 | Python 兼容接口适配器 | Electron 应用不能直接装入 React/FastAPI 后端 |

## 下一次实施的最小范围

1. **Provider 联通**：在现有接口内实现一次非流式调用，明确 Base URL 为 API 根地址；处理超时、401、429、5xx、返回结构异常，不把密钥和全文写入日志。
2. **最少依赖**：可优先复用已经作为测试依赖安装的 httpx；若生产实现采用它，再加入生产 requirements 并锁定版本。当前 openai/anthropic/google-genai 均不作为必要安装项。
3. **应用层合同**：定义需求、简历原文、能力、问题、引用的数据格式。初期问题输出包含 question、capability、resume_quote、reason，引用必须能回到保存的原文。
4. **Skill 的最小形式**：先自写项目需求与问题设计 Markdown；再增加只读、限路径的 Loader。禁用执行远程 Skill 命令，不把上游触发规则作为系统指令。
5. **一次生成闭环**：选择一个项目和候选人 → 人工点击 → 预览将使用的文本 → 生成并保存提纲。记录模型、输入版本、时间、错误状态；请求失败不丢失既有记录。
6. **数据库升级**：新增表前提供有版本的迁移和数据保留验证；当前 CREATE TABLE IF NOT EXISTS 并不是通用迁移系统。
7. **验证**：用模拟 Provider 覆盖异常和结果校验；只在完成实现、用户选定 Provider/Model 后做少量真实连接验证。

本轮准备不依赖真实 API Key；到连接验证时在本机设置页填写即可，无需在聊天中发送。云模型需要对应账号；Ollama 路径需要另行安装服务及下载所选模型，当前未验证。

## 独立试跑上游时的准备条件

- 单独工作目录和虚拟环境，不将其 requirements 安装进本工程 .venv；按锁定提交重新拉取。
- 先核对该提交的 LICENSE、实际依赖、启动脚本和端口，再执行。当前未对上游做运行验收。
- 现有 Python 3.14 已验证本项目基础依赖，但未验证七个上游的科学计算/模型依赖兼容性。需要时在独立 Python 3.11/3.12 环境先验证，不改坏当前环境。
- 试跑使用合成简历和独立 data，不指向现有数据库，不把真实候选人数据默认交给第三方模型。
- 复制许可清楚的内容时保存来源、提交、许可及修改记录；许可不清楚的仓库继续作为研究参考。

## 尚需决定的事项

- 下一阶段优先接哪一个 Provider/Model；这不妨碍本轮调研与准备完成。
- 是否另行安装“给 Codex 使用的 Skill”。它与“给 AI 面试网页接入功能”是两件事；本轮按后者准备。
- 是否准备未来分发：如准备，先确定项目自身许可证，以及现有 PyMuPDF 的许可路径。当前不更换解析器。
