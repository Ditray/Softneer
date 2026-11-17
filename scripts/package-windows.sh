#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
  printf '%s\n' "Usage: $0 electron-v44.11.3-win32-x64.zip SHASUMS256.txt /absolute/path/to/output.zip" >&2
  exit 2
fi

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_zip=$1
runtime_sums=$2
output_zip=$3
case "$output_zip" in
  /*) ;;
  *) printf '%s\n' 'Output path must be absolute.' >&2; exit 2 ;;
esac
if [ -e "$output_zip" ]; then
  printf '%s\n' "Output already exists: $output_zip" >&2
  exit 2
fi

release=electron-v44.11.3-win32-x64.zip
expected=$(awk -v file="*$release" '$2 == file { print $1 }' "$runtime_sums")
actual=$(shasum -a 256 "$runtime_zip" | awk '{ print $1 }')
if [ -z "$expected" ] || [ "$actual" != "$expected" ]; then
  printf '%s\n' 'Electron ZIP checksum mismatch.' >&2
  exit 1
fi

build_dir=$(mktemp -d)
trap 'rm -rf -- "$build_dir"' EXIT
bundle="$build_dir/Softneer"
assets="$bundle/resources/app"
mkdir -p "$bundle" "$assets/desktop"
unzip -q "$runtime_zip" -d "$bundle"
mv "$bundle/electron.exe" "$bundle/Softneer.exe"
cp "$root_dir/index.html" "$root_dir/styles.css" "$root_dir/package.json" "$assets/"
cp "$root_dir/desktop/main.cjs" "$assets/desktop/"
cp -R "$root_dir/src" "$assets/"
cp "$root_dir/README.md" "$bundle/README.txt"
(cd "$build_dir" && zip -q -r -X "$output_zip" Softneer)
