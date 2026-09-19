# 本地 Web 架构（P0/P1）

浏览器 React/Vite :8765 → /api 代理 → FastAPI :8766 → SQLite + 本地简历；只有连接测试、提纲生成、回答分析会调用配置的模型。

## 模块

- main.py：基础项目/候选人/上传/设置 API，本机 Host 与 Origin 保护。
- interview_api.py：预览、生成、会话、回答、人工复核及报告路由。
- interview_service.py：输入快照、脱敏、模型合同、引用/措辞校验和有上限的提纲修正。
- providers/：基类与 httpx OpenAI-compatible 实现，统一错误，不记录密钥与上游响应体。
- skills.py：受目录和大小限制的只读文本资源，内容哈希及内容随提纲保存。
- privacy.py / secrets.py：文本模式脱敏；Windows 用户级 DPAPI。
- database.py / migrations.py：基础表和版本化增量表，事务及中断任务恢复。
- runtime_lock.py：同一数据目录的运行互斥；scripts/backup.py：离线一致性备份和新目录恢复。

## 数据关系

projects → candidates → resumes → generations → sessions → turns / claim_reviews。

- generations 保存 status、输入快照 JSON、经过校验的提纲 JSON、错误和创建时间。快照包括 Provider/Model/URL、脱敏输入、问题数、Skill 内容与版本、提示词版本；不包含 Key。
- 提纲 JSON 包含 capabilities、resume_facts、claims、verification_flags、questions、可选 competitions。引文按快照文本校验，claims/facts/flags/competitions 保存零起始字符区间 [start,end)。
- sessions 保存轮次预算、当前问题、revision、busy、difficulty、声明状态。
- turns 保存本轮问题、回答、结构化分析及引用；claim_reviews 独立保存人工判断与依据。
- schema_migrations 当前版本 1，是在原第一阶段结构上的首次增量升级；启动幂等，不删旧表。
- statements 的 SUPPORTED 仅表示回答提供支持线索，不表示外部事实已验证；人工复核不会重写模型状态历史。

## 请求与一致性

预览返回内容哈希。生成重新构建快照并校验哈希，避免用户看过的内容或目标模型发生变化；同候选人并发生成被拒绝。回答使用 busy + revision 条件更新，避免重复提交或交错覆盖。处理中拒绝候选人删除、修改、会话结束。

回答分析成功后事务性写入 turn 和新状态；失败不新增本轮。服务重启将 pending 生成设为失败、清除 busy。原始未提交回答仅保留在页面内存，不持久化。

下一题先覆盖尚未问过的计划能力，再考虑模型追问和剩余计划题；面试官可选用最近的追问建议。最大轮数是停止条件，不是自动能力评分。

## 主要新增 API

- POST /api/projects/{id}/import-candidate：单文件+确认姓名/岗位，事务创建一个候选人及简历；前端逐项调用完成批量。
- GET /api/skills
- POST /api/settings/test
- POST /api/candidates/{id}/preview
- POST / GET /api/candidates/{id}/generations
- GET /api/generations/{id}
- POST /api/sessions
- GET /api/candidates/{id}/sessions
- GET /api/sessions/{id}
- POST /api/sessions/{id}/answers、/follow-up、/finish
- PUT /api/sessions/{id}/options
- POST /api/sessions/{id}/claims/{index}/review
- GET /api/sessions/{id}/report、/report.md
- PUT / DELETE /api/candidates/{id}

## 设计边界

Claim/Evidence 使用有类型的 JSON 快照与回答记录，未引入图数据库；无检索库、多 Agent 或自动录用决定。时间线核实项由模型提议并由用户复核，不属于已实现的外部事实验证。

Windows 下 Key 由 DPAPI 保护，SQLite 业务数据及简历不加密。备份移除 Key 并清理数据库空闲页；报告只在本机生成与下载。

## 2026-09-19 体验调整

前端路由 `/projects/:projectId/candidates/:candidateId` 隔离单人档案；会话接口返回候选人姓名和岗位。项目列表返回简历数、会话数和最近会话，便于继续面试。主题在 html data-theme 切换 CSS 变量，localStorage 仅保存主题。

SessionCreate 可传 opening：none/introduction/recent/expectations。开场问题 kind=opening，不在专业提纲内，但计入轮数；服务端直接记录，不调用模型，后续专业分析剔除开场历史。PlanRequest 的 interview_style 进入输入快照，默认 conversational；已有提纲不改写。

专业分析使用原 Skill 快照及脱敏后的简历来源，结构或引用出错最多修正一次。累计声明状态按已保存回合重新计算，UNKNOWN 不抹掉此前支持线索；历史模型输出保留。
