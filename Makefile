VERSION := $(shell git describe --tags --abbrev=0 | sed 's/^v//')
LDFLAGS := -X 'kube-ins/internal/business.appVersion=$(VERSION)'
NFPM    := nfpm
DIST    := ./dist

build:
	wails build -ldflags "$(LDFLAGS)"

build-linux:
	wails build -platform linux/amd64 -ldflags "$(LDFLAGS)"

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

.PHONY: build build-linux build-windows build-mac dev pkg-deb pkg-rpm pkg-windows pkg-mac pkg-linux pkg-all clean
