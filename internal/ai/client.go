package ai

import (
	"context"
	"net/http"
	"net/url"

	"github.com/ollama/ollama/api"
)

const defaultHost = "http://localhost:11434"

// newClient builds an Ollama API client for the given host (falling back to the
// local default when empty).
func newClient(host string) (*api.Client, error) {
	if host == "" {
		host = defaultHost
	}
	base, err := url.Parse(host)
	if err != nil {
		return nil, err
	}
	return api.NewClient(base, http.DefaultClient), nil
}

// ListModels returns the names of the models available on the Ollama host.
func ListModels(host string) ([]string, error) {
	client, err := newClient(host)
	if err != nil {
		return nil, err
	}
	resp, err := client.List(context.Background())
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(resp.Models))
	for _, m := range resp.Models {
		names = append(names, m.Name)
	}
	return names, nil
}
