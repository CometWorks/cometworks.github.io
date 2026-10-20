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

The token only lets Jekyll read the repo's public metadata; without it the links get a wrong base URL.
