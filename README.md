# cometworks.github.io

Contents of the cometworks.github.io Web page.

## Plugin list

The pages under `/plugins/` list the plugins and mods of the four plugin hubs:
[PluginHub](https://github.com/StarCpt/PluginHub), [PluginHub-SE2](https://github.com/StarCpt/PluginHub-SE2),
[magnetar-hub](https://github.com/CometWorks/magnetar-hub) and [quasar-hub](https://github.com/CometWorks/quasar-hub).
The `Pages` workflow checks out the hubs, runs `_tools/build_plugin_list.py` to write `_data/plugins.json`,
then builds the site with Jekyll and deploys it. It runs on every push to `main` and once a day.

To build it locally, clone the hubs into `_hubs/se1`, `_hubs/se2`, `_hubs/magnetar` and `_hubs/quasar`, then:

```sh
python3 _tools/build_plugin_list.py _hubs _data/plugins.json
JEKYLL_GITHUB_TOKEN=$(gh auth token) docker run --rm -u $(id -u):$(id -g) -v "$PWD":/src \
  -e JEKYLL_GITHUB_TOKEN -e PAGES_REPO_NWO=CometWorks/cometworks.github.io -e HOME=/tmp \
  --entrypoint bash ghcr.io/actions/jekyll-build-pages:v1.0.13 \
  -c 'cd "$BUNDLE_APP_CONFIG" && bin/github-pages build --source /src --destination /src/_site'
```

The token is optional for public metadata. `_config.yml` sets the canonical URL explicitly.

## Website design and theme

The homepage and all catalogue pages share `_layouts/default.html` and
`assets/site.css`, with self-hosted DM Sans and Manrope (licenses in
`assets/fonts/`). `assets/brand/cometworks-mark.png` is the unmodified simplified
CometWorks logo used by server-list, also used as the favicon.

System is the default theme. `assets/theme.js` runs before the stylesheet and
reads `cometworks-theme` from localStorage. Explicit Light/Dark choices persist;
System follows OS changes. Without JavaScript, CSS follows the OS and the full
static plugin catalogue remains readable. Hub entries and descriptions continue
to come from the daily generator; no catalogue data is maintained by hand.

The same GitHub Pages build image also works with rootless Podman (no token is
needed with this site's explicit URL configuration):

```sh
podman run --rm --userns=keep-id -v "$PWD":/src:Z \
  -e PAGES_REPO_NWO=CometWorks/cometworks.github.io -e HOME=/tmp \
  --entrypoint bash ghcr.io/actions/jekyll-build-pages:v1.0.13 \
  -c 'cd "$BUNDLE_APP_CONFIG" && bin/github-pages build --source /src --destination /src/_site'
python3 -m http.server 4123 --directory _site
```

For the focused browser integration check, use an externally installed Playwright
package and Chromium; these are development tools, not site dependencies. Run
from the repo after generating the real hub data and building/serving `_site`:

```sh
# Omit these variables if Playwright and its browser are installed normally.
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROME_PATH=/usr/bin/google-chrome \
  node _tools/check_site.cjs
# Optional: SITE_URL=http://localhost:PORT SCREENSHOTS=/tmp/site-screenshots
```

The check covers themes before CSS, persistence, OS changes, keyboard controls,
unavailable/corrupt storage, all six pages in both themes at 320/390/768/1440px,
real generated entry links and counts, search, compatibility, compatible-first
ordering, hiding/resetting, descriptions, and the no-JavaScript fallback.
