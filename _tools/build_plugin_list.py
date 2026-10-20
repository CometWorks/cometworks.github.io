"""Writes the data of the plugin list pages from local checkouts of the plugin hubs.

Usage: python3 build_plugin_list.py HUBS_DIR OUTPUT_JSON

HUBS_DIR has one checkout per hub, in a folder named after its key in HUBS.
Hidden entries are left out, as the loaders leave them out of their plugin lists.
"""

import json
import re
import subprocess
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

XSI_TYPE = "{http://www.w3.org/2001/XMLSchema-instance}type"

# Where each loader flavor runs, as (flavor, platform, runtime) named like the loader's
# Tools.Flavour, Tools.Platform and Tools.Runtime. Legacy runs on Mono under Proton.
HUBS = {
    "se1": {
        "title": "Space Engineers 1",
        "loader": "Pulsar",
        "repo": "StarCpt/PluginHub",
        "environments": [
            ("Legacy", "Windows", "CLR"),
            ("Legacy", "Proton", "Mono"),
            ("Interim", "Windows", "CoreCLR"),
            ("Interim", "Linux", "CoreCLR"),
        ],
    },
    "se2": {
        "title": "Space Engineers 2",
        "loader": "Pulsar",
        "repo": "StarCpt/PluginHub-SE2",
        "environments": [
            ("Modern", "Windows", "CoreCLR"),
            ("Modern", "Linux", "CoreCLR"),
        ],
    },
    "magnetar": {
        "title": "Magnetar",
        "loader": "Magnetar",
        "repo": "CometWorks/magnetar-hub",
        "environments": [
            ("Legacy", "Windows", "CLR"),
            ("Interim", "Windows", "CoreCLR"),
            ("Interim", "Linux", "CoreCLR"),
        ],
    },
    "quasar": {
        "title": "Quasar",
        "loader": "Quasar",
        "repo": "CometWorks/quasar-hub",
        "environments": [
            ("", "Windows", "CoreCLR"),
            ("", "Linux", "CoreCLR"),
        ],
    },
}


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    hubs_dir, output = Path(sys.argv[1]), Path(sys.argv[2])
    data = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "hubs": [read_hub(key, hub, hubs_dir / key) for key, hub in HUBS.items()],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    for h in data["hubs"]:
        print(f"{h['key']}: {len(h['plugins'])} plugins, {len(h['mods'])} mods")


def read_hub(key, hub, folder):
    entries = []
    for path in sorted((folder / "Plugins").rglob("*")):
        if path.suffix.lower() != ".xml":
            continue
        try:
            entry = read_entry(hub, path, path.relative_to(folder).as_posix())
        except ET.ParseError as e:
            sys.exit(f"{path}: {e}")
        if entry:
            entries.append(entry)
    entries.sort(key=lambda e: e["name"].casefold())
    commit = subprocess.check_output(["git", "-C", folder, "rev-parse", "HEAD"], text=True)
    envs = hub["environments"]
    return {
        "key": key,
        "title": hub["title"],
        "loader": hub["loader"],
        "repo": hub["repo"],
        "commit": commit.strip(),
        "flavors": unique(f for f, _, _ in envs if f),
        "platforms": unique(p for _, p, _ in envs),
        "plugins": [e for e in entries if e["kind"] == "plugin"],
        "mods": [e for e in entries if e["kind"] == "mod"],
    }


def read_entry(hub, path, relpath):
    root = ET.parse(path).getroot()
    if text(root, "Hidden").lower() == "true":
        return None

    is_mod = root.get(XSI_TYPE) == "ModPlugin"
    id_ = text(root, "Id")
    if is_mod:
        source = f"https://steamcommunity.com/sharedfiles/filedetails/?id={id_}"
    else:
        # Older entries have no RepoId, the loader's GitHubPlugin.RepoId falls back to the Id
        source = f"https://github.com/{text(root, 'RepoId') or id_}"

    runtimes = split(text(root, "Runtimes"))
    platforms = split(text(root, "Platforms"))
    # Same check as the loader's Tools.IsSupportedEnvironment: empty means any
    envs = [
        (f, p)
        for f, p, r in hub["environments"]
        if (not runtimes or r.lower() in runtimes) and (not platforms or p.lower() in platforms)
    ]

    tooltip = text(root, "Tooltip")
    description = unindent(text(root, "Description"))
    entry = {
        "name": text(root, "FriendlyName") or id_,
        "author": text(root, "Author"),
        "tooltip": tooltip,
        "description": "" if description == tooltip else description,
        "kind": "mod" if is_mod else "plugin",
        "source": source,
        "hub_entry": f"https://github.com/{hub['repo']}/blob/main/{urllib.parse.quote(relpath)}",
        "environments": " ".join(f"{f}/{p}" for f, p in envs),
        "flavors": unique(f for f, _ in envs if f),
        "platforms": unique(p for _, p in envs),
    }
    if not envs:
        needs = [
            " or ".join(v)
            for v in (split(text(root, "Runtimes"), False), split(text(root, "Platforms"), False))
            if v
        ]
        entry["unavailable"] = f"Unavailable: no {hub['loader']} flavor has {' on '.join(needs)}"
    return entry


def text(root, tag):
    element = root.find(tag)
    return (element.text or "").strip() if element is not None else ""


def split(values, lower=True):
    items = [v.strip() for v in re.split("[;,]", values) if v.strip()]
    return [v.lower() for v in items] if lower else items


def unindent(description):
    return re.sub(r"\n{3,}", "\n\n", "\n".join(line.strip() for line in description.splitlines()))


def unique(values):
    return list(dict.fromkeys(values))


if __name__ == "__main__":
    main()
