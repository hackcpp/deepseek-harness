import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by the video workspace. */
export const NS = 'video'
/** Product copy keys owned by the video workspace. */
export type VideoKey =
  | 'mode.default'
  | 'mode.video'
  | 'projects.title'
  | 'projects.new'
  | 'projects.refresh'
  | 'projects.empty'
  | 'projects.loading'
  | 'projects.error'
  | 'preview.empty'
  | 'preview.status'
  | 'preview.duration'
  | 'timeline.subtitle'
  | 'timeline.visual'
  | 'timeline.audio'
  | 'timeline.noAudio'

/** English video-workspace dictionary. */
export const en: LocaleDictOf<'video'> = {
  'mode.default': 'DSH',
  'mode.video': 'Video studio',
  'projects.title': 'Video projects',
  'projects.new': 'New video',
  'projects.refresh': 'Refresh projects',
  'projects.empty': 'No script.json projects yet',
  'projects.loading': 'Loading video projects…',
  'projects.error': 'Could not load video projects',
  'preview.empty': 'Select a video project to preview it',
  'preview.status': 'Status: {status}',
  'preview.duration': '{seconds}s',
  'timeline.subtitle': 'Subtitles',
  'timeline.visual': 'Visuals',
  'timeline.audio': 'Audio',
  'timeline.noAudio': 'Pending narration',
}

/** Chinese video-workspace dictionary. */
export const zh: LocaleDictOf<'video'> = {
  'mode.default': 'DSH',
  'mode.video': '视频制作',
  'projects.title': '视频项目',
  'projects.new': '新建视频',
  'projects.refresh': '刷新项目',
  'projects.empty': '还没有包含 script.json 的视频项目',
  'projects.loading': '正在加载视频项目…',
  'projects.error': '无法加载视频项目',
  'preview.empty': '请选择一个视频项目进行预览',
  'preview.status': '状态：{status}',
  'preview.duration': '{seconds} 秒',
  'timeline.subtitle': '字幕',
  'timeline.visual': '画面',
  'timeline.audio': '音频',
  'timeline.noAudio': '等待旁白',
}
