---
layout: default
title: Space Engineers 2 plugin developer guide
permalink: /plugin-dev/se2/
---

# Space Engineers 2 plugin developer guide

How to write, test and publish a client plugin for Space Engineers 2. Plugins are loaded by
[Pulsar](https://github.com/SpaceGT/Pulsar) 2.2.0 or newer, which runs SE2 with `Modern.exe` (`Modern.bin` on
Linux). For Space Engineers 1 read the [SE1 guide](../se1/) instead: the two games have different APIs, so SE1
plugins and advice don't carry over.

SE2 has no dedicated server yet, so every SE2 plugin is a client plugin. Ask questions on the
[Pulsar Discord](https://discord.gg/z8ZczP2YZY): it has channels for plugin ideas and for developer questions.

Contents:

1. [Start from the template](#templates)
2. [Learn the game's internals](#internals)
3. [Patching basics](#patching)
4. [Test your plugin locally](#testing)
5. [Local runs vs. the players' PCs](#players)
6. [Fill the manifest XML](#manifest)
7. [Submit to PluginHub-SE2](#submit)
8. [Develop with AI coding agents](#ai-agents)
9. [FAQ](#faq)

## Start from the template {#templates}

There is one template: [client2-plugin-template](https://github.com/CometWorks/client2-plugin-template).

Prerequisites: Space Engineers 2, [Pulsar](https://github.com/SpaceGT/Pulsar), the .NET 10 SDK and Python 3.12
or newer. Windows and Linux both work.

1. On GitHub click **Use this template** and create your repository, then clone it.
2. Run `setup.py` and give the plugin's name in `CapitalizedWords` form. It renames the project and files,
   generates the manifest's `Id` and writes the detected `Game2` folder into `Directory.Build.props.user`,
   which is not committed.
3. Open the solution in Visual Studio, Rider or VS Code and build it once.
4. Load it into the game as a development folder (see [Test your plugin locally](#testing)) and check
   that the empty plugin can be enabled.
5. Replace the README with your plugin's description and follow the `TODO` comments in the code.

Read the template's README: it covers the settings dialog generator, debugging, the publicizer and preloader
patches. The plugin targets `net10.0`; its version is in `Version.Build.props`.

The `Plugin` class implements `Keen.VRage.Core.Plugins.IPlugin`. SE2 has no `Init` or `Update` calls like SE1:
the constructor does the setup and applies the Harmony patches, and `OpenConfigDialog()` opens the settings
screen when the player clicks the plugin's config button.

## Learn the game's internals {#internals}

SE2 is in early access and Keen documents little of its code, so you read the code itself.

- **Decompiled game code.** The `se2-dev-game-code` skill in
  [CometWorks/skills2](https://github.com/CometWorks/skills2) decompiles the game with ILSpy, copies its text
  content and indexes both for search. Run `Prepare.bat` (Windows) or `prepare.sh` (Linux) in the skill's
  folder, or let a coding agent prepare it on first use. After a game update it decompiles again. Without the
  skill, open the DLLs in the game's `Game2` folder with [ILSpy](https://github.com/icsharpcode/ILSpy),
  dnSpyEx or Rider's decompiler.
- **Other plugins.** Every plugin on PluginHub-SE2 is open source. Find similar ones in the
  [plugin list](/plugins/se2/) and read how they do it. The `se2-dev-plugin` skill downloads and indexes them
  for search.
- **Not SE1.** Many type names look familiar, but the engine changed. Check every SE1 habit against the SE2
  code.

**Never publish decompiled game code.** Keep it on your machine; it is Keen's property.

## Patching basics {#patching}

Plugins change the game by patching its methods at runtime with [Harmony](https://harmony.pardeike.net/api/index.html).

- Prefer **prefix** and **postfix** patches, declared with `[HarmonyPatch]` attributes in the `Patches`
  folder; the template applies them all with `PatchAll`. Start from the example patch there.
- Use a **transpiler** only when a prefix or postfix can't do it: it rewrites the IL once, at load, and
  breaks more easily when the game or another plugin changes the method.
- **Preloader patches** (Mono.Cecil, the template's `Preloader.cs`) are a last resort, for changed
  signatures or code that runs before static constructors. Pulsar strips the ReadyToRun precompiled code from
  an assembly it preloads, so every plugin that uses them slows down game loading.
- To reach private and internal members without reflection, enable the
  [Krafs Publicizer](https://github.com/krafs/Publicizer) as the template's README describes. Pulsar
  publicizes the same assemblies when it compiles your plugin. Without it use Harmony's `AccessTools`.
- Use a unique Harmony ID and never call `UnpatchAll()`: it removes other plugins' patches too.
- Pulsar ships Harmony 2.4.2; don't bundle your own.

The `se2-dev-plugin` skill has a step-by-step patching handbook that is just as readable for people.

## Test your plugin locally {#testing}

### Pulsar's files

Pulsar installs into `%AppData%\Pulsar` on Windows and `~/.config/Pulsar` on Linux. SE2 uses the `Modern`
data folder there: Pulsar's log is `Modern/info.log`, profiles are in `Modern/Profiles`, the compiled plugin
cache is in `Modern/GitHub` and `Modern/DevFolder`. A Pulsar update wipes the install folder except the data
folders, so keep nothing else there.

Useful command-line options:

- `-sources` shows the **Sources** button, which developers need.
- `-noSplash` skips the splash window; Pulsar skips the intro by default.
- `-profile <name>` starts with a given profile; `-safeMode` starts with all user plugins disabled.
- `-debug` launches the debugger at startup; `-debugCompileAll` compiles every plugin and lists the ones that
  fail.

### Way 1: a development folder (recommended)

Pulsar compiles your working copy from source, just as it compiles hub plugins on the players' PCs.

1. Start `Modern` with `-sources` and open **Sources**.
2. Add a development folder: your repository's folder.
3. Select the plugin's manifest XML (the one the template ships, renamed by `setup.py`). Pulsar takes the name,
   `SourceDirectories`, NuGet packages, assets and dependencies from it.
4. Enable the new entry in the plugin list. The **Debug Build** checkbox picks the build mode.

A Debug build has symbols with embedded source: attach your IDE's debugger to the game process and set
breakpoints in your plugin and in the game. A Release build is exactly what players get. New dev folders
build in Debug, so switch to Release before your final test.

Pulsar compiles only the `.cs` files, tracked and untracked but not ignored, under `SourceDirectories`. It
never runs MSBuild, so a project that builds in the IDE can still fail here. That is why this test matters.

### Way 2: deploy the DLL from the IDE

Builds deploy nothing by default. Set `Pulsar` in `Directory.Build.props.user` (`$(APPDATA)\Pulsar` on
Windows, `$(HOME)/.config/Pulsar` on Linux) or pass `-p:Pulsar=...` to `dotnet build`, and each build copies
the DLL into `Modern/Local`. The template's `.run` folder has Rider run configurations that start `Modern`
for debugging.

The deployed DLL shows up as a separate local plugin. Remove it when you are done: if it stays enabled it
hides the published version. Stop the game before building, or the old DLL is locked.

### Profiles

Save separate plugin lists as profiles: **Development** (your DLL), **Test** (your development folder, in
Release mode, before each release) and **Production** (your plugin from the hub, as players have it). Back
them up, and keep a copy of each with a `Backup` suffix in case you save over the wrong one.

### Linux {#linux}

Pulsar's Linux build runs SE2 natively, without Wine or Proton, through the Linux Compat plugin it loads
automatically. Building, deploying and debugging work as on Windows.

## Local runs vs. the players' PCs {#players}

When a player enables your plugin, Pulsar downloads your repository at the commit named in the hub manifest
and compiles it on their machine. That build differs from yours:

- **No MSBuild.** Your `.csproj`, `Directory.Build.props`, build events, resources, analyzers, source
  generators and implicit global usings are ignored. Pulsar compiles the `.cs` files under
  `SourceDirectories` with Roslyn as C# 14, in Release mode.
- **Committed files only.** Untracked files that a development folder picks up are missing on GitHub. Commit
  everything before you put the commit hash into the manifest.
- **Fixed references.** The game's `SpaceEngineers2.dll`, `VRage*.dll` and `Game2*.dll` plus Harmony,
  Newtonsoft.Json, Mono.Cecil, NLog, DiscordRPC and Microsoft.CSharp, and WinForms/WPF only on Windows.
  Anything else must come from `NuGetReferences` or an `Asset` in the manifest.
- **Different symbols.** Pulsar defines `PULSAR`, `TRACE`, `NETCOREAPP`, and `LINUX` on Linux. `DEBUG` and the
  template's `DEV_BUILD` are not defined.
- **Random assembly name.** Don't rely on `Assembly.GetName().Name` or the DLL's path.
- **Windows and Linux.** Players run both. Avoid Windows-only APIs, or restrict the plugin with `Platforms`.
- **No extra files.** Only compiled code arrives. Ship data files as assets and load them in `LoadAssets`.
  Keep settings in the folder Pulsar gives you through `GetConfigPath`, as the template does.
- **Other plugins.** Players combine your plugin with others that may patch the same methods.

Pulsar caches the compiled plugin and rebuilds it after a Pulsar or game update. Compile errors on a player's
machine end up in their `info.log`.

## Fill the manifest XML {#manifest}

The manifest tells PluginHub-SE2 and Pulsar where your code is and how to build it. The template ships it in
the repository root as `ClientPluginTemplate.xml`, renamed by `setup.py`.

```xml
<?xml version="1.0"?>
<PluginData xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="GitHubPlugin">
    <Id>3F2B9C1E-0D4A-4E57-9B8C-6A1F2E3D4C5B</Id>
    <RepoId>your-github-user/your-plugin</RepoId>
    <FriendlyName>Your Plugin</FriendlyName>
    <Author>Your Name</Author>
    <Tooltip>One line shown in the plugin list.</Tooltip>
    <Description>
        What the plugin does, how to use it and where to report bugs.

        Players can click links here, for example a Discord invite.
    </Description>
    <SourceDirectories>
        <Directory>ClientPlugin</Directory>
    </SourceDirectories>
    <Commit>0123456789abcdef0123456789abcdef01234567</Commit>
</PluginData>
```

| Element | Required | Meaning |
|---|---|---|
| `Id` | yes | Permanent identifier, a GUID from `setup.py`. Profiles and other plugins refer to it: never change it. |
| `RepoId` | yes | The GitHub repository as `owner/repo`. |
| `FriendlyName` | yes | Name in the plugin list. |
| `Author` | yes | Author shown in the list. |
| `Tooltip` | no | One-line summary in the list. |
| `Description` | no | Text of the details panel, up to 1000 characters. Indent it with the XML (the common indentation is removed), keep each paragraph on one line and separate paragraphs with a blank line. |
| `Commit` | yes | Full commit hash of the release, lowercase. Pulsar downloads and compiles exactly this commit. |
| `SourceDirectories` | no | Folders whose `.cs` files are compiled (case-sensitive). Without it every `.cs` file in the repository is compiled. |
| `NuGetReferences` | no | `<PackageReference Include="Name" Version="1.2.3" />` for each package; they must support `net10.0`. Your `.csproj` references are not used. Don't add Harmony. |
| `Asset` | no | Files to put on disk: `<Asset Name="AssetFolder" Path="ClientPlugin/Assets/" />` copies a folder from the repository and makes Pulsar call your plugin's `LoadAssets(string folder)`. `Url` downloads a file (give its `Sha256`), `Extract="true"` unpacks an archive, `Placement="Bin"` puts it next to the DLL, `Reference="true"` compiles against a downloaded DLL. |
| `DependencyIds` | no | `<Id>` of plugins that are enabled together with yours. |
| `GroupId` | no | Plugins sharing it are mutually exclusive: enabling one disables the others. |
| `Platforms` | no | `Windows`, `Linux`, comma separated. Empty means everywhere. |
| `Hidden` | no | `true` hides the plugin from the list unless it is enabled or searched for. For dependency-only or abandoned plugins. |
| `AlternateVersions` | no | Extra `<Version>` entries with a `Name` and a `Commit` that players can pick, for test builds. |

## Submit to PluginHub-SE2 {#submit}

Plugins are listed on [StarCpt/PluginHub-SE2](https://github.com/StarCpt/PluginHub-SE2).

1. Make your repository public. You can develop in a private one, but the review needs public code.
2. Commit and push the release, and put its full hash into `Commit`.
3. Test exactly that commit: clone your fork of the hub, add your manifest, add the clone as a local hub in
   Pulsar's Sources screen, disable the original hub and enable your plugin in Release mode.
4. Fork the hub, make a branch, add your manifest as `Plugins/<YourPlugin>.xml` and open a pull request.
5. A check validates the XML. A maintainer then reviews your source code by hand, which takes time.

To release an update, open a pull request that changes only `Commit`, titled like `Your Plugin 1.2.0`.
Reviewers then read the changes between the two commits.

What reviewers look for:

- Public source with a license; the commit is on the default branch.
- No committed DLLs or executables: use `NuGetReferences` or hashed `Asset` downloads.
- No telemetry, hidden network calls, self-updating code or obfuscation. Updates go through the hub.
- No changes to installed game files; settings stay in the plugin's own data folder.
- Patches that coexist with other plugins and don't cost noticeable performance.

The hub has a `SampleMod.xml` for client-side Workshop mods but no mods listed yet; ask on the Discord before
you register one. Give players a way to report bugs, and answer them. If you stop maintaining the plugin, look
for a new maintainer, say so in the README, ask for the hub entry to be hidden and keep the repository public.

## Develop with AI coding agents {#ai-agents}

Coding agents such as Claude Code work well on plugins when they have the right context.

- **Install the skills.** `npx skills add CometWorks/skills2` installs the
  [SE2 developer skills](https://github.com/CometWorks/skills2): `se2-dev` (start here), `se2-dev-plugin`
  (patching handbook, search in other plugins' code), `se2-dev-game-code` (decompiled code search),
  `se2-dev-plugin-review` (hub review) and `se2-dev-plugin-guide` (this guide). Prepare them once, or let the
  agent do it on first use. Don't mix in the SE1 skills: they describe a different game.
- **Use the template's `AGENTS.md`.** It points the agent to the skills.
- **Let the agent build.** `dotnet build` lets it build, read the errors and fix them in a loop. Ask it to
  read the game code it patches before it writes the patch.
- **Give it the evidence.** Point it at `Modern/info.log` and the game's log when something fails.
- **Test in the game yourself.** Do the Release test from [Test your plugin locally](#testing) before
  every release.
- **Review before you submit.** Run the `se2-dev-plugin-review` skill on your own repository.
- **Don't publish decompiled code**, not even in an issue or a pull request.

## FAQ {#faq}

**Which C# version can I use?** C# 14; Pulsar compiles with it. The template sets `LangVersion` to
`latestmajor`.

**Can I use NuGet packages?** Yes, `net10.0` compatible ones, declared in `NuGetReferences`.

**Can I bring data files?** Yes, as assets. Implement `LoadAssets` in your `Plugin` class.

**Is there a server plugin template?** No. SE2 has no dedicated server yet.
