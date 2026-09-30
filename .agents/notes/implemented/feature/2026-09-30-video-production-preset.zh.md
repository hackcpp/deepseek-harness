# Agent Note：视频制作 preset

状态：已实现

[English](2026-09-30-video-production-preset.md) | 中文

## 问题

通用编码 preset 能编辑 Hyperframes 项目，也能继承 Host 的媒体工具，但不会赋予会话视频制作身份、带审核门禁的流程或可供后续分镜 UI 使用的稳定脚本文档。只有工具可用性也无法阻止 Agent 在确定旁白时长前生成画面，或在用户要求前导出 MP4。

## 决策

在 `@deepseek-ai/dsh-agent-presets` 中以内置 preset 形式交付 `video`。其 scoped persona 定义三个有序阶段：写脚本、做视频、渲染导出。进入每个阶段都要求用户明确确认。第一阶段写入带版本的 `script.json` 合约，包含有序分镜、逐镜头旁白、视觉意图、素材和音频路径以及最终时长。制作阶段先创建全部旁白音轨并测量实际时长，再构建同步的 Hyperframes 分镜；HTML 动画是默认视觉媒介，AI 生成图片按分镜选择使用。导出阶段只有在用户明确要求 MP4 后才调用 `video_render`。

该 preset 挂载创建每个视频独立工程目录和落实审核边界所需的 scoped persona、文件系统、平台 Shell、用户问题和 todo 行。媒体工具保留在 Host plane：只有 `video-app` bundle 安装并启用 Qwen 语音、Evolink 图片和 Hyperframes；`@deepseek-ai/dsh-hyperframes-tools` 拥有直接的 `hyperframes` npm 依赖和随包 CLI 路径。基础 bundle 不包含任何视频媒体 row 或依赖。video profile 中的会话继承这些注册，不在 preset 内重复声明 Host rows。

内置显示 fold 和 Web locale 字典把系统信任的 `video` id 映射到本地化名称与描述键。未知或用户创作的 preset id 仍使用文件中的元数据。

内置 `video` profile 依次组合 `dsh-base`、`dsh-web-app` 和 `dsh-video-app`，并将 `video` 设为默认 Agent preset。视频 bundle 挂载一个双端 UI 插件：Host 端发现 `DSH_VIDEO_PROJECTS_ROOT`（未设置时为启动目录）下带版本的 `script.json` 项目，并只通过经过认证的 Connection 路由提供项目目录内的媒体；Client 端贡献应用模式切换、项目列表、预览以及字幕、画面和音频轨道。通用 Shell 拥有模式 slots，并将现有 Conversation 界面移动到右栏，从而保留 Markdown、工具步骤、流式输出和最终消息折叠，而不是再实现一套聊天界面。

## 考虑过的替代方案

**把视频指导加入标准模式。** 这会给所有编码会话增加持续的提示词 token 和流程约束，也不会为用户提供明确的模式选择。scoped preset 将提示词和工具组合都限制在选择视频制作的会话中。

**在 preset 内重复媒体 rows。** scoped 重复看起来更明确，但会违反一个 row 只属于一个 plane 的规则，并让同一工具 schema 在 Host 与 preset scope 间竞争。视频 bundle 负责启用工具，Loader 覆盖则证明 preset 只继承每个工具一次。

**由视频插件替换整个 Web 根布局。** 替换方案必须复制侧边栏、Conversation、详情栏、尺寸调整和 scope 所有权。通用模式 slots 让 Shell 保留这些职责，视频包只拥有自己的导航和画布。

**在视频包中复制聊天渲染器。** 这会分叉 Markdown、工具调用、推理步骤、流式输出和折叠行为。复用现有 Conversation slot 可以保持一条持久事件投影和展示路径。

**以 Markdown 保存脚本。** Markdown 易于阅读，但不是稳定的 UI 合约。带版本 JSON 为后续分镜 UI 提供有序、类型明确的字段，同时仍可由 Agent 和用户编辑。

**截图检查通过后自动渲染。** 预览成功不代表用户授权执行可能成本较高的最终渲染。persona 会停在 `ready-to-render`，并要求单独明确提出 MP4 请求。

## 后果

preset 名单和选择器增加第五种内置模式，launcher 还增加可热加载的 `video` profile。使用它的会话只获得一次 Host 媒体工具注册。Web UI 会轮询配置根目录的 `script.json` 变更，使 Agent 写入的分镜时长和素材无需将展示状态写进会话日志即可出现。随包 bundle 有意将项目发现深度限制为两层，并可通过 `DSH_VIDEO_PROJECTS_ROOT` 改变根目录；更深目录需要覆盖配置。提供方凭据、音频下载、浏览器可用性、编解码器、字体和渲染性能仍是部署要求。`script.json` schema version 1 现在是面向 UI 的合约，因此不兼容字段变更需要新版本或迁移。
