package business

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strings"
)

// Redaction for the diagnostics report and the exported log bundle.
//
// The threat model is mundane and worth stating: a beta user emails the zip to
// a stranger. Nothing here defends against a determined attacker who already
// has the file — it removes the things that leak by accident. False-positive
// redaction is always the safer failure, so the rules err towards deleting too
// much, with two deliberate exceptions documented below (long absolute paths
// and git commit hashes) where over-redaction would destroy the very evidence
// the report exists to carry.
//
// Order is mandatory: $HOME, then cluster names, then secrets, then base64,
// then URLs. See redactorFor.

const redactedMarker = "<redacted>"

var (
	// Secret-ish assignments. The value must be at least 8 non-space characters
	// so that ordinary Kubernetes prose survives — `secrets is forbidden: User
	// "dev" cannot list resource "secrets"` has to stay readable, since it is
	// exactly the kind of line a report exists to carry. (The plural also
	// escapes the \b, and `secret is forbidden` fails on the 8-character rule.)
	reSecret = regexp.MustCompile(`(?i)\b(bearer|token|password|passwd|secret|api[-_]?key|authorization)\b([\s:=]+"?)(\S{8,})`)

	// Base64url-ish runs. '/' is deliberately NOT in the character class:
	// including it matches long absolute paths such as
	// /usr/lib/kube-inspector/resources/app.asar/dist/assets/index-a1b2.js,
	// which is precisely what a packaging bug needs. JWTs and Kubernetes bearer
	// tokens are base64url ('-' and '_', never '/'), so nothing real is lost.
	reB64 = regexp.MustCompile(`\b[A-Za-z0-9+_=-]{40,}\b`)

	// A bare 40-character hex string is a git commit — the single most useful
	// thing in a bug report, and never a secret in this app. Exempt from reB64,
	// which would otherwise eat it (a report that says `commit <redacted>` is
	// actively worse than useless).
	//
	// 64-character hex is deliberately NOT exempt, even though it costs us the
	// self-updater's SHA-256 and Trivy's image digests. Both of this app's real
	// secrets — the per-process RPC token and the shared hub token — are 32
	// random bytes rendered as exactly 64 hex characters, i.e. the same shape.
	// Neither is logged today, and the Electron side scrubs the one line that
	// carries one, but an export is a file the user emails to a stranger: a
	// missing checksum is a nuisance, a live token is not.
	reGitSha = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)

	reURL = regexp.MustCompile(`\b(https?)://([^\s/"'\\]+)([^\s"'\\]*)`)
)

// urlKeep are hosts whose full URL is safe and useful: our own endpoints, the
// model registry, and loopback. Everything else collapses to scheme://<host>,
// because an API server address is infrastructure the user did not agree to
// publish.
var urlKeep = map[string]bool{
	"kubeinspector.com":     true,
	"www.kubeinspector.com": true,
	"registry.ollama.ai":    true,
	"localhost":             true,
	"127.0.0.1":             true,
	"::1":                   true,
}

// redactorFor builds a reusable redactor. Use it when redacting many lines —
// the cluster table is built once instead of per line.
//
// The order below is not arbitrary:
//
//   - $HOME first. If the home directory's last segment happens to be a cluster
//     name (a user whose cluster is named after their account — common), doing
//     clusters first rewrites /home/mfx into /home/<cluster-1>, after which the
//     $HOME replacement no longer matches and /home/ leaks.
//   - Cluster names before base64 and URLs: a 40-character cluster name would
//     otherwise be eaten as a token, and a cluster name inside a URL path would
//     be erased before it could be counted.
//   - Secrets before base64, so a token shorter than 40 characters is still
//     caught and the output is stable either way.
//   - URLs last. That rule rewrites the path segment, which every earlier rule
//     wants to see intact.
//
// The result is idempotent: redact(redact(s)) == redact(s).
func redactorFor(clusters []string) func(string) string {
	replaceClusters := clusterReplacer(clusters)
	return func(s string) string {
		s = replaceHome(s)
		s = replaceClusters(s)
		s = reSecret.ReplaceAllString(s, "${1}${2}"+redactedMarker)
		s = redactBase64(s)
		s = redactURLs(s)
		return s
	}
}

