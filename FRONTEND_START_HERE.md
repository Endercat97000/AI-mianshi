# 前端接手：从这里开始

交付日期：2026-09-19。本压缩包是可继续开发的源码工程，不是给甲方安装的成品安装包。

## 先启动

解压到可写目录，进入 `ai-interviewer`。需要 Python 3.11+、Node.js 22.12+。

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt -c backend\requirements-lock.txt
cd frontend
npm.cmd ci
cd ..
```

打开两个 PowerShell 窗口，分别运行：

```powershell
# 窗口一，工程根目录
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8766
```

```powershell
# 窗口二，工程根目录
cd frontend
npm.cmd run dev
```

浏览器打开 http://127.0.0.1:8765 。API 文档：http://127.0.0.1:8766/docs 。后端首次启动自动建库。

包内没有原作者的数据库、API Key 或个人简历。首页第一次为空是正常现象。可使用 `docs/examples/陈亦舟-虚构简历.txt` 建一个虚构候选人；批量导入支持 PDF/DOCX/TXT。历史报告中项目/会话编号属于原作者本机，不能在新数据库直接访问那些编号。

基础页面、上传解析、批量导入、深浅色不需要 Key。真实生成提纲和专业回答分析需要在设置页填写接手者自己的模型配置。已实测 DeepSeek 的具体配置见 README；不在聊天、源码或截图里粘贴 Key。

## 前端优先看这些文件

| 文件 | 内容 |
| --- | --- |
| frontend/src/main.tsx | 首页、项目列表、单人档案、设置、hash 路由、主题切换 |
| frontend/src/BatchImport.tsx | 多文件预览、姓名确认、逐项导入与失败提示 |
| frontend/src/workflow.tsx | 提纲、Skill 选择、常规开场、面试过程、记录与报告 |
| frontend/src/api.ts | fetch 封装与业务类型 |
| frontend/src/style.css | 基础布局与组件样式 |
| frontend/src/theme.css | 深浅色变量、候选人卡片、移动布局 |
| frontend/vite.config.ts | `/api` 代理到 8766 |
| backend/interview_models.py | 请求及模型输出的完整合同 |

React + TypeScript + Vite，没有额外 UI 框架、路由库或状态管理库。不要为视觉调整引入复杂 Agent 或重新实现后端。

页面入口：`#/` 首页；`#/projects/:id` 候选人工作台；`#/projects/:projectId/candidates/:candidateId` 独立档案；`#/sessions/:id` 单人面试；`#/skills` 资源；`#/settings` 配置。

## 用户最在意的体验

- 多份简历导入后，一人一页，当前面试对象始终清楚。
- 有深色模式，桌面和窄屏均可用。
- 面试要有轻松的常规话题，不能一直像盘问简历真实性。
- 让面试官掌握节奏，专业依据作为参考收起，不抢占当前话题。
- 竞赛参考价值不一定依赖官方资料；评价方式用户还在考虑。不要擅自做绝对排名或补成“官方认证”。

当前有三种开场可选，开场只记录、不调用模型评判，也不进入后续专业分析历史。自然交流是默认生成风格，但模型提问质量仍待真人试用校准。

## 接口与数据约束

- 文件上传使用 FormData；批量是逐份调用 `POST /api/projects/{id}/import-candidate`，一文件一人。字段为 file、name、role。不要把一批简历都挂到同一个人下面。
- 生成前先 preview，再带 preview_hash 提交；表单变化需重新预览。
- 回答、结束、选追问需要当前 revision；409 表示状态过期，应刷新而不是盲目覆盖。
- 当前未提交回答仅在页面内存，不要在换人/跳题时无提示丢弃用户输入。
- Skill 是只读提示资源，不是可执行插件；页面显示选中并不等于模型一定遵守。详细说明在 `docs/handoff.md`。
- 原简历、生成输入快照、回答、人工复核是不同来源，不要混成“已核实事实”。
- 主题只保存到浏览器 localStorage；候选人资料不应随手存进去。

## 未完成的工作在哪里

详细清单：[docs/remaining-goals.md](docs/remaining-goals.md)。建议先讨论专业题编辑/跳过、面试计时、候选人反问及收尾、原话和面试官摘要的区分，再决定 UI。Windows 正式运行包和多人部署也未完成。

[docs/handoff.md](docs/handoff.md) 记录架构、Skill、设计取舍和已知局限；[docs/verification-experience.md](docs/verification-experience.md) 记录最近验收。`docs/ui-reference/` 是纯虚构数据的现有界面参考截图，不是必须照抄的设计稿。

## 修改后检查

```powershell
cd frontend
npm.cmd run build
```

涉及接口时另跑后端测试：

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt -c backend\requirements-lock.txt
.\.venv\Scripts\python.exe -m pytest backend\tests -q
```

截至交接，26 项后端测试通过。两条依赖弃用警告尚在，详情见验收记录。源码中的测试 Key 均是假的测试常量。

本包未配置或上传 GitHub 远端。后续由用户明确指定仓库；不要提交 data、.env、node_modules、.venv 或临时输出。准备正式分发时还需确认项目许可与 PyMuPDF 的许可路线。
