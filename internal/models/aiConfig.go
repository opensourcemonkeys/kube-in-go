package models

type AIConfig struct {
	Provider       string `json:"provider"`        // "claude" or "openai"
	AnthropicKey   string `json:"anthropic_api_key"`
	OpenAIKey      string `json:"openai_api_key"`
}

type ChatMessage struct {
	Role    string `json:"role"`    // "user" or "assistant"
	Content string `json:"content"`
	Time    string `json:"time"`
}
