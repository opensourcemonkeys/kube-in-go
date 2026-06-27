package business

import services "kube-ins/internal/services"

// CLI mode: the GUI hosts the terminal UI by re-execing the kube-ins binary in
// --tui mode inside a pty. These thin wrappers mirror the terminal session API
// but add an onExit callback fired when the TUI process exits.

func CreateCliModeSession(id string, onOutput func(string), onExit func()) error {
	return services.CreateCliModeSession(id, onOutput, onExit)
}

func WriteToCliModeSession(id string, data string) error {
	return services.WriteToCliModeSession(id, data)
}

func ResizeCliModeSession(id string, cols int, rows int) error {
	return services.ResizeCliModeSession(id, uint16(cols), uint16(rows))
}

func CloseCliModeSession(id string) error {
	return services.CloseCliModeSession(id)
}
