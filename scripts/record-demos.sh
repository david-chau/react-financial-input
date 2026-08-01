#!/usr/bin/env bash
#
# Records the demo GIFs in docs/.
#
# Playwright records WebM, not GIF. ffmpeg does the conversion and is
# preinstalled on GitHub's ubuntu-latest runners; locally, `brew install ffmpeg`.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. brew install ffmpeg" >&2
  exit 1
fi

rm -rf test-results docs/demo-*.gif
mkdir -p docs

# Served statically so the story is on screen before the trim point.
npm run build-storybook
RFI_STATIC_STORYBOOK=1 npx playwright test --project=demo-recording

# Two-pass palette generation, otherwise the GIF dithers badly on flat colours.
# Skips the blank frames while the story loads.
TRIM_SECONDS=0.7

to_gif() {
  local src="$1" out="$2" palette
  palette="$(mktemp -t rfi-palette-XXXXXX).png"

  ffmpeg -loglevel error -y -ss "$TRIM_SECONDS" -i "$src" \
    -vf "fps=15,scale=440:-1:flags=lanczos,palettegen=stats_mode=diff" "$palette"
  ffmpeg -loglevel error -y -ss "$TRIM_SECONDS" -i "$src" -i "$palette" \
    -lavfi "fps=15,scale=440:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    -loop 0 "$out"

  rm -f "$palette"
  echo "  $out ($(du -h "$out" | cut -f1))"
}

echo "Converting recordings:"
while IFS= read -r video; do
  # test-results/demo-demo-<name>-demo-recording/video.webm
  slug="$(basename "$(dirname "$video")")"
  slug="${slug#demo-demo-}"
  slug="${slug%-demo-recording}"
  to_gif "$video" "docs/demo-${slug}.gif"
done < <(find test-results -name '*.webm' | sort)

echo "Done."
