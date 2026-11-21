# 安装剪前看看发型咨询 Skill

保持整个文件夹一起解压。安装器需要 Python 3.10 或以上。

- **Windows**：双击 **Install Skill.cmd**，或在 PowerShell 运行 `py -3 .\install-skill.py`。
- **macOS**：双击 **安装发型咨询Skill.command**，或在终端运行 `python3 install-skill.py`。
- **手动安装**：复制完整的 `hair-consultation` 文件夹到用户目录下的 `.agents/skills`。已有旧版时，安装器会在原位置升级并保存备份。可用 `--skills-dir` 指定目录。

打开新的 Codex 对话，通过 `$hair-consultation` 调用。照片分析、试戴和报告流程见 [Skill 入口](../.agents/skills/hair-consultation/SKILL.md)。PNG 图册脚本需要 Pillow，中文字体可用 `JQQ_CJK_FONT` 指定。试戴图片依赖当前 Codex 环境可用的内置图像能力。请把本人或顾客授权使用的照片和报告存入本机私有目录。
