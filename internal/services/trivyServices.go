package services_k8sclient

import (
	"context"
	"sort"
	"strings"
	"time"

	"kube-ins/internal/models"

	dbTypes "github.com/aquasecurity/trivy-db/pkg/types"
	"github.com/aquasecurity/trivy/pkg/commands/artifact"
	"github.com/aquasecurity/trivy/pkg/db"
	ftypes "github.com/aquasecurity/trivy/pkg/fanal/types"
	"github.com/aquasecurity/trivy/pkg/flag"
	"github.com/aquasecurity/trivy/pkg/javadb"
	"github.com/aquasecurity/trivy/pkg/types"
	"github.com/google/go-containerregistry/pkg/name"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	_ "modernc.org/sqlite" // registers the "sqlite" driver used by Trivy's RPM/Java DB
)

// ListPodImages returns the distinct container images (including init and
// ephemeral containers) used by pods in the given namespace. An empty
// namespace lists across all namespaces.
func ListPodImages(client *kubernetes.Clientset, namespace string) ([]string, error) {
	pods, err := client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	set := map[string]struct{}{}
	for _, p := range pods.Items {
		for _, c := range p.Spec.InitContainers {
			set[c.Image] = struct{}{}
		}
		for _, c := range p.Spec.Containers {
			set[c.Image] = struct{}{}
		}
		for _, c := range p.Spec.EphemeralContainers {
			set[c.Image] = struct{}{}
		}
	}
	images := make([]string, 0, len(set))
	for img := range set {
		if img != "" {
			images = append(images, img)
		}
	}
	sort.Strings(images)
	return images, nil
}

// scanTimeout is generous because the first scan downloads the vulnerability DB.
const scanTimeout = 12 * time.Minute

// ScanImage scans a single container image for vulnerabilities using the Trivy
// library. cacheDir is where the vulnerability DB and layer cache are stored.
func ScanImage(ctx context.Context, imageRef, cacheDir string) (*models.TrivyScanResult, error) {
	opts := baseOptions(cacheDir)
	opts.ScanOptions.Target = imageRef

	report, err := scanContainerImage(ctx, opts)
	if err != nil {
		return nil, err
	}
	return mapReport("image", imageRef, report), nil
}

// scanContainerImage mirrors the internal artifact.run() flow but returns the
// report instead of writing it to an output sink (artifact.Run does not expose
// the report). We deliberately skip the Report step.
func scanContainerImage(ctx context.Context, opts flag.Options) (types.Report, error) {
	r, err := artifact.NewRunner(ctx, opts, artifact.TargetContainerImage)
	if err != nil {
		return types.Report{}, err
	}
	defer r.Close(ctx)

	report, err := r.ScanImage(ctx, opts)
	if err != nil {
		return types.Report{}, err
	}
	report, err = r.Filter(ctx, opts, report)
	if err != nil {
		return types.Report{}, err
	}
	return report, nil
}

// baseOptions builds a sane default flag.Options for a vulnerability scan.
func baseOptions(cacheDir string) flag.Options {
	return flag.Options{
		GlobalOptions: flag.GlobalOptions{
			CacheDir: cacheDir,
			Timeout:  scanTimeout,
			Quiet:    true,
		},
		CacheOptions: flag.CacheOptions{
			CacheBackend: "fs",
		},
		DBOptions: flag.DBOptions{
			NoProgress:         true,
			DBRepositories:     defaultDBRepos(),
			JavaDBRepositories: defaultJavaDBRepos(),
		},
		ScanOptions: flag.ScanOptions{
			Scanners: types.Scanners{types.VulnerabilityScanner},
			Parallel: 1,
		},
		// Without PkgTypes/PkgRelationships set, no packages are analyzed and
		// the scan reports zero vulnerabilities. These mirror the CLI defaults.
		PackageOptions: flag.PackageOptions{
			PkgTypes:         types.PkgTypes,
			PkgRelationships: ftypes.Relationships,
		},
		ReportOptions: flag.ReportOptions{
			Format:     types.FormatJSON,
			Severities: allSeverities(),
		},
		// "auto" lets Trivy pick the severity source per advisory; without it
		// most findings come back as UNKNOWN. Mirrors the CLI default.
		VulnerabilityOptions: flag.VulnerabilityOptions{
			VulnSeveritySources: []dbTypes.SourceID{"auto"},
		},
		ImageOptions: flag.ImageOptions{
			ImageSources: ftypes.AllImageSources,
		},
	}
}

func defaultDBRepos() []name.Reference {
	return parseRefs(db.DefaultGCRRepository, db.DefaultGHCRRepository)
}

func defaultJavaDBRepos() []name.Reference {
	return parseRefs(javadb.DefaultGCRRepository, javadb.DefaultGHCRRepository)
}

func parseRefs(repos ...string) []name.Reference {
	refs := make([]name.Reference, 0, len(repos))
	for _, r := range repos {
		ref, err := name.ParseReference(r, name.WithDefaultTag(""))
		if err == nil {
			refs = append(refs, ref)
		}
	}
	return refs
}

func allSeverities() []dbTypes.Severity {
	out := make([]dbTypes.Severity, 0, len(dbTypes.SeverityNames))
	for _, s := range dbTypes.SeverityNames {
		sev, err := dbTypes.NewSeverity(strings.ToUpper(s))
		if err == nil {
			out = append(out, sev)
		}
	}
	return out
}

// mapReport flattens a Trivy report into the frontend DTO.
func mapReport(kind, ref string, report types.Report) *models.TrivyScanResult {
	res := &models.TrivyScanResult{
		Kind:        kind,
		ArtifactRef: ref,
		Summary:     map[string]int{},
		ScannedAt:   time.Now().Format(time.RFC3339),
	}
	for _, r := range report.Results {
		t := models.TrivyTarget{
			Target: r.Target,
			Class:  string(r.Class),
			Type:   string(r.Type),
		}
		for _, v := range r.Vulnerabilities {
			t.Vulnerabilities = append(t.Vulnerabilities, models.TrivyVulnerability{
				VulnerabilityID:  v.VulnerabilityID,
				PkgName:          v.PkgName,
				InstalledVersion: v.InstalledVersion,
				FixedVersion:     v.FixedVersion,
				Severity:         v.Severity,
				Title:            v.Title,
				PrimaryURL:       v.PrimaryURL,
			})
			res.Summary[v.Severity]++
		}
		if len(t.Vulnerabilities) > 0 {
			res.Targets = append(res.Targets, t)
		}
	}
	return res
}
