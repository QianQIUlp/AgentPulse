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
- Claude Code ingest 命令：`agentpulse ingest claude-code`
- Linux 与 Windows standalone 发布物
- OS 通知不可用时的 console fallback
- pnpm workspace 开发流程

## 快速开始

安装依赖并运行校验：

```bash
pnpm install
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

查看 CLI：

```bash
pnpm --filter @agentpulse/cli dev -- --help
pnpm --filter @agentpulse/cli dev -- --version
```

本地验证 Claude Code ingest：

```bash
pnpm --filter @agentpulse/cli dev -- ingest claude-code
```

## 贡献入口

欢迎贡献，但请保持范围清晰。这个项目当前更适合小而可验证的改动：

- 文档修正与双语补充
- 新 agent adapter 的最小可用接入
- CLI 输出、错误处理、fallback 行为改进
- 测试覆盖与 smoke test 补充
- README、示例配置、安装说明修正

开始前请阅读：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)
- [AGENTS.md](AGENTS.md)

## 当前边界

AgentPulse 目前不承诺：

- 自动修改用户的 agent 配置
- 覆盖所有 AI coding agent
- 在无图形界面的环境中一定投递 OS 通知
- 提供 GUI、持久化仪表盘或远程同步

如果系统通知不可用，AgentPulse 应该保持可解释的 fallback 行为，而不是静默失败。

## 开发原则

- 小 PR 优先。
- 先报告问题，再提交最小补丁。
- 不把 adapter、持久化、GUI、协议设计混在一个 PR 里。
- 所有行为变更都应有测试或可复现的手动验证步骤。

## License

See [LICENSE](LICENSE).
