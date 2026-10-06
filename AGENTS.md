# AGENTS.md

## 项目概览

方言主题 2048 休闲小游戏，以上海话方言词汇替代传统数字，纯原生 HTML + CSS + JavaScript 开发。

## 技术栈

- 纯 HTML5 + CSS3 + Vanilla JavaScript
- 无框架、无构建工具、无 npm 依赖
- 使用 Python http.server 提供静态文件服务

## 目录结构

```
.
├── index.html          # 主页面（游戏结构、语音开关、方言对照表、操作说明）
├── styles/
│   └── main.css        # 全局样式（棋盘、方块、动画、语音按钮、响应式适配）
├── scripts/
│   └── game.js         # 游戏核心逻辑（移动、合并、生成、胜负判定、语音播放、操控）
├── audio/              # 方言语音资源（10 个 MP3，合并时播报）
│   ├── tile-2.mp3 ~ tile-1024.mp3
├── DESIGN.md           # 设计规范文件
└── .coze               # 项目配置（构建/运行命令）
```

## 核心功能

1. **2048 游戏逻辑**：4x4 棋盘，方块移动、碰撞合并、随机生成
2. **方言映射**：2→港都, 4→小瘪三, 8→小赤佬, 16→乡毋宁, 32→小宗桑, 64→老宗桑, 128→sasandi, 256→老屈诶, 512→老家诶, 1024→老灵诶
3. **双操控方式**：键盘方向键/WASD + 触屏滑动
4. **动画效果**：滑动过渡、合并弹跳、新方块弹出
5. **响应式布局**：PC 端 + 移动端自适应
6. **分数系统**：当前分数 + 最高分（localStorage 持久化）
7. **方言语音**：原生 `<audio>` 标签绑定音频，方块合并时播报对应词汇；默认关闭，由玩家点击开关开启，开关状态持久化；音频加载/播放失败自动容错，不阻塞游戏

## 关键文件定位

- 修改方言词汇映射：`scripts/game.js` → `DIALECT_MAP` 对象
- 修改方块颜色：`styles/main.css` → `.tile-2` ~ `.tile-1024` 类
- 修改棋盘尺寸：`styles/main.css` → `:root` 中的 `--board-size` 变量
- 修改动画时长：`styles/main.css` → `:root` 中的 `--slide-duration` 等变量
- 修改胜利条件：`scripts/game.js` → `WIN_VALUE` 常量
- 修改语音播放逻辑：`scripts/game.js` → `SoundManager` 对象
- 语音资源与方块的绑定：`index.html` → `#audio-pool` 中 audio 的 `data-value` 属性
- 语音按钮样式：`styles/main.css` → `.btn-sound` / `.sound-on` 类

## 运行方式

```bash
# 开发环境（自动热更新由 python http.server 提供静态文件）
python3 -m http.server 5000 --bind 0.0.0.0

# 访问地址
# http://localhost:5000
```
