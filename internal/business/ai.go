package business

import (
	"encoding/json"
	"fmt"
	"kube-ins/internal/models"
	services "kube-ins/internal/services"
	"os"
	"path/filepath"
)

const aiConfigFile = "ai_config.json"
const chatHistoryFile = "chat_history.json"

func GetAIConfig() (models.AIConfig, error) {
	dir, err := kubeInsDir()
	if err != nil {
		return models.AIConfig{}, err
	}
	data, err := os.ReadFile(filepath.Join(dir, aiConfigFile))
	if os.IsNotExist(err) {
		return models.AIConfig{Provider: "claude"}, nil
	}
	if err != nil {
		return models.AIConfig{}, err
	}
	var cfg models.AIConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return models.AIConfig{}, err
	}
	return cfg, nil
}

func SaveAIConfig(cfg models.AIConfig) error {
	dir, err := kubeInsDir()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, aiConfigFile), data, 0600)
}

func GetChatHistory() ([]models.ChatMessage, error) {
	dir, err := kubeInsDir()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(filepath.Join(dir, chatHistoryFile))
	if os.IsNotExist(err) {
		return []models.ChatMessage{}, nil
	}
	if err != nil {
		return nil, err
	}
	var history []models.ChatMessage
	if err := json.Unmarshal(data, &history); err != nil {
		return nil, err
	}
	return history, nil
}

func SaveChatHistory(history []models.ChatMessage) error {
	dir, err := kubeInsDir()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(history, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, chatHistoryFile), data, 0600)
}

func ClearChatHistory() error {
	dir, err := kubeInsDir()
	if err != nil {
		return err
	}
	return os.Remove(filepath.Join(dir, chatHistoryFile))
}

func AskAssistant(message string, history []models.ChatMessage) (string, error) {
	cfg, err := GetAIConfig()
	if err != nil {
		return "", err
	}

	// Append the new user message to history for the API call
	fullHistory := append(history, models.ChatMessage{Role: "user", Content: message})

	switch cfg.Provider {
	case "openai":
		if cfg.OpenAIKey == "" {
			return "", fmt.Errorf("OpenAI API key not configured")
		}
		return services.AskOpenAI(cfg.OpenAIKey, fullHistory)
	default: // "claude"
		if cfg.AnthropicKey == "" {
			return "", fmt.Errorf("Anthropic API key not configured")
		}
		return services.AskClaude(cfg.AnthropicKey, fullHistory)
	}
}
