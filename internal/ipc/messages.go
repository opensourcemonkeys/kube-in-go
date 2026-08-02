package ipc

import (
	"encoding/json"

	"kube-ins/internal/models"
)

const (
	MsgRegister     = "REGISTER"
	MsgInstanceList = "INSTANCE_LIST"
	MsgTransferTab  = "TRANSFER_TAB"
)

// Message is the envelope for all IPC messages.
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type RegisterPayload struct {
	ID string `json:"id"`
}

type InstanceListPayload struct {
	Instances []models.InstanceInfo `json:"instances"`
}

type TransferPayload struct {
	TargetInstanceID string                 `json:"targetInstanceId"`
	Panel            models.SerializedPanel `json:"panel"`
}
