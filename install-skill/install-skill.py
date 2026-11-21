#!/usr/bin/env python3
"""Install the local bundled Skill without moving existing user files out of reach."""
import argparse
import os
from pathlib import Path
import shutil
import sys
import tempfile
from datetime import datetime, timezone

def install(bundle, skills):
    starter = bundle / "SKILL.md"
    if not starter.is_file() or "\nname: hair-consultation\n" not in starter.read_text("utf-8"):
        raise ValueError("未找到配套的 hair-consultation/SKILL.md。请解压完整的技能目录。")
    skills = skills.expanduser().resolve()
    target = skills / "hair-consultation"
    if target.is_symlink():
        raise ValueError("现有 Skill 是符号链接。请手动选择要保留的目录。")
    if target.exists() and bundle.samefile(target):
        print(f"已安装：{target}")
        return
    # Keep the backup beside, not inside, the discovery folder.
    skills.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".hair-install-", dir=skills.parent) as tmp:
        staging = Path(tmp) / target.name
        shutil.copytree(bundle, staging, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store", "*.pyc"))
        backup = None
        if target.exists():
            tag = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            backup_home = skills.parent / "skill-backups"
            backup_home.mkdir(parents=True, exist_ok=True, mode=0o700)
            backup = backup_home / (target.name + "-" + tag)
            target.rename(backup)
        try:
            staging.rename(target)
        except BaseException:
            if backup and not target.exists():
                backup.rename(target)
            raise
    print(f"已安装：{target}")
    if backup:
        print(f"旧版备份：{backup}")
    print("在 Codex 中输入 $hair-consultation；若列表还未更新，重新打开 Codex 对话。")

def default_dir():
    portable = Path.home()/".agents"/"skills"
    legacy = Path(os.getenv("CODEX_HOME") or Path.home()/".codex")/"skills"
    # Upgrade an existing Codex-only installation in place instead of creating two invocations.
    if (legacy/"hair-consultation").is_dir() and not (portable/"hair-consultation").exists():
        return legacy
    return portable

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8', errors='backslashreplace')
    sys.stderr.reconfigure(encoding='utf-8', errors='backslashreplace')
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--skills-dir", type=Path, default=default_dir())
    args = ap.parse_args()
    here = Path(__file__).resolve().parent
    source = here/"hair-consultation"
    if not source.is_dir():
        source = here.parent/".agents"/"skills"/"hair-consultation"
    install(source, args.skills_dir)

