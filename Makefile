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

dev:
	wails dev -ldflags "-X 'kube-ins/internal/business.appVersion=$(VERSION)-dev'"

pkg-deb: build-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager deb --config ./build/nfpm.yaml --target $(DIST)/

pkg-rpm: build-linux
	mkdir -p $(DIST)
	VERSION=$(VERSION) $(NFPM) pkg --packager rpm --config ./build/nfpm.yaml --target $(DIST)/

pkg-windows: build-windows

pkg-all: pkg-deb pkg-rpm pkg-windows

clean:
	rm -rf ./build/bin ./dist

.PHONY: build build-linux build-windows dev pkg-deb pkg-rpm pkg-windows pkg-linux pkg-all clean
