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

pkg-deb: build-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager deb --config ./build/nfpm.yaml --target $(DIST)/

pkg-rpm: build-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager rpm --config ./build/nfpm.yaml --target $(DIST)/

pkg-windows: build-windows

pkg-mac: build-mac
	cd build/dmg-builder && npm install --silent && VERSION=$(VERSION) node build.js

pkg-all: pkg-deb pkg-rpm pkg-windows pkg-mac

clean:
	rm -rf ./build/bin ./dist

test-e2e:
	@echo "⚠  Make sure 'make dev' is running in another terminal (http://localhost:34115)."
	cd e2e_tests && pip install -q -r requirements.txt && \
		pytest -v --html=../report.html --self-contained-html

# ── Documentation (MkDocs Material) ──────────────────────────────
# Requires mkdocs-material on PATH: pip install mkdocs-material
docs-serve:
	mkdocs serve

docs-build:
	mkdocs build --clean --strict

.PHONY: build build-linux build-windows build-mac dev pkg-deb pkg-rpm pkg-windows pkg-mac pkg-linux pkg-all clean test-e2e docs-serve docs-build
