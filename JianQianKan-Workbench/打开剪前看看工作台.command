#!/bin/zsh
set -e
export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}"
if ! command -v node > /dev/null || ! command -v npm > /dev/null; then
  print -u2 "请先安装 Node.js 22 或以上版本，再双击这个文件。https://nodejs.org/"
  exit 1
fi
exec node tools/start-release.mjs --open "$@"
