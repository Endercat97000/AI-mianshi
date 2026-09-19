# GitHub 调研与接入结论

调研日期：2026-09-18。依据：用户提供的《AI面试项目总设计_v4.md》第 37、68–70 节及 7 个仓库的实际源码。

> 后续状态：P0/P1 已按上述借鉴方向独立实现；本文件中的“此次工作”指此前研究轮次。见 [完成报告](progress-report.md)。

## 调研时结论

7/7 仓库均完成 README、目录、关键实现和许可文件初查，具体提交 SHA 见 [版本清单](reference-repositories.json)。此次工作是安装/接入准备，没有安装或执行上游应用、没有复制代码到业务目录、没有启用外部 Skill，没有调用付费模型。

这些资源包含提示词框架、Skill、Python 工具和完整应用，并非 7 个可直接装入本系统的插件。当前应用没有插件协议或 Skill Loader，把仓库放入 skills/ 不会使其生效。

研究用源码文本保存在 Git 忽略的 output/research/，不是生产依赖。GitHub API 返回 403 限流后，改用 git ls-remote 获取提交并读取该提交的源码归档。没有运行其中的安装脚本；上游 AI.md、CLAUDE.md、SKILL.md 中的命令仅作为研究材料。

## 逐仓库记录

### claude-hiring-assistant

