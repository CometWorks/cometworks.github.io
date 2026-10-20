---
layout: default
title: Space Engineers 1 plugin developer guide
permalink: /plugin-dev/se1/
---

# Space Engineers 1 plugin developer guide

How to write, test and publish a plugin for Space Engineers 1. Client plugins are loaded by
[Pulsar](https://github.com/SpaceGT/Pulsar), server plugins by [Magnetar](https://github.com/CometWorks/magnetar).
For Space Engineers 2 read the [SE2 guide](../se2/) instead.

Ask questions on the [Pulsar Discord](https://discord.gg/z8ZczP2YZY): it has channels for plugin ideas and
for developer questions.

Contents:

1. [Pick a template](#templates)
2. [Learn the game's internals](#internals)
3. [Patching basics](#patching)
4. [Test your plugin locally](#testing)
5. [Local runs vs. the players' PCs](#players)
6. [Fill the manifest XML](#manifest)
7. [Submit to the hub](#submit)
8. [Develop with AI coding agents](#ai-agents)
9. [FAQ](#faq)

## Pick a template {#templates}

| Template | Pick it when | Loaded by | Hub |
|---|---|---|---|
| [client-plugin-template](https://github.com/CometWorks/client-plugin-template) | The plugin runs only in the game client. This is most plugins. | Pulsar | [PluginHub](https://github.com/StarCpt/PluginHub) |
| [server-plugin-template](https://github.com/CometWorks/server-plugin-template) | The plugin needs a server-side companion (like Multigrid Projector) or runs only on the dedicated server. | Pulsar + Magnetar | PluginHub + [MagnetarHub](https://github.com/CometWorks/magnetar-hub) |
| [quasar-plugin-template](https://github.com/CometWorks/quasar-plugin-template) | You extend the [Quasar](https://github.com/CometWorks/quasar) server control panel's web UI. | Quasar | [QuasarHub](https://github.com/CometWorks/quasar-hub) |

The server template has three projects: `ClientPlugin`, `ServerPlugin` and `Shared`, a shared project
compiled into both. Delete the project you don't need; for a single project, move the code out of
`Shared` and delete it. For a Torch plugin use the template's `last-torch-compatible` tag, not `main`:
Torch plugins don't run on Magnetar and Magnetar plugins don't run on Torch.

Prerequisites: Space Engineers, [Pulsar](https://github.com/SpaceGT/Pulsar), the .NET 10 SDK, Python 3.12
or newer, and on Windows the .NET Framework 4.8.1 Developer Pack. The server template also needs the
Space Engineers Dedicated Server and [Magnetar](https://github.com/CometWorks/magnetar).

Start a project:

1. On GitHub click **Use this template** and create your repository, then clone it.
2. Run `setup.py` and give the plugin's name in `CapitalizedWords` form. It renames the projects and files,
   generates new GUIDs (one is the manifest's `Id`) and writes the detected game folder into
   `Directory.Build.props.user`, which is not committed.
3. Open the solution in Visual Studio, Rider or VS Code and build it once.
4. Load it into the game as a development folder (see [Test your plugin locally](#testing)) and check
   that the empty plugin can be enabled.
5. Replace the README with your plugin's description and follow the `TODO` comments in the code.

Read the template's README; it covers the configuration dialog, debugging, transpiler and preloader
patches and the publicizer. The plugin's version is in `Version.Build.props`.

On Windows the projects build for `net48` (the `Legacy` Pulsar flavor) and `net10.0` (the `Interim`
flavor). On Linux they build only for `net10.0`.

Have an old plugin whose project is not in "SDK format"? Start over from the current template and move the
logic across. A coding agent does that port well.

## Learn the game's internals {#internals}

Keen documents only the Mod and PB script APIs. Plugins can reach anything in the game, so you learn from
the game's code itself.

- **Decompiled game code.** The [`se-dev-game-code`](https://github.com/CometWorks/skills) skill decompiles
  the whole client with ILSpy and indexes it for search; `se-dev-server-code` does the same for the
  dedicated server. Clone [CometWorks/skills](https://github.com/CometWorks/skills) and run `Prepare.bat`
  (Windows) or `prepare.sh` (Linux) in the skill's folder, or let a coding agent prepare it on first use.
  After a game update the skill decompiles again and can show what changed between the two versions, which
  helps you keep your plugin working. Without the skill, open the DLLs in `Bin64` with
  [ILSpy](https://github.com/icsharpcode/ILSpy), dnSpyEx or Rider's decompiler.
- **Other plugins.** Every plugin on the hubs is open source. Find similar ones in the
  [plugin list](/plugins/se1/) and read how they do it. The `se-dev-plugin` skill downloads and indexes them
  for search.
- **Mod and script API.** Many game types are also visible through the Mod API, and the Mod and PB script
  communities have years of examples. Information from before 2019 is often outdated. Do not use Keen's old
  public source archive on GitHub: it is years behind the game.

**Never publish decompiled game or server code.** Keep it on your machine; it is Keen's property.

## Patching basics {#patching}

Plugins change the game by patching its methods at runtime with [Harmony](https://harmony.pardeike.net/api/index.html).

- Prefer **prefix** and **postfix** patches. Declare them with `[HarmonyPatch]` attributes in the
  `Patches` folder; the template's `Plugin` applies them all with `PatchAll`. Look at the example patch
  there first.
- Use a **transpiler** only when a prefix or postfix can't do it. It rewrites the method's IL once, at
  load, so it can't depend on runtime state, and it breaks more easily when the game or another plugin
  changes the same method. The templates can record the IL before and after your patch.
- **Preloader patches** (Mono.Cecil, the template's `Preloader.cs`) are a last resort: for inlined
  methods, changed signatures or code that runs in static constructors. They slow down game loading.
- To reach private and internal members without reflection, enable the
  [Krafs Publicizer](https://github.com/krafs/Publicizer) as the template's README describes, and list the
  assemblies in `GameAssembliesToPublicize.cs`. Pulsar publicizes the same assemblies when it compiles your
  plugin. Without it use Harmony's `AccessTools`.
- Use a unique Harmony ID and never call `UnpatchAll()`: it removes other plugins' patches too.
- Pulsar ships Harmony 2.4.2; don't bundle your own.
- The server template's `[EnsureCode("hash")]` attribute checks that a patched method's code hasn't changed
  since you wrote the patch, so a game update disables the patch instead of crashing the game.

The `se-dev-plugin` skill has a step-by-step patching handbook (prefix/postfix, injected parameters,
`AccessTools`, transpilers, special cases, preloader) that is just as readable for people.

## Test your plugin locally {#testing}

### Pulsar's files

Pulsar installs into `%AppData%\Pulsar` on Windows and `~/.config/Pulsar` on Linux. Each flavor has a data
folder there:

| Flavor | Runs | Executable | Data folder |
|---|---|---|---|
| Legacy | SE1 on .NET Framework 4.8 (Windows only) | `Legacy.exe` | `Legacy\` |
| Interim | SE1 on .NET 10 (Windows and Linux) | `Interim.exe`, `Interim.bin` on Linux | `Interim\` if that folder exists, otherwise `Legacy\` |
| Modern | SE2 | `Modern.exe`, `Modern.bin` | `Modern\` |

Pulsar's log is `info.log` in the data folder; on Windows the game's own log is in `%AppData%\SpaceEngineers`. Create an
empty `Interim` folder next to `Legacy` to give the .NET 10 flavor its own profiles and plugin cache, so you
can test both flavors without one overwriting the other. A Pulsar update wipes the install folder except the
data folders, so keep nothing else there.

Useful command-line options:

- `-sources` shows the **Sources** button, which developers need.
- `-noSplash` skips the splash window. Pulsar skips the intro video by default (`-keepIntro` brings it
  back), so the `-skipintro` in older guides is no longer needed.
- `-profile <name>` starts with a given profile; `-safeMode` starts with all user plugins disabled.
- `-debug` launches the debugger at startup; `-debugCompileAll` compiles every plugin and lists the ones that
  fail to compile or initialize.

### Way 1: a development folder (recommended)

Pulsar compiles your working copy from source, just as it compiles hub plugins on the players' PCs.

1. Start Pulsar with `-sources` and click **Sources**.
2. Under Plugins click **Add Development Folder** and pick your repository's folder.
3. When asked, select the plugin's manifest XML (the one in the repository root). Pulsar takes the name,
   `SourceDirectories`, NuGet packages, assets and dependencies from it.
4. Enable the new entry in the plugin list. Choose Debug or Release in its settings.

A **Debug** build has symbols with embedded source: attach your IDE's debugger to `Legacy.exe` or
`Interim.exe` and set breakpoints in your plugin and in most of the game. A **Release** build is exactly
what players get. New dev folders default to Debug, so switch to Release before your final test.

Pulsar compiles only the `.cs` files: the tracked and untracked but not ignored files under
`SourceDirectories`. It never runs MSBuild, so a project that builds in the IDE can still fail here. That
is why this test matters.

### Way 2: deploy the DLL from the IDE

Builds deploy nothing by default. Set `Pulsar` in `Directory.Build.props.user` (`$(APPDATA)\Pulsar` on
Windows, `$(HOME)/.config/Pulsar` on Linux) or pass `-p:Pulsar=...` to `dotnet build`. Each build then
copies `plugin.dll`, `plugin.pdb` and the manifest as `plugin.xml` into `Legacy\Local\<PluginName>` (the
`net48` build) and `Interim\Local\<PluginName>` (the `net10.0` build). Set up a run configuration in your
IDE that starts `Legacy.exe` or `Interim.exe` with the debugger attached.

This is the fastest loop for debugging, but the deployed DLL shows up as a separate local plugin. Remove it
when you are done: if it stays enabled it hides the published version. Stop the game before building, or the
old DLL is locked.

### Profiles

Save separate plugin lists as profiles and switch between them:

- **Development**: your plugin from the DLL deployed by the IDE.
- **Test**: your plugin from the development folder. Run it before each release, in Release mode.
- **Production**: your plugin from the hub, as players have it.

Add the other plugins you use to all three. Back up the profiles, and keep a copy of each with a `Backup`
suffix in case you save over the wrong one.

### Server plugins

Magnetar uses the same mechanisms: a `Local` folder and development folders. Register a development folder
with `MagnetarConfig` (F8, **Local & Dev Folders**, pick the manifest XML), or under Quasar's dev folders if
you run the server from Quasar. The server template can deploy the `net10.0` build into `<MagnetarData>/Local`
when `MagnetarData` is set. Server plugins declare their configuration, chat commands and Quasar UI through
Magnetar's PluginSdk; see the
[`se-dev-plugin-sdk`](https://github.com/CometWorks/magnetar/tree/main/skills/se-dev-plugin-sdk) handbook.

### Linux {#linux}

Develop natively: Pulsar's Linux build (`Interim.bin`) runs Space Engineers without Wine or Proton, and
debugging works the same way as on Windows. The templates build only for `net10.0` there.

## Local runs vs. the players' PCs {#players}

When a player enables your plugin, Pulsar downloads your repository at the commit named in the hub
manifest and compiles it on their machine. That build differs from yours:

- **No MSBuild.** Your `.csproj`, `Directory.Build.props`, build events, resources, analyzers, source
  generators and implicit global usings are ignored. Pulsar compiles the `.cs` files under
  `SourceDirectories` with Roslyn as C# 14, in Release mode, with unsafe code allowed.
- **Committed files only.** Untracked files that a development folder picks up are missing on GitHub.
  Commit everything before you put the commit hash into the manifest.
- **Fixed references.** The game's DLLs plus Harmony, Newtonsoft.Json, Mono.Cecil, NLog, DiscordRPC and
  Microsoft.CSharp, and WinForms/WPF only on Windows. Anything else must come from `NuGetReferences` or an
  `Asset` in the manifest.
- **Different symbols.** Pulsar defines `PULSAR` and `TRACE`, `NETFRAMEWORK` on Legacy, `NETCOREAPP` on
  Interim and `LINUX` on Linux. `DEBUG` and the template's `LOCAL_BUILD` are not defined.
- **Random assembly name, no generated version.** Don't rely on `Assembly.GetName().Name` or the DLL's
  path. The template writes `[assembly: AssemblyVersion]` itself when `LOCAL_BUILD` is not defined.
- **Every flavor and platform.** Players run Legacy on Windows (.NET Framework), Legacy under Proton (Mono)
  and Interim on Windows and Linux (.NET 10). Test the ones you support and declare the rest out with
  `Runtimes` and `Platforms` in the manifest. Avoid Windows-only APIs if you support Linux.
- **No extra files.** Only compiled code arrives. Ship data files as assets and load them in `LoadAssets`.
  Store settings under `MyFileSystem.UserDataPath`, as the template's config does, never next to the game.
- **Other plugins.** Players combine your plugin with others that may patch the same methods. Test with
  popular plugins enabled.
- **Multiplayer.** A client plugin runs only on that player's PC. The server and the other players don't
  have it, so it can't change server-side behavior and must not break the server's authority.

Pulsar caches the compiled plugin and rebuilds it after a Pulsar or game update. Compile errors on a player's
machine end up in their `info.log`.

## Fill the manifest XML {#manifest}

The manifest tells the hub and Pulsar where your code is and how to build it. The template ships it in the
repository root, renamed by `setup.py` (the server template ships one for each hub). The same format serves
PluginHub and MagnetarHub; QuasarHub has its own.

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
| `Id` | yes | Permanent identifier, a GUID from `setup.py`. Profiles and other plugins refer to it: never change it. Older plugins use `owner/repo` here. |
| `RepoId` | yes | The GitHub repository as `owner/repo`. Without it Pulsar uses `Id`. |
| `FriendlyName` | yes | Name in the plugin list. |
| `Author` | yes | Author shown in the list. |
| `Tooltip` | no | One-line summary in the list. |
| `Description` | no | Text of the details panel, up to 1000 characters. Indent it with the XML (the common indentation is removed), keep each paragraph on one line and separate paragraphs with a blank line. |
| `Commit` | yes | Full commit hash of the release, lowercase. Pulsar downloads and compiles exactly this commit. |
| `SourceDirectories` | no | Folders whose `.cs` files are compiled (case-sensitive). Without it every `.cs` file in the repository is compiled, test projects included. |
| `NuGetReferences` | no | `<PackageReference Include="Name" Version="1.2.3" />` for each package. Your `.csproj` references are not used. Packages must support `net48` or `netstandard2.0` for Legacy; use `netstandard2.0` to cover both flavors. Don't add Harmony. |
| `Asset` | no | Files to put on disk: `<Asset Name="AssetFolder" Path="ClientPlugin/Assets/" />` copies a folder from the repository and makes Pulsar call your plugin's `LoadAssets(string folder)`. `Url` downloads a file (give its `Sha256`), `Extract="true"` unpacks an archive, `Placement="Bin"` puts it next to the DLL, `Reference="true"` compiles against a downloaded DLL. |
| `DependencyIds` | no | `<Id>` of plugins or Workshop mods that are enabled together with yours. |
| `GroupId` | no | Plugins sharing it are mutually exclusive: enabling one disables the others. |
| `Runtimes` | no | Where the plugin may load: `CLR` (.NET Framework), `Mono` (Proton), `CoreCLR` (.NET 10), comma separated. Empty means everywhere. |
| `Platforms` | no | `Windows`, `Linux`, `Proton`, comma separated. Empty means everywhere. |
| `Hidden` | no | `true` hides the plugin from the list unless it is enabled or searched for. For dependency-only or abandoned plugins. |
| `AlternateVersions` | no | Extra `<Version>` entries with a `Name` and a `Commit` that players can pick, for test builds. |

Older templates and samples show an `<AssetFolder>` element, a NuGet `<Config>` element and
`NETFramework`/`NETCoreApp` runtime names. Current Pulsar ignores or doesn't match these; use the forms
above.

For a server plugin on MagnetarHub, `SourceDirectories` lists `ServerPlugin` and `Shared`. A QuasarHub
manifest names the project to build (`ProjectPath`), the `quasar-plugin.json` package manifest and the
supported Quasar versions; copy `quasar-hub.xml` from the Quasar template.

## Submit to the hub {#submit}

| Plugin | Hub | Folder |
|---|---|---|
| Client plugin | [StarCpt/PluginHub](https://github.com/StarCpt/PluginHub) | `Plugins/` |
| Client-side Workshop mod | [StarCpt/PluginHub](https://github.com/StarCpt/PluginHub) | `Plugins/Mods/` |
| Server plugin | [CometWorks/magnetar-hub](https://github.com/CometWorks/magnetar-hub) | `Plugins/` |
| Quasar UI plugin | [CometWorks/quasar-hub](https://github.com/CometWorks/quasar-hub) | `Plugins/` |

A plugin with a client and a server part goes to both PluginHub and MagnetarHub.

1. Make your repository public. You can develop in a private one, but the review needs public code.
2. Commit and push the release, and put its full hash into `Commit`.
3. Test exactly that commit: clone your fork of the hub, add your manifest, add the clone as a local hub in
   Pulsar's Sources dialog, disable the original hub and enable your plugin in Release mode.
4. Fork the hub, make a branch, add your manifest as `Plugins/<YourPlugin>.xml` and open a pull request,
   for example titled `Add Your Plugin`.
5. A check validates the XML. A maintainer then reviews your source code by hand, which takes time.

To release an update, open a pull request that changes only `Commit`, titled like `Your Plugin 1.2.0`.
Reviewers then read the changes between the two commits.

What reviewers look for, so your plugin gets through faster:

- Public source with a license; the commit is on the default branch.
- No committed DLLs or executables: use `NuGetReferences` or hashed `Asset` downloads.
- No telemetry, hidden network calls, self-updating code or obfuscation. Updates go through the hub.
- No changes to installed game or mod files; settings stay in the plugin's own data folder.
- No unfair advantage in multiplayer and no way around the server's authority.
- Patches that coexist with other plugins and don't cost noticeable performance.

A client-side Workshop mod (one that needs nothing on the server) can be listed too: search the
`Plugins/Mods` XML files for its Workshop ID first, then copy `SampleMod.xml` into `Plugins/Mods/`, fill it
in, test it through a local hub and open a pull request. The game keeps the mod up to date, so the file needs
no updates afterwards.

Give players a way to report bugs, and answer them. If you stop maintaining the plugin, look for a new
maintainer, say so in the README, ask for the hub entry to be hidden and keep the repository public so others
can fork it.

## Develop with AI coding agents {#ai-agents}

Coding agents such as Claude Code work well on plugins when they have the right context.

- **Install the skills.** `npx skills add CometWorks/skills` installs the
  [Space Engineers developer skills](https://github.com/CometWorks/skills): `se-dev` (start here),
  `se-dev-plugin` (patching handbook, search in other plugins' code), `se-dev-game-code` and
  `se-dev-server-code` (decompiled code search), `se-dev-plugin-review` (hub review) and
  `se-dev-plugin-guide` (this guide). Prepare them once, or let the agent do it on first use.
- **Use the template's `AGENTS.md`.** It points the agent to the skills; humans can read it too.
- **Let the agent build.** The SDK-style projects build with `dotnet build`, so the agent can build, read
  the errors and fix them in a loop without you. Ask it to read the game code it patches before it writes
  the patch.
- **Give it the evidence.** Paste or point it at Pulsar's `info.log` and the game log when something
  fails; it can usually find the cause.
- **Test in the game yourself.** The agent can't see the game. Do the Release test from
  [Test your plugin locally](#testing) before every release.
- **Review before you submit.** Ask the agent to check your code against the review policy of the
  `se-dev-plugin-review` skill, the one hub reviewers use, before you open the hub pull request.
- **Keep game updates cheap.** After an update, ask the agent to compare the old and new game code of the
  methods you patch.
- **Don't publish decompiled code**, not even in an issue or a pull request.

Agents cost money if you use them a lot, but they save a lot of time on this kind of work.

## FAQ {#faq}

**Which C# version can I use?** C# 14; Pulsar compiles with it. Set `LangVersion` to `latestMinor` or 14.
Mods are limited to C# 7.3 and PB scripts to C# 6, because the game compiles those itself.

**Can I use NuGet packages?** Yes, declared in `NuGetReferences`. For the Legacy flavor they need
`net48` or `netstandard2.0`; `netstandard2.0` works on both flavors.

**Can I bring data files?** Yes, as assets. Implement `LoadAssets` in your `Plugin` class.

**Can I develop on Linux?** Yes, with Pulsar's native Linux build. See [Linux](#linux).

**How do I register a Workshop mod?** See the end of [Submit to the hub](#submit).
