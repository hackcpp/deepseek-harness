# Agent Note: 千问语音生成工具

Status: implemented

[English](2026-09-29-qwen-speech-generation-tool.md) | 中文

## Problem

需要语音输出的 Agent 没有从文字生成音频的工具。如果没有已挂载的 Host 设置区段，Web 设置页也无法控制这种能力。

## Decision

`@deepseek-ai/dsh-speech-generation-qwen` 只挂载在 `video-app` bundle 中，初始即注册工具。`speech-generation-qwen` 设置区段控制 Agent 是否能看到 `generate_speech`。浏览器的插件配置标签页对同一设置进行暂存和保存。工具调用接收文字与 Qwen3-TTS 音色 ID，在执行时解析 `DASHSCOPE_API_KEY`，并发送一次非流式 DashScope 请求。结果携带提供方的音频 URL 与过期时间；harness 不保留音频字节。

## Alternatives considered

**要求明确选择启用。** 这样可以避免在凭据配置前暴露工具，但也会让内置能力在用户找到对应设置前不可见。默认注册可让工具立即可用，同时保留设置开关作为明确的关闭方式。

**本地存储音频。** 持久化媒体需要归属与保留策略。返回提供方 URL 保留直接 API 结果，并向模型暴露其过期时间。

## Consequences

Agent 默认即可请求指定的受支持音色，用户也可以在设置中关闭工具。在提供方凭据配置完成前，调用仍会返回明确错误。返回的 URL 会过期，下游使用者必须在报告的时间之前下载。提供方凭据与支持的音色需要真实账户；本地测试使用模拟的提供方响应。
