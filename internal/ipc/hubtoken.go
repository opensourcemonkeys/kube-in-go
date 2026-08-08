package ipc

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// hubTokenFile holds the shared secret every kube-ins process on this account
// presents to prove it belongs to the user. The hub is cross-process, so the
// per-process token rpcserver.go mints cannot work here; a 0600 file inside the
// user's own ~/.kube-ins is the same trust boundary the kubeconfigs already sit
// behind.
const hubTokenFile = ".hubtoken"

// minHubTokenLen guards against a truncated or hand-edited file. A real token is
// 64 hex characters; anything shorter is treated as corrupt rather than used.
const minHubTokenLen = 32

// ensureHubToken returns the shared token, creating it if this is the first
// process to start.
//
// It is create-or-read rather than "whoever becomes the hub server writes it":
// the process that wins net.Listen is not necessarily the one that gets here
// first, and a client dialling inside that window must not be locked out. The
// O_EXCL create decides the race; the loser simply reads the winner's file.
//
// There is no fallback to an open hub. A hub that cannot authenticate is a hub
// that accepts any web page the user happens to visit, so the caller disables
// instance discovery instead.
func ensureHubToken() (string, error) {
	path, err := hubTokenPath()
	if err != nil {
		return "", err
	}

	if tok, err := readHubToken(path); err == nil {
		return tok, nil
	} else if !errors.Is(err, fs.ErrNotExist) {
		return "", err
	}

	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate hub token: %w", err)
	}
	tok := hex.EncodeToString(buf)

	// 0600 is applied here, at creation, and deliberately not verified on read:
	// file modes are meaningless on Windows, where os.Stat reports a synthesised
	// permission bitmask that has nothing to do with the real ACL.
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		if errors.Is(err, fs.ErrExist) {
			return readHubToken(path) // lost the race; the winner's token is authoritative
		}
		return "", fmt.Errorf("create hub token: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString(tok); err != nil {
		return "", fmt.Errorf("write hub token: %w", err)
	}
	return tok, nil
}

func hubTokenPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".kube-ins")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return filepath.Join(dir, hubTokenFile), nil
}

func readHubToken(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	tok := strings.TrimSpace(string(data))
	if len(tok) < minHubTokenLen {
		return "", fmt.Errorf("hub token file %s is corrupt (%d chars)", path, len(tok))
	}
	return tok, nil
}
