VERSION := $(shell git describe --tags --always)

build:
	wails build -ldflags "-X 'kube-ins/internal/business.appVersion=$(VERSION)'"

dev:
	wails dev -ldflags "-X 'kube-ins/internal/business.appVersion=$(VERSION)-dev'"

.PHONY: build dev
