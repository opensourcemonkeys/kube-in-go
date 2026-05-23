package services_k8sclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"kube-ins/internal/models"
	"net/http"
)

const systemPrompt = `You are a helpful Kubernetes assistant embedded in kube-ins, a desktop Kubernetes cluster management application.
Help users with Kubernetes concepts, troubleshoot issues, explain YAML manifests, suggest commands, and answer questions about their clusters.
Be concise and practical. Use markdown formatting where helpful.`

func AskClaude(apiKey string, history []models.ChatMessage) (string, error) {
	type contentBlock struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	type message struct {
		Role    string         `json:"role"`
		Content []contentBlock `json:"content"`
	}
	type requestBody struct {
		Model     string    `json:"model"`
		MaxTokens int       `json:"max_tokens"`
		System    string    `json:"system"`
		Messages  []message `json:"messages"`
	}

	messages := make([]message, 0, len(history))
	for _, m := range history {
		messages = append(messages, message{
			Role:    m.Role,
			Content: []contentBlock{{Type: "text", Text: m.Content}},
		})
	}

	body, _ := json.Marshal(requestBody{
		Model:     "claude-opus-4-5",
		MaxTokens: 2048,
		System:    systemPrompt,
		Messages:  messages,
	})

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("claude api error %d: %s", resp.StatusCode, string(respBytes))
	}

	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("empty response from claude")
	}
	return result.Content[0].Text, nil
}

func AskOpenAI(apiKey string, history []models.ChatMessage) (string, error) {
	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}
	type requestBody struct {
		Model    string    `json:"model"`
		Messages []message `json:"messages"`
	}

	messages := []message{{Role: "system", Content: systemPrompt}}
	for _, m := range history {
		messages = append(messages, message{Role: m.Role, Content: m.Content})
	}

	body, _ := json.Marshal(requestBody{
		Model:    "gpt-4o",
		Messages: messages,
	})

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("openai api error %d: %s", resp.StatusCode, string(respBytes))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("empty response from openai")
	}
	return result.Choices[0].Message.Content, nil
}
