package tui

// Key hints shown top-right per screen. Single-letter, cross-platform-safe
// bindings (no Ctrl/Alt combos that terminals intercept), k9s-style.
const (
	hintClusters = "[teal]↵[-] select  [teal]a[-] add  [teal]d[-] delete  [teal]v[-] view  [teal]?[-] help  [teal]q[-] quit"
	hintMenu     = "[teal]↵[-] open  [teal]c[-] cluster  [teal]?[-] help  [teal]q[-] back"
	hintList     = "[teal]↵/y[-] yaml  [teal]e[-] edit  [teal]d[-] del  [teal]/[-] filter  [teal]r[-] refresh  [teal]c[-] cluster  [teal]q[-] back"
	hintListPod  = "[teal]↵/y[-] yaml  [teal]e[-] edit  [teal]l[-] logs  [teal]s[-] shell  [teal]d[-] del  [teal]/[-] filter  [teal]r[-] refresh  [teal]q[-] back"
	hintYaml     = "[teal]e[-] edit  [teal]g/G[-] top/bottom  [teal]q[-] back"
	hintEdit     = "[teal]F2[-] save  [teal]Esc[-] cancel"
	hintLogs     = "[teal]f[-] follow  [teal]g/G[-] top/bottom  [teal]q[-] back"
)
