# npm 1.0.0 installed skill fixture

`installed-1.0.0.json.gz` is a gzip-compressed JSON map from relative paths to the 64 installed UTF-8 skill files. It was captured by running `node package/bin/deskstudio.mjs add --agent codex` from the published `deskstudio@1.0.0` tarball in an empty project. The installer rewrites plugin paths, so these are the installed bytes rather than the package source bytes.

npm tarball SHA-1: `5e691f598b4fd0c4a80c02caaed533f8fea21c25`.

npm integrity: `sha512-XeZpKQPoq0nBnrl4fOMJUuWZKVZZ/4vC1FuRj4XUaZSInAuWXbPQxzI0HlnyrK7F6wQAL7caOrr6UlZ+PACwvw==`.

The matching SHA-256 hashes ship in `packages/deskstudio/bin/installed-1.0.0.json` for projects installed before manifests existed. The fixture is frozen so migration tests need no network and still exercise every historical file after the current briefs change.