- **形态**：Claude Code / Copilot 的招聘评估提示词框架，不是 Python 插件。
- **观察**：岗位 rubric 与组织配置分离；标准问题、补缺问题和面试笔记有不同职责。fact-checker 要求按评估日期复核原始日期和计数，不能将模型报告当原始事实。
- **接入决定**：借鉴能力模板和事实复核步骤，用普通 Python service 实现；暂不引入多 Agent、录用阈值和自动评分。上游 interview-prep 引用组织自备的 interview_template.md 与问题库，公开示例目录没有完整配套，不能当开箱即用题库。
- **许可证初查**：根目录 LICENSE 为 MIT；若后续复制允许复用的内容，保留许可证和归属。
- **源码依据**：[AI.md](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/AI.md)、[CLAUDE.md](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/CLAUDE.md)、[.claude/agents/fact-checker.md](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/.claude/agents/fact-checker.md)、[.claude/agents/interview-prep.md](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/.claude/agents/interview-prep.md)、[.claude/agents/interview-assessor.md](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/.claude/agents/interview-assessor.md)、[.org/example/rubrics/ic_rubric.md](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/.org/example/rubrics/ic_rubric.md)、[LICENSE](https://github.com/mtgibbs/claude-hiring-assistant/blob/8eab920c0588c1c85008869215d2161b611d7e37/LICENSE)

### resume-integrity-checker

- **形态**：调用 Anthropic 的 Python CLI；依赖 anthropic、python-dotenv、pypdf。
- **观察**：将模型调用、JSON 解析、字段校验、中立措辞检查和 CSV 输出分开；测试区分不联网的伪客户端测试和显式启用的真实模型评测。
- **接入决定**：借鉴“观察 + 待确认事项”的输出格式和离线测试，后续统一走本项目 Provider。时间线识别主要来自模型提示词，不应描述成已验证的独立规则引擎。
- **许可证初查**：检查的文件树未发现 LICENSE/COPYING，不能标记为已获得代码复用许可。
- **源码依据**：[README.md](https://github.com/builtbybianca/resume-integrity-checker/blob/2e77020b88c175ee1a225efe6b2585e0dd03d1cb/README.md)、[requirements.txt](https://github.com/builtbybianca/resume-integrity-checker/blob/2e77020b88c175ee1a225efe6b2585e0dd03d1cb/requirements.txt)、[src/integrity_checker.py](https://github.com/builtbybianca/resume-integrity-checker/blob/2e77020b88c175ee1a225efe6b2585e0dd03d1cb/src/integrity_checker.py)、[tests/test_integrity.py](https://github.com/builtbybianca/resume-integrity-checker/blob/2e77020b88c175ee1a225efe6b2585e0dd03d1cb/tests/test_integrity.py)

### resume-reality-check

- **形态**：FastAPI + React 的完整应用；使用 Gemini、ONNX、tokenizers、rank-bm25。
- **观察**：先分离 claims 和原文 evidence，再做 BM25 与语义检索的 RRF 融合，最后模型判断；eval/run_eval.py 用标注样本比较输出。
- **接入决定**：借鉴原文引用和回归样本方法，现阶段不接入检索链。当前 BM25 分词用 [a-z0-9]+，中文简历需另行验证；首次运行可能下载模型，不能当纯离线零依赖模块。
- **许可证初查**：检查的文件树未发现 LICENSE/COPYING，暂不复制源码。
- **源码依据**：[README.md](https://github.com/akshayaad19/resume-reality-check/blob/e8e666629fde5eb8d2fecddaa72e551ca59248f3/README.md)、[requirements.txt](https://github.com/akshayaad19/resume-reality-check/blob/e8e666629fde5eb8d2fecddaa72e551ca59248f3/requirements.txt)、[app/extraction.py](https://github.com/akshayaad19/resume-reality-check/blob/e8e666629fde5eb8d2fecddaa72e551ca59248f3/app/extraction.py)、[app/retrieval.py](https://github.com/akshayaad19/resume-reality-check/blob/e8e666629fde5eb8d2fecddaa72e551ca59248f3/app/retrieval.py)、[app/judge.py](https://github.com/akshayaad19/resume-reality-check/blob/e8e666629fde5eb8d2fecddaa72e551ca59248f3/app/judge.py)、[eval/run_eval.py](https://github.com/akshayaad19/resume-reality-check/blob/e8e666629fde5eb8d2fecddaa72e551ca59248f3/eval/run_eval.py)

### adaptive-ai-interviewer

- **形态**：FastAPI + React 的自适应面试应用；依赖 numpy、scipy、pandas、scikit-learn、sentence-transformers。
- **观察**：CandidateState 保存轮次、已问问题、覆盖度和能力值；selector 同时考虑相关性、难度、覆盖与重复，IRT/Elo 更新在独立模块。
- **接入决定**：后续保留 session/turn/category/difficulty 字段即可，暂不引入 IRT、嵌入模型、分类器及录用概率。仓库中的模型文件未加载、题库未导入。
- **许可证初查**：仅发现 data/LICENSE 为 Apache-2.0，根目录没有明确覆盖整个应用的许可文件；data/README 说明题目有抓取来源，代码与题库权利分别待核实。
- **源码依据**：[README.md](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/README.md)、[backend/requirements.txt](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/backend/requirements.txt)、[backend/app/ml/irt.py](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/backend/app/ml/irt.py)、[backend/app/ml/selector.py](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/backend/app/ml/selector.py)、[backend/app/ml/candidate_state.py](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/backend/app/ml/candidate_state.py)、[data/LICENSE](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/data/LICENSE)、[data/README.md](https://github.com/Om236-bee/adaptive-ai-interviewer/blob/21ec2c26d6d172f82f44f94c27172f3afb6c5533/data/README.md)

### interview-skills

- **形态**：面向求职者的模拟面试 Skill，另带原生 JS 页面与 Node 扩展服务。
- **观察**：SKILL.md 编排过程，references/ 分离 JD、简历与问题设计；每道问题关联岗位要求和简历项目，并附追问方向。
- **接入决定**：是最接近“Skill 插件”的候选，但需改为招聘方、项目导向，不能照搬求职辅导和公司风格推断。INSTALL.md 的命令针对 OpenClaw，不适用于当前 FastAPI 应用；Node 扩展使用 3000 端口，也不是 Vite 插件。
- **许可证初查**：README 标注 MIT 并链接 LICENSE，但该提交文件树没有 LICENSE；先补齐许可凭据，再考虑复制 SKILL.md/references。
- **源码依据**：[README.md](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/README.md)、[INSTALL.md](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/INSTALL.md)、[SKILL.md](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/SKILL.md)、[references/jd-parser.md](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/references/jd-parser.md)、[references/resume-parser.md](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/references/resume-parser.md)、[references/question-design.md](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/references/question-design.md)、[extensions/server.js](https://github.com/jennifer88huang/interview-skills/blob/8f72957468e1a05225c20aaf7239dce514c181f7/extensions/server.js)

### ResumeInterviewAnalyzer

- **形态**：FastAPI + LangGraph + Qwen 的完整分析系统，带 ASR、Redis、MinIO、数据库与邮件客户端。
- **观察**：有 LLM 基类、客户端、服务、工作流和独立 Prompt 模块，可借鉴职责划分。
- **接入决定**：本工程保留轻量 Provider/service/prompt 分层；不安装整份 requirements。源码中有模块加载时初始化服务与固定模型设置，不能直接导入到现有应用。暂不接 ASR、邮件、LangGraph 和外部存储。
- **许可证初查**：根目录 LICENSE 为 MIT；复用内容时保留归属与许可。
- **源码依据**：[README.md](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/README.md)、[requirements.txt](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/requirements.txt)、[Base/Ai/base/baseLlm.py](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/Base/Ai/base/baseLlm.py)、[Base/Client/qwen.py](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/Base/Client/qwen.py)、[Analyzer/core/interviewAnalysis.py](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/Analyzer/core/interviewAnalysis.py)、[Analyzer/prompt/insertviewPrompt.py](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/Analyzer/prompt/insertviewPrompt.py)、[WorkFlow/base/baseWorkFlow.py](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/WorkFlow/base/baseWorkFlow.py)、[LICENSE](https://github.com/ziggy-xzding/ResumeInterviewAnalyzer/blob/5ef559216db2ff64f9d577e46914a031c73a5498/LICENSE)

### interview-copilot

- **形态**：Electron 桌面应用，服务于面试练习/回答辅助；依赖桌面与语音组件。
- **观察**：openaiCompat.js 将兼容接口调用与 UI 分开；llm.js 封装临时错误重试，流开始后不切换模型；设置本地保存。
- **接入决定**：优先借鉴 Provider 思路，在 Python 中独立实现。上游 baseURL 实际接收完整 chat/completions 地址，本项目计划使用 /v1 根地址，接入时须统一约定。暂不安装 Electron、Deepgram 和实时答题功能。
- **许可证初查**：根目录 LICENSE 和 package.json 均标注 MIT。
- **源码依据**：[README.md](https://github.com/ericwang915/interview-copilot/blob/81528e22361dc2802155472ffea27a1b1eee6f31/README.md)、[package.json](https://github.com/ericwang915/interview-copilot/blob/81528e22361dc2802155472ffea27a1b1eee6f31/package.json)、[src/main/llm.js](https://github.com/ericwang915/interview-copilot/blob/81528e22361dc2802155472ffea27a1b1eee6f31/src/main/llm.js)、[src/main/openaiCompat.js](https://github.com/ericwang915/interview-copilot/blob/81528e22361dc2802155472ffea27a1b1eee6f31/src/main/openaiCompat.js)、[src/main/settings.js](https://github.com/ericwang915/interview-copilot/blob/81528e22361dc2802155472ffea27a1b1eee6f31/src/main/settings.js)、[LICENSE](https://github.com/ericwang915/interview-copilot/blob/81528e22361dc2802155472ffea27a1b1eee6f31/LICENSE)

## 本项目采用的设计方向

1. 所有模型调用经 backend/providers/，业务层不绑定某家 SDK。
2. 项目需求、简历原文、模型推断分开保存；模型输出不能覆盖原文。
3. 每个问题记录对应能力及简历引用；没有依据时显示“待确认”。
4. 岗位知识放在 Markdown/JSON 资源中。初版只读选定文件，不执行 Skill 中的 Bash 或其他工具指令。
5. 用普通 Python service 组织流程。先做一次问题生成和存储，再逐步引入回答、追问和证据记录。
6. 默认使用合成简历做回归；模拟错误与结构校验在本地测试，真实模型连通性另行验证。

## 额外发现：现有依赖许可

本项目按第一阶段要求使用的 PyMuPDF 自身是 AGPL / 商业双许可，不能将本工程全部依赖概括为 MIT。见 [PyMuPDF 官方许可说明](https://pymupdf.readthedocs.io/en/latest/about.html#license-and-copyright)。本轮不改变用户指定的解析器；若后续要闭源分发，发布前需确定许可路径或评估替代解析器。此处是准备事项，并未完成全量依赖法律审计。

## 调研边界

这是源码与文档审阅，不是对 7 个上游项目运行成功、Windows 兼容性、模型效果或全部依赖安全性的认证。README 中的效果数字没有在本地复现。本轮未合入任何上游实现，也没有执行上游 Agent 调度指令。