// replaceHome rewrites the user's home directory to ~ in every form it can
// appear: as-is, slash-normalised, and — inside a JSON log line on Windows —
// backslash-escaped. Plain string replacement, not a regex: home paths are full
// of regex metacharacters.
func replaceHome(s string) string {
	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		return s
	}
	variants := []string{home}
	if slash := filepath.ToSlash(home); slash != home {
		variants = append(variants, slash)
	}
	if esc := strings.ReplaceAll(home, `\`, `\\`); esc != home {
		variants = append(variants, esc)
	}
	// Longest first: the escaped form contains the plain one as a prefix on
	// some layouts, and replacing the short one first would strand the rest.
	slices.SortFunc(variants, func(a, b string) int { return len(b) - len(a) })

	for _, v := range variants {
		s = strings.ReplaceAll(s, v, "~")
		if runtime.GOOS == "windows" {
			// NTFS paths are case-insensitive, so C:\Users\Bob and c:\users\bob
			// are the same directory and both appear in real logs.
			s = replaceFold(s, v, "~")
		}
	}
	return s
}

func replaceFold(s, old, new string) string {
	if old == "" {
		return s
	}
	lowerS, lowerOld := strings.ToLower(s), strings.ToLower(old)
	var b strings.Builder
	for i := 0; ; {
		j := strings.Index(lowerS[i:], lowerOld)
		if j < 0 {
			b.WriteString(s[i:])
			return b.String()
		}
		j += i
		b.WriteString(s[i:j])
		b.WriteString(new)
		i = j + len(old)
	}
}

// clusterReplacer maps each configured cluster name to a stable <cluster-N>
// label. Numbering follows alphabetical order rather than directory order so
// two exports from the same machine are diffable.
func clusterReplacer(clusters []string) func(string) string {
	names := make([]string, 0, len(clusters))
	for _, n := range clusters {
		if strings.TrimSpace(n) != "" {
			names = append(names, n)
		}
	}
	if len(names) == 0 {
		return func(s string) string { return s }
	}
	slices.Sort(names)
	names = slices.Compact(names)

	labels := make(map[string]string, len(names))
	for i, n := range names {
		labels[n] = fmt.Sprintf("<cluster-%d>", i+1)
	}

	// Apply longest first so "prod" cannot shred "prod-eu".
	order := slices.Clone(names)
	slices.SortFunc(order, func(a, b string) int { return len(b) - len(a) })

	return func(s string) string {
		for _, n := range order {
			s = replaceToken(s, n, labels[n])
		}
		return s
	}
}

// replaceToken replaces name with label wherever it stands as a whole token.
//
// Hand-written rather than a regex because RE2 has no lookarounds: a pattern
// that consumed the delimiters would miss adjacent occurrences separated by a
// single character, which is exactly how cluster names appear in a log line.
func replaceToken(s, name, label string) string {
	if name == "" {
		return s
	}
	var b strings.Builder
	for i := 0; ; {
		j := strings.Index(s[i:], name)
		if j < 0 {
			b.WriteString(s[i:])
			return b.String()
		}
		j += i
		b.WriteString(s[i:j])

		var before, after byte = ' ', ' '
		if j > 0 {
			before = s[j-1]
		}
		if end := j + len(name); end < len(s) {
			after = s[end]
		}
		if isNameByte(before) || isNameByte(after) {
			// Part of a longer identifier; not this cluster.
			b.WriteString(name)
		} else {
			b.WriteString(label)
		}
		i = j + len(name)
	}
}

func isNameByte(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-'
}

func redactBase64(s string) string {
	return reB64.ReplaceAllStringFunc(s, func(m string) string {
		if reGitSha.MatchString(m) {
			return m
		}
		return redactedMarker
	})
}

// urlTrailing is punctuation a URL match swallows when the URL ends a clause:
// "Get https://host/pods: timeout" would otherwise lose the colon. '>' and ']'
// are excluded so the <host> placeholder and IPv6 literals survive, which is
// what keeps this rule idempotent.
const urlTrailing = `.,;:!?)`

func redactURLs(s string) string {
	return reURL.ReplaceAllStringFunc(s, func(m string) string {
		var tail string
		for len(m) > 0 && strings.IndexByte(urlTrailing, m[len(m)-1]) >= 0 {
			tail = string(m[len(m)-1]) + tail
			m = m[:len(m)-1]
		}
		return redactURL(m) + tail
	})
}

func redactURL(m string) string {
	sub := reURL.FindStringSubmatch(m)
	if sub == nil {
		return m
	}
	scheme, authority := sub[1], sub[2]
	host := authority
	if at := strings.LastIndex(host, "@"); at >= 0 {
		host = host[at+1:] // drop any embedded credentials outright
	}
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	host = strings.Trim(strings.ToLower(host), "[]")
	if urlKeep[host] || strings.HasSuffix(host, ".kubeinspector.com") {
		return m
	}
	return scheme + "://<host>"
}
