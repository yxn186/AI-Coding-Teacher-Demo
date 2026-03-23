# 积木小老师

一个可直接双击打开 `index.html` 运行的本地原型，面向儿童做 AI 编程启蒙演示。当前版本保留了任务区、舞台区、AI 小老师区、程序区、8 个课堂任务、自由实验室、朗读、跳过朗读、静音、拖拽执行和语音示例，并补上了本地工程化拆分、持久化、调试面板、错误兜底和移动端/无障碍细节。

## 目录说明

- `index.html`：页面骨架与经典脚本加载顺序。
- `style.css`：页面样式、响应式规则、状态条、调试面板和无障碍样式。
- `config.js`：任务、积木、角色、场景、提示词和声明式校验配置。
- `state.js`：全局状态、`localStorage` 持久化、日志、状态条和统一错误/加载处理。
- `render.js`：各面板 DOM 渲染、状态条、调试面板和 live region 更新。
- `speech.js`：浏览器朗读队列、跳过朗读、静音配合。
- `api.js`：统一适配器接口和本地 mock 实现。
- `runtime.js`：任务校验、运行时、舞台动作、计时器和停止逻辑。
- `drag.js`：拖拽、触屏兜底、键盘可达的程序区操作。
- `bootstrap.js`：初始化、事件绑定、兼容导出。
- `script.js`：旧单文件入口的占位说明，不再参与实际运行。

## 运行方式

### 方式一：直接双击打开

1. 直接双击 `index.html`。
2. 用现代浏览器打开即可。

这是默认支持方式，不需要 Node、打包器或额外安装步骤。

### 方式二：本地服务调试

如果你想更接近日常前端调试，可以在项目根目录运行：

```powershell
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

这只是可选方式，不是运行前提。

## 浏览器能力要求

- 支持现代 JavaScript。
- 支持 `localStorage`。
- 支持 Pointer Events。
- 如需朗读，需要浏览器支持 `speechSynthesis`。

如果浏览器不支持朗读，页面仍然可以继续使用，只是会自动跳过语音播放。

## 本地存档

页面会自动保存以下内容到 `localStorage`：

- 当前任务
- 静音状态
- 每个任务的角色脚本
- 自由实验室场景
- 当前选中角色
- 每个角色监听的消息名

存档 key 为：

```text
jimu-app:workspace:v2
```

清空方式：

- 页面右下方“调试面板”里点“清空本地存档”
- 或者在浏览器开发者工具里删除对应 `localStorage`

如果存档损坏，页面会自动回退到默认状态，并在调试日志里记录错误。

## 如何新增任务

1. 在 `config.js` 的 `TASKS` 中新增任务配置。
2. 配好 `actors`、`allowed`、`intro`、`success`、`goal` 和 `validationPlan`。
3. 如需语音示例，在 `PROMPTS` 中新增对应 prompt。
4. 如需默认消息名，补充 `state.js` 里的 `defaultMessageName()`。

### `validationPlan` 规则类型

- `requiredSequence`：校验某个脚本槽前几个积木的顺序。
- `blockParam`：校验某个积木的参数值。
- `messageBinding`：校验“收到消息”监听名。

每条规则统一返回：

```js
{ ok, message, suggestion, focusTarget, highlightBlocks }
```

所以渲染层和提示层不需要知道具体任务编号。

## 如何接入真实 API

真实厂商只允许接到 `api.js` 这一层。

前端其他层只能调用统一接口：

```js
getTutorReply(context)
resolveVoiceIntent(input)
getHealth()
```

返回结构约定：

```js
getTutorReply(context) -> Promise<{ text, mood, suggestion, speakText? }>
resolveVoiceIntent(input) -> Promise<{ nextTaskId, selectedActorId, sceneId?, suggestedBlocks, reply }>
getHealth() -> Promise<{ provider, status }>
```

接入真实 API 时：

1. 在 `api.js` 写新的 adapter。
2. 保持返回结构不变。
3. 用 `App.api.setAdapter(newAdapter)` 切换。
4. 不要在 `render.js`、`runtime.js`、`bootstrap.js` 里直接写具体厂商请求。

## 调试与验证

页面底部提供可折叠调试面板，支持：

- 查看最近日志
- 查看当前任务、场景、静音、运行态
- 查看最近错误和最近保存时间
- 设置 mock API 延迟
- 注入下一次 API 失败
- 清空日志
- 清空本地存档

兼容导出仍然保留：

- `window.render_game_to_text()`
- `window.advanceTime(ms)`
- `window.tutorAdapter.getMessage(...)`
- `window.voiceInputAdapter.resolvePrompt(...)`
