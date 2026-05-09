package business

import services "kube-ins/internal/services"

func CreateTerminalSession(id string, onOutput func(string)) error {
	return services.CreateTerminalSession(id, onOutput)
}

func WriteToTerminalSession(id string, data string) error {
	return services.WriteToTerminalSession(id, data)
}

func ResizeTerminalSession(id string, cols int, rows int) error {
	return services.ResizeTerminalSession(id, uint16(cols), uint16(rows))
}

func CloseTerminalSession(id string) error {
	return services.CloseTerminalSession(id)
}
