# @deepseek-ai/dsh-client-ui-video

[English](README.md) | 中文

`dsh-client-ui-video` 为 Web Shell 增加视频制作应用模式。Host 端发现配置项目根目录下的 `script.json` 工程，并通过经过认证的 API 路由提供项目素材。Client 端提供模式切换、项目导航、预览以及字幕／画面／音频时间线，同时复用现有 Conversation 界面与 Agent 交互。

## 模型体验

本包不增加模型可见输入。`video` profile 选择用户的 `video` Agent preset，由该 preset 的工具和提示词定义视频制作行为。
