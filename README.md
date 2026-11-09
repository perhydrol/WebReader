# WebReader

在浏览器里阅读自己的书。支持 EPUB、PDF 和 TXT，无需注册，导入的图书与阅读进度保存在当前浏览器中。

**[开始阅读](https://perhydrol.github.io/WebReader/)**

A local-first web reader for EPUB, PDF and TXT. Chinese and English UI; Chinese is the default. Books stay in your browser.

## 开始使用

1. 打开网站，点击上传区域选择文件，或把文件拖入该区域。
2. 在书架打开图书。之后可从“继续阅读”返回上次的位置。
3. 在阅读设置中切换翻页或滚动，调整可用的排版与背景选项。
4. 通过目录跳转章节，或使用书内搜索查找正文。

应用设置可切换中文和 English，语言选择会在本机保留。

## 格式与阅读能力

| 格式 | 支持的阅读方式 | 边界 |
| --- | --- | --- |
| EPUB | 翻页、目录、书内搜索；可重排图书支持章节内滚动与排版调整 | 固定版式保持分页，不提供正文排版调整；不支持 DRM |
| PDF | 原始页面、连续滚动、可用的文档目录、文本选择和书内搜索 | 扫描图片没有可搜索的文本层；不提供 OCR |
| TXT | 翻页、连续滚动、自动章节目录、书内搜索与排版调整 | 优先按 UTF-8 解码，失败时回退 GB18030；内容作为纯文本显示 |

单文件导入上限：EPUB / PDF 为 250 MB，TXT 为 8 MB。文件还会经过格式检查；更完整的导入契约见 [格式校验](src/lib/formats.md)。

Markdown 不属于支持格式。旧版本遗留的 Markdown 条目仍可在书架删除，但不能打开。WebReader 不提供 DRM 解密、账号、云端书库、设备间同步或内容翻译。

### PDF 文章重排

对于有文本层的 PDF，可尝试本地文章重排，把分析得到的内容排成连续单栏；校对视图可将每页原始预览与提取的文本块并排显示。

重排不会调用模型、改写正文或补全缺失内容。复杂排版可能无法可靠还原，页面诊断会标出需要检查的内容，原始 PDF 页面始终是核对依据。实现与限制见 [PDF 阅读器](src/readers/PdfReader.md)。

## 阅读设置

外观默认跟随系统。手动选择白纸、暖纸、夜间或高对比背景后，可通过“跟随系统”恢复自动切换。

可重排 EPUB 和 TXT 支持字号、字体、行距、首行缩进和正文宽度设置。PDF 与固定版式 EPUB 不提供正文排版控件。翻页或滚动的选择按图书记忆。

TXT 按每个换行分段，无需空行；具体规则见 [TXT 源模型](src/lib/textDocument.md)。

TXT 工具栏会在空闲后隐藏，单击正文中间区域可重新显示；键盘也能聚焦“显示阅读工具栏”入口。目录、搜索和阅读设置以浮层打开。

### 额外字体

在“应用设置 → 额外字体”中可以下载 **霞鹜文楷 Regular**。下载过程中显示加载状态；成功保存后，才会出现在阅读设置的字体列表里。

字体由本站按需提供，不随首次应用缓存自动下载。下载后可离线使用；如果浏览器清除了字体缓存，需要重新下载。字体来源、大小、转换方法和许可见 [字体资源说明](public/fonts/README.md)。原书内嵌字体与系统字体不依赖这项下载。

### 键盘操作

输入文字或操作控件时，普通翻页快捷键不会接管输入。

| 按键 | 操作 |
| --- | --- |
| `←` / `PageUp` / `Shift + Space` | 上一页 |
| `→` / `PageDown` / `Space` | 下一页 |
| `T` | 打开或关闭目录 |
| `Ctrl + F` / `⌘ + F` | 书内搜索 |
| `[` / `]` | 减小 / 增大字号，限支持排版的图书 |
| `Esc` | 关闭阅读面板 |

## 安装、离线与数据保留

可通过支持安装的浏览器将 WebReader 安装为 PWA；在 iPhone 上可从 Safari 的分享菜单添加到主屏幕。

首次访问需要联网加载应用。应用资源缓存完成、图书已导入后，可在同一浏览器的离线环境中阅读。新版本准备好时，书架会出现更新入口，由你选择何时更新。

**浏览器存储不是备份。** 图书与阅读进度不会自动同步到其他浏览器或设备。清除网站数据可能删除书库；安装 PWA 或允许持久存储不能代替保留原始文件。书架中的删除操作只移除浏览器里的副本，不会删除设备上的原文件。

默认开发验收以桌面 Chrome 为主，兼顾窄屏与触控。iOS 的状态栏、键盘和安装后的视口行为还需实机验证，桌面测试不能保证这些系统界面的显示效果。

## 隐私与联网边界

- 图书文件、正文、封面、阅读进度和阅读设置保存在本机，不会上传到 GitHub 或开发者服务。
- 导入、普通阅读、书内搜索和 PDF 重排均在浏览器内进行。搜索查询与结果只保留在当前阅读会话的内存中。
- 应用资源与主动下载的额外字体来自本站；不使用运行时字体 CDN、远程图书信息查询、统计分析或遥测。
- 反馈入口引导前往 [GitHub Issues](https://github.com/perhydrol/WebReader/issues)，需联网及 GitHub 账号，内容可能公开。应用不收集反馈文字，也不自动附带图书、书架或阅读记录。

图书数据使用 IndexedDB；应用离线资源与可选字体使用各自的缓存。图书不会被复制到应用资源缓存或部署产物中。

EPUB 的脚本和外部网络访问受限制；PDF 使用 PDF.js 的 Worker 和 Canvas 渲染，不执行文档 JavaScript；TXT 中的 HTML、脚本和链接按原文显示。导入的文件仍应来自你有权阅读的来源。完整维护规则见 [AGENTS.md](AGENTS.md)。

## 本地开发

需要 Node.js 24 或更新版本，以及 [package.json](package.json) 指定的 pnpm。使用已提交的锁文件安装依赖：

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

打开终端显示的本机地址。生产构建与验证命令如下：

| 命令 | 用途 |
| --- | --- |
| `pnpm test` | 单元测试 |
| `pnpm run lint` | Oxlint 与 Stylelint |
| `pnpm run build` | TypeScript 检查与生产构建 |
| `pnpm run check` | 依次执行单元测试、lint 和生产构建 |
| `pnpm run test:e2e` | 构建生产版本，并运行 Chrome 浏览器验收 |
| `pnpm run preview` | 预览已经生成的生产构建 |

浏览器验收使用 Chrome，缺少浏览器时可运行 `pnpm exec playwright install chrome`。测试使用合成文件，不应加入真实书籍、个人文档、浏览器数据或截图。PWA 旧版本升级用例需要额外的基线构建；准备条件见 [离线与更新验收说明](e2e/text-offline.spec.md)。

### 代码导航

项目使用 React、TypeScript 和 Vite，界面采用 Konsta 的 iOS 主题与 Tailwind CSS。各格式使用独立阅读适配器。

| 入口 | 职责与文档 |
| --- | --- |
| [应用协调](src/App.md) | 书架、导入、阅读面板、偏好与格式分发 |
| [TXT 阅读器](src/readers/TextReader.md) | 解码、源位置、翻页与虚拟滚动 |
| [PDF 阅读器](src/readers/PdfReader.md) | 原始页面、文本层、文章与校对视图 |
| [本地存储](src/lib/storage.ts) | 图书、设置、进度与数据库兼容 |
| [可选字体](src/lib/optionalFont.md) | 下载、完整性校验、本机缓存与字体生命周期 |

模块的设计和契约放在代码旁的 Markdown 文档中；协作、隐私和发布规则以 [AGENTS.md](AGENTS.md) 为准。

## 构建与部署

WebReader 是静态网站，发布在 GitHub Pages 的 `/WebReader/` 子路径下，不需要应用服务器。静态资源、Worker 和应用入口保留子路径兼容。

[Deploy Pages](.github/workflows/pages.yml) 在 `main` 推送或手动触发时运行，使用锁文件安装依赖、执行项目检查，成功后上传构建并部署。其他分支和拉取请求由 [Checks](.github/workflows/checks.yml) 验证。浏览器验收在本地运行，不属于当前 GitHub Actions 流程。

`dist/` 是生成的部署产物，不手动修改，也不提交到仓库。工作流详情见 [Pages 说明](.github/workflows/pages.md)。

## 许可

项目代码采用 [MIT License](LICENSE)。第三方依赖遵循各自许可；随项目分发的霞鹜文楷遵循 [SIL OFL 1.1 及上游附加授权](public/fonts/OFL-LXGWWenKai.txt)。
