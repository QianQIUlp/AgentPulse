# AgentPulse

[English](README.md) | 简体中文

AgentPulse 是一个面向 AI 编程代理的通用活动监控层。它不是某一个工具的通知器，而是一个轻量的观测入口，用来把不同 AI coding agent 的关键活动汇总到一致的通知与回退输出中。

当前目标很克制：提供稳定的 CLI、真实可验证的 agent 接入、可预测的失败行为，以及清晰的文档边界。

## 适合谁使用

- 想同时使用 Claude Code、Codex CLI 或其他 AI coding agent 的开发者。
- 想观察 agent 关键事件，而不是不断盯着终端的人。
- 想为新的 agent / IDE / CLI 编写 adapter 的贡献者。
- 想研究 AI coding agent 工作流可观测性的开源协作者。

## 当前能力

- CLI 入口：`agentpulse`
- Claude Code ingest