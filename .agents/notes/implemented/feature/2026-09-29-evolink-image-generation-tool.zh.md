# Agent Note: Evolink 图片生成工具

Status: implemented

[English](2026-09-29-evolink-image-generation-tool.md) | 中文

## 问题

需要视觉输出的 Agent 没有图片生成工具。Evolink 通过异步创建与查询 API 提供 Z-Image-Turbo，而 Web 设置页面若没有 Host 设置区段，便无法控制该能力。

## 决策

`@deepseek-ai/dsh-image-generation-evolink` 只在 `video-app` bundle 中挂载，并默认注册工具。它的 `image-generation-evolink` 设置区段控制 Agent 是否能看到 `generate_image`，浏览器“插件配置”页会暂存并保存同一设置。工具调用在执行时解析 `EVOLINK_API_KEY`，创建 `z-image-turbo` 任务，并每五秒查询一次状态，直到完成或出现终止错误。结果包含任务 ID 与提供方图片 URL；harness 不保留图片字节。

`pollIntervalMs` 默认为 `5000`，使部署配置明确记录要求的轮询频率。`timeoutMs` 一并限制创建、等待与状态请求。调用方的取消信号会中止同一个操作。

## 考虑过的替代方案

**始终注册工具。** 没有 API Key 时始终失败的可见工具会让模型尝试使用用户尚未启用的能力。由设置驱动注册，可使模型可用工具与已保存开关保持一致。

**立即返回任务 ID。** 在 Agent 获得生成图片前，这需要另一个面向模型的查询工具或后台任务集成。对预期较短的任务，前台轮询可通过一次工具调用返回完整结果。

**在本地存储生成图片。** 持久媒体需要存储所有权、访问控制与保留策略。返回提供方 URL 可保留直接 API 结果，并明确显示其临时有效期。

## 后果

用户启用工具后，Agent 可以生成图片；关闭工具会从后续请求中移除 schema，无需重启 Host。每次调用在轮询期间占用一个前台工具执行，并会在配置超时后失败。提供方 URL 会在 24 小时后失效，因此下游使用方必须及时下载。提供方凭据、计费、内容审核与图片质量需要真实账户；本地测试使用替代任务响应。
