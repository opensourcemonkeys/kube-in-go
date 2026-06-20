package models

// OllamaModelInfo describes a model in the AI assistant's model manager — either
// already installed locally or available to download from the Ollama registry.
type OllamaModelInfo struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	ContextLength int    `json:"contextLength"`
	VramBytes     int64  `json:"vramBytes"`
	Installed     bool   `json:"installed"`
}
