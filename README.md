# 剪前看看 · 发型设计工作台和 Codex Skill

上传一张清楚的单人正面照，从脸廓、现有发量在两侧和发尾的分布、以及顾客想要的风格出发，做成可以选款、继续修改和回看的剪前效果。支持 **Windows 和 macOS**。

## 下载

| 下载 | 适合怎么用 |
| --- | --- |
| [整套 ZIP](downloads/JianQianKan-Skill-and-Workbench-v2.2.0.zip?raw=true) | 同时安装 Codex Skill 和使用电脑工作台 |
| [仅 Skill](downloads/hair-consultation-Skill-v2.2.0.zip?raw=true) | 在 Codex 对话里完成发型分析、试戴图册和详细报告 |
| [仅工作台](downloads/JianQianKan-Workbench-macOS-Windows-v1.2.0.zip?raw=true) | 在浏览器上传、生成和管理案例 |

[下载文件的 SHA-256](downloads/SHA256SUMS.txt)

## 打开工作台

1. 安装 [Node.js 22 或以上](https://nodejs.org/en/download)，把 ZIP 完整解压到可写的本地目录。
2. 打开 `JianQianKan-Workbench`。Windows 双击 **Start Workbench.cmd**，macOS 双击 **打开剪前看看工作台.command**。首次运行需要联网安装锁定依赖。
3. 浏览器打开 `http://127.0.0.1:4332/`。上传清楚的正面照，选类型、风格和发长。点「保存并分析」看脸廓观察与文字方案，点「生成案例」制作图片。

一键试戴需要安装官方 [Codex CLI](https://developers.openai.com/codex/cli)，用自己的 ChatGPT 账号登录，并在当前环境中具备内置图像能力。可以用 `codex login status` 核对登录。工作台也可导入通过 Codex 对话制作的效果图。

工作台支持发型设计、发型加发色、同剪法比发色和同剪法比卷度。新案例先做一张保持原发型的干净基准照，再做 1–2 款。有基准以后，每批最多做 3 款。选中某款可继续微调或换组，旧版会保留在历史里。报告可以在浏览器打印或保存 PDF。[启动与旧案迁移](JianQianKan-Workbench/启动与迁移.md) · [工作台操作说明](JianQianKan-Workbench/workbench/README.md)

打开案例里的「发色分析」，默认先微整理凌乱发束，也可以选择已出图的造型。12 款配色可以一次选齐，再分批生成。整组固定发型、光线与浅米灰背景，试戴图可逐张放大，报告会汇总同轮结果。

## 使用 Codex Skill

解压 Skill 包。安装 Python 3.10 或以上后，Windows 双击 **Install Skill.cmd**，macOS 双击 **安装发型咨询Skill.command**。也可以把整个 `hair-consultation` 文件夹放到用户目录下的 `.agents/skills`。直接克隆仓库后在项目目录打开 Codex，也能发现项目自带的 Skill。[Skill 文档](.agents/skills/hair-consultation/SKILL.md) · [Codex Skills 说明](https://developers.openai.com/codex/skills)

在新对话里附上获准使用的照片，例如：

> 使用 $hair-consultation，先做一张保留本人辨识特征的干净基准照，再按脸廓推荐轮廓明显不同的发型。把实际生成的候选按编号排版，另做同款发色对照。

对话 Skill 可以把多轮图片汇总成完整设计图册和个人形象报告，加入首选多角度设计、颜色对照和理发沟通卡。未拍摄的角度标注为 AI 推测视图。公开参考库为标有日期的设计提示词与来源，未附作者原图。

## 数据与源码

工作台只监听本机。照片初筛与文字规划在本地运行。点击生成试戴时，照片会按本次确认的用途交给 Codex 处理。顾客案例、照片、报告和账号由每位使用者在自己的环境中管理。

源码位于 [.agents/skills/hair-consultation](.agents/skills/hair-consultation) 和 [JianQianKan-Workbench](JianQianKan-Workbench)。从源码运行时，在工作台目录执行 `npm ci` 和 `npm run start:workbench -- --open`。Windows 使用本地 WASM 模型，macOS 优先使用 Apple Vision，两者共享方案生成与历史逻辑。
