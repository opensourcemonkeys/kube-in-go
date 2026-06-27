VERSION := $(shell git describe --tags --abbrev=0 | sed 's/^v//')
LDFLAGS := -X 'kube-ins/internal/business.appVersion=$(VERSION)'

# The Trivy library (security scanner) depends on encoding/json/v2, which is
# gated behind the jsonv2 GOEXPERIMENT on Go 1.26. Export it so every wails/go
# invocation in this Makefile (build, dev, packaging) compiles it.
export GOEXPERIMENT := jsonv2
NFPM    := nfpm
DIST    := ./dist

# Optional Wails build tags. On distros that ship webkit2gtk-4.1 instead of
# 4.0 (Ubuntu 24.04+, Fedora 40+), build with: make build-linux WAILS_TAGS=webkit2_41
TAGS    := $(if $(WAILS_TAGS),-tags "$(WAILS_TAGS)",)

build:
	wails build $(TAGS) -ldflags "$(LDFLAGS)"

build-linux:
	wails build $(TAGS) -platform linux/amd64 -ldflags "$(LDFLAGS)"

build-windows:
	wails build -platform windows/amd64 -nsis -ldflags "$(LDFLAGS)"

build-mac:
	wails build -platform darwin/universal -ldflags "$(LDFLAGS)"

dev:
	wails dev -ldflags "-X 'kube-ins/internal/business.appVersion=$(VERSION)-dev'"

# ── Standalone terminal UI (kube-ins-tui) ────────────────────────
# A webview-free native CLI binary (cmd/tui). Plain `go build` — no wails, no
# frontend embed — so it carries no webkit2gtk dependency. GOEXPERIMENT=jsonv2
# is still required because internal/business transitively imports Trivy.
build-tui:
	go build -ldflags "$(LDFLAGS)" -o build/bin/kube-ins-tui ./cmd/tui

build-tui-linux:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o build/bin/kube-ins-tui ./cmd/tui

build-tui-windows:
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o build/bin/kube-ins-tui.exe ./cmd/tui

build-tui-mac:
	GOOS=darwin GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o build/bin/kube-ins-tui ./cmd/tui

pkg-deb: build-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager deb --config ./build/nfpm.yaml --target $(DIST)/

pkg-rpm: build-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager rpm --config ./build/nfpm.yaml --target $(DIST)/

pkg-windows: build-windows

pkg-mac: build-mac
	cd build/dmg-builder && npm install --silent && VERSION=$(VERSION) node build.js

pkg-tui-deb: build-tui-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager deb --config ./build/nfpm-tui.yaml --target $(DIST)/

pkg-tui-rpm: build-tui-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager rpm --config ./build/nfpm-tui.yaml --target $(DIST)/

pkg-all: pkg-deb pkg-rpm pkg-windows pkg-mac pkg-tui-deb pkg-tui-rpm

clean:
	rm -rf ./build/bin ./dist

test-e2e:
	@echo "⚠  Make sure 'make dev' is running in another terminal (http://localhost:34115)."
	cd e2e_tests && pip install -q -r requirements.txt && \
		pytest -v --html=../report.html --self-contained-html

# ── Documentation (MkDocs Material) ──────────────────────────────
# Requires mkdocs-material on PATH: pip install mkdocs-material

# docs/downloads.md is tracked with a __VERSION__ placeholder; substitute the
# current git tag ($(VERSION)) in place before building/serving. In CI this runs
# on a fresh checkout. Locally, `git checkout docs/downloads.md` restores the
# placeholder if you need to rebuild for a different version.
docs-downloads:
	@echo "Substituting version v$(VERSION) into docs/downloads.md"
	@sed -i 's/__VERSION__/$(VERSION)/g' docs/downloads.md
	@echo "Writing docs/version.json for v$(VERSION) (in-app update check)"
	@printf '{"version":"%s","downloadUrl":"https://kubeinspector.com/downloads/"}\n' "$(VERSION)" > docs/version.json

docs-serve: docs-downloads
	mkdocs serve

docs-build: docs-downloads
	mkdocs build --clean --strict

.PHONY: build build-linux build-windows build-mac dev build-tui build-tui-linux build-tui-windows build-tui-mac pkg-deb pkg-rpm pkg-windows pkg-mac pkg-linux pkg-tui-deb pkg-tui-rpm pkg-all clean test-e2e docs-downloads docs-serve docs-build
