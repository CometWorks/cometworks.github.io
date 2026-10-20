---
layout: default
title: Plugin developer guide
permalink: /plugin-dev/
---

# Plugin developer guide

Plugins extend Space Engineers with native .NET code that patches the game at runtime. They are open source:
the loader compiles each one from its GitHub source on the player's PC, after a maintainer reviewed the code
for the plugin hub.

Pick your game:

- [Space Engineers 1](se1/): client plugins for [Pulsar](https://github.com/SpaceGT/Pulsar), server plugins
  for [Magnetar](https://github.com/CometWorks/magnetar), web UI plugins for
  [Quasar](https://github.com/CometWorks/quasar).
- [Space Engineers 2](se2/): client plugins for Pulsar.

Each guide covers the plugin templates, where to learn the game's internals, patching basics, testing on your
own PC, how that differs from the players' PCs, the manifest XML, submitting to the hub and developing with AI
coding agents.

The same guides are available to coding agents as the `se-dev-plugin-guide` skill in
[CometWorks/skills](https://github.com/CometWorks/skills) (SE1) and the `se2-dev-plugin-guide` skill in
[CometWorks/skills2](https://github.com/CometWorks/skills2) (SE2).

Questions go to the [Pulsar Discord](https://discord.gg/z8ZczP2YZY).
