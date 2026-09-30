# Agent Note: Hyperframes Agent 工具

Status: implemented

[English](2026-09-29-hyperframes-agent-tools.md) | 中文

## Problem

Agent 可以编辑 Hyperframes 项目，但无法通过类型化工具调用项目自身的静态检查、时间线视觉检查或 MP4 渲染器。运行任意 shell 命令会暴露超出这三项操作所需的能力；Web 设置页还需要一个已保存开关，使可见工具列表与用户意图保持一致。

## Decision

`@deepseek-ai/dsh-hyperframes-tools` 是 `packages/media` 中的 Cordis 插件。只有 `video-app` bundle 以 `enabled: true` 挂载它，其 `hyperframes-tools` 设置区段会整体注册或移除 `video_lint`、`video_snapshot` 和 `video_render`。插件配置标签页保存同一个实时开关。

每个工具都通过 `ctx.subprocess` 调用随包提供的 Hyperframes CLI。子进程服务在其执行环境中解析可执行文件，应用取消与可配置截止时间，并限制两个收集流。`video_lint` 运行 `hyperframes lint --json`，并把报告的源码错误表示为成功的检查值。`video_snapshot` 把一至九个精确时间点传给 `hyperframes snapshot`，禁用自动结尾帧，并要求 Hyperframes 创建三列拼图。`video_render` 明确选择 MP4，并写入稳定的项目相对输出 `renders/render.mp4`。

## Alternatives considered

**重新实现 Hyperframes 解析与渲染。** 第二套验证器、浏览器捕获流程或视频编码器会偏离项目工具链。CLI 委托使项目语义和诊断继续由 Hyperframes 负责。

**移除设置开关并让注册不可逆。** 默认开启的工具仍需要供运维人员关闭的出口。按设置注册可以同时移除工具 schema 和执行器，且无需重启 Host。

**暴露任意 Hyperframes 参数。** 自由格式参数会把三个有界操作变成 shell 逃逸，并使输出不可预测。包装层拥有固定命令、输出路径、时间点限制和结果 schema。

**把 lint 发现项作为失败工具调用返回。** 源码错误是检查的预期结果，不是基础设施故障。成功值让 Agent 读取计数与诊断；启动失败、异常 CLI 输出和渲染失败仍然是工具错误。

## Consequences

Agent 获得与 Hyperframes 作者相同的验证器和渲染器，并具有稳定的 Agent Tool schema 与可逆注册。截图和渲染调用仍是前台操作，可能消耗大量浏览器、编解码器、CPU 和内存资源。Hyperframes 会清理项目截图目录中的图片文件，重复 MP4 渲染可能替换固定输出文件。聚焦测试会执行真实 Loader 组合并模拟子进程结果；Host 特定的 Chrome、FFmpeg、字体、编解码器和 GPU 组合仍由 Hyperframes 部署负责。
