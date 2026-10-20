# Your first contribution

You can help without running a model. Start with a host you use or a small JavaScript test, then send one focused pull request. Read the [code of conduct](../CODE_OF_CONDUCT.md) and [contribution guide](../CONTRIBUTING.md) before starting.

## Pick an open task

| If you use or know | Start here | Files to read | Check |
| --- | --- | --- | --- |
| Cursor | [Setup guide, #3](https://github.com/adityareddy-dev/deskstudio/issues/3) | `packages/deskstudio/bin/deskstudio.mjs`, `scripts/build-adapters.mjs` | Install twice in a disposable project, keep existing instructions and an edited brief |
| Copilot | [Setup guide, #4](https://github.com/adityareddy-dev/deskstudio/issues/4) | Same installer and adapter source | Check `.github/copilot-instructions.md` and `.agents/skills/desk/`, including a second install |
| JavaScript tests | [Safe-zone boundaries, #5](https://github.com/adityareddy-dev/deskstudio/issues/5) | `proof/check.mjs`, `proof/test/` | Synthetic boxes exactly on, then one pixel outside, each edge |
| JavaScript tests | [Required copy, #6](https://github.com/adityareddy-dev/deskstudio/issues/6) | `checkCopy` in `proof/check.mjs`, `proof/test/` | Small synthetic DOM cases for the matching behavior described in the issue |

Check each issue's status, assignee and recent comments before starting. If it is taken or closed, use the [current starter issue list](https://github.com/adityareddy-dev/deskstudio/contribute). Comment with the change you want to make and any question about scope. Read the issue body for its full acceptance criteria.

The [new desk issues](https://github.com/adityareddy-dev/deskstudio/issues?q=is%3Aissue%20is%3Aopen%20label%3Aenhancement) also need design judgment, registry changes and regenerated files. The test or setup-guide tasks above are smaller places to start.

## Get a working copy

Fork the repo on GitHub, clone your fork and create a branch. Replace `YOUR-USERNAME` in the URL:

```sh
git clone https://github.com/YOUR-USERNAME/deskstudio.git
cd deskstudio
git switch -c docs/my-setup-guide
npm ci
```

Use Node.js 20 or newer, CI uses 22. `npm ci` needs no model account. For a synthetic proof test, run just your new file while working:

```sh
node --test proof/test/YOUR-FILE.test.mjs
```

For the complete test suite, install the browser and media prerequisites in [CONTRIBUTING.md](../CONTRIBUTING.md#run-the-checks), then run `npm test`. No tests require paid model calls. Browser rendering and motion tests do need those local prerequisites.

## Change the source

`README.md` comes from `site/readme.mjs`. Edit the generator, then run `node site/readme.mjs`. If you change a role brief or registry entry, regenerate agents and adapters as the contribution guide describes. Do not hand-edit generated files.

Keep setup examples disposable. The installer writes instructions and skills into the project you run it from. Do not test it in a private project and attach the resulting files to an issue.

## Send the pull request

Push your branch and open a pull request against `main`. Link the issue, describe the observed change and include the exact check command and result. If a local prerequisite blocked a check, say which one. For a setup guide, name the host and version you actually tried, and say what the second install preserved.

Maintainers can then reproduce the check without a model account. If you find a separate bug, open a focused issue rather than expanding the same pull request.
