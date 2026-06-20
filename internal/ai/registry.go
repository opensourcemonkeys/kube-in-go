package ai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
)

const ollamaRegistry = "https://registry.ollama.ai"

var regHTTP = &http.Client{Timeout: 12 * time.Second}

// ModelTags returns the available tags (size/quant variants) of a registry model,
// e.g. ["latest","0.5b","1.5b","3b","7b","72b"] for "qwen2.5". Hits the OCI
// registry tags/list endpoint, handling the anonymous bearer-token challenge.
func ModelTags(name string) ([]string, error) {
	repo := strings.TrimSpace(name)
	if i := strings.IndexByte(repo, ':'); i >= 0 {
		repo = repo[:i]
	}
	if repo == "" {
		return nil, fmt.Errorf("empty model name")
	}
	if !strings.Contains(repo, "/") {
		repo = "library/" + repo
	}
	url := fmt.Sprintf("%s/v2/%s/tags/list", ollamaRegistry, repo)

	body, status, hdr, err := regGet(url, "")
	if status == http.StatusUnauthorized {
		if token, terr := fetchRegistryToken(hdr.Get("Www-Authenticate"), repo); terr == nil {
			body, status, _, err = regGet(url, token)
		}
	}
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("registry returned %d for %s", status, repo)
	}

	var out struct {
		Tags []string `json:"tags"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	sort.Strings(out.Tags)
	return out.Tags, nil
}

func regGet(url, token string) ([]byte, int, http.Header, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := regHTTP.Do(req)
	if err != nil {
		return nil, 0, nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return b, resp.StatusCode, resp.Header, nil
}

var wwwAuthRe = regexp.MustCompile(`(\w+)="([^"]*)"`)

// fetchRegistryToken performs the anonymous OCI token handshake using the
// Www-Authenticate challenge header (Bearer realm=...,service=...,scope=...).
func fetchRegistryToken(challenge, repo string) (string, error) {
	if !strings.HasPrefix(strings.ToLower(challenge), "bearer ") {
		return "", fmt.Errorf("unexpected auth challenge")
	}
	params := map[string]string{}
	for _, m := range wwwAuthRe.FindAllStringSubmatch(challenge, -1) {
		params[strings.ToLower(m[1])] = m[2]
	}
	realm := params["realm"]
	if realm == "" {
		return "", fmt.Errorf("no realm in auth challenge")
	}
	scope := params["scope"]
	if scope == "" {
		scope = "repository:" + repo + ":pull"
	}
	url := fmt.Sprintf("%s?service=%s&scope=%s", realm, params["service"], scope)

	body, status, _, err := regGet(url, "")
	if err != nil {
		return "", err
	}
	if status != http.StatusOK {
		return "", fmt.Errorf("token endpoint returned %d", status)
	}
	var tok struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", err
	}
	if tok.Token != "" {
		return tok.Token, nil
	}
	return tok.AccessToken, nil
}
