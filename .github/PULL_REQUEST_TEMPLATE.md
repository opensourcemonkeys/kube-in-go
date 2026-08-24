## What and why

<!-- What this changes, and the reason. The "why" matters more than the "what"
     here — it is the convention the codebase's own comments follow. -->

Closes #

## How it was verified

<!-- Commands you ran, and anything you exercised by hand against a real
     cluster. "Not tested against a live cluster" is a fine answer — say so. -->

```
make check
```

## Checklist

- [ ] `make check` passes (`go test`, `vet`, `golangci-lint`, `tsc`, ESLint, i18n parity, frontend tests)
- [ ] New user-facing strings go through `t()` and were added to **all six** locales (`npm run i18n:check` passes)
- [ ] New or changed exported `App` methods / `models` structs: bindings regenerated with `rm -rf frontend/wailsjs && make bindings`
- [ ] New goroutines go through `safego.Go`, not a bare `go func()`
- [ ] Nothing writes to `os.Stdout` (it is the Electron protocol pipe)
- [ ] `internal/tui` and `cmd/tui` stay Wails-free
- [ ] Documentation updated if behaviour changed (`docs/`, with a `description:` and a `mkdocs.yml` nav entry for a new page)
- [ ] User-visible changes noted for `CHANGELOG.md`

## Anything reviewers should know

<!-- Trade-offs, things you were unsure about, platform-specific behaviour the
     CI matrix does not cover. -->
