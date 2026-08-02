# Kube Inspector: ALPHA → BETA Planı

**Baseline:** v0.15.0-alpha · **Hedef:** v0.16.0-beta.1

> Her step **ayrı bir Claude oturumunda** çalıştırılmak üzere, kendi kendine yeterli olacak şekilde yazıldı.
> Yeni oturumda: `beta-plan.md`'yi aç, aşağıdaki "Global önsöz"ü ve ilgili step'in tamamını oku, bitince kutuyu işaretle.

## İlerleme

- [x] **S1** — Doğrulama altyapısı: lint, vet, test, PR CI ✅
- [ ] **S2** — ApplyYaml: cluster pinning + native server-side apply *(riskli)*
- [ ] **S3** — Backend doğruluk paketi: nil panic, path traversal, timeout
- [ ] **S4** — IPC hub sertleştirme *(güvenlik)*
- [ ] **S5** — Session yaşam döngüsü: zombiler, sızıntılar, restart yarışı
- [ ] **S6** — Yerel loglama + diagnostics blob
- [ ] **S7** — 24 business fonksiyonuna error return *(en riskli)*
- [ ] **S8** — UI'da hata + yükleme durumu
- [ ] **S9** — Describe, Resource Quota, eksik delete/update, namespace create
- [ ] **S10** — Scale ve Rollout Restart
- [ ] **S11** — Port forwarding
- [ ] **S12** — i18n altyapısı + İngilizce katalog + dil seçici
- [ ] **S13** — tr / de / ru / zh / ja çevirileri + çürüme koruması
- [ ] **S14** — Performans ve render hijyeni
- [ ] **S15** — Release altyapısı: CI, kanallar, updater, paketleme
- [ ] **S16** — Beta dokümantasyonu
- [ ] **S17** — Beta sürümünü çıkar (`v0.16.0-beta.1`)

---

## Context — bu plan neden var

Uygulama v0.15.0-alpha'da ve alfa etiketini hak eden gerçek boşluklar var. Üç ayrı denetim (backend, frontend, release/infra) yapıldı; en kritik iddialar kaynak kodda bizzat doğrulandı. Öne çıkanlar:

- **Yanlış cluster'a yazma:** `ApplyYaml` `clusterName` almıyor, global aktif kubeconfig'e yazıyor. `staging`'e pinlenmiş bir panelden apply, `prod`'a düşebiliyor. (Doğrulandı: `internal/business/applyYaml.go:8`)
- **Apply hiç çalışmıyor olabilir:** `ApplyYaml` `exec.LookPath("kubectl")` yapıyor ama kubectl paketlenmiyor ve `build/nfpm.yaml`'da bağımlılık olarak tanımlı değil. (Doğrulandı: `internal/services/applyYamlServices.go:10`)
- **Sessiz hata:** 24 business list fonksiyonu hata dönmüyor; `fmt.Println` ile yutup boş liste dönüyor. Frontend'de `useResourceList.ts:73-81` de `setItems([])` yapıyor. Sonuç: RBAC-403, ölü API server ve gerçekten boş namespace **aynı** "No pods found" ekranını veriyor.
- **Hiç log yok:** 44 `fmt.Println` + 3 `log.Printf`. stdout Electron'a giden özel bir pipe, diske hiçbir şey yazılmıyor. Bir beta kullanıcısının hata raporuna ekleyecek hiçbir şeyi yok.
- **Kimliksiz IPC hub:** `localhost:34200` sabit portta, `CheckOrigin` her zaman `true`. Kullanıcının ziyaret ettiği herhangi bir web sayfası bağlanıp instance'ları listeleyebiliyor ve uygulamaya panel enjekte edebiliyor. (Doğrulandı: `internal/ipc/hub.go:23-25`)
- **Eksik temel eylemler:** scale, rollout restart, port-forward, describe binding'i hiç yok. `GetObjectDescribe` backend'de tam yazılmış ama frontend'e bağlanmamış.
- **CI sadece tag'de çalışıyor:** PR/push CI yok, `go vet` yok, lint yok, `go test` CI'da hiç koşmuyor, e2e job tamamen yorum satırında.

**Kapsam kararları (kullanıcı onaylı):**
1. Sağlamlaştırma **+ temel eksik eylemler** (scale, restart, describe, eksik delete'ler, port-forward).
2. **Kod imzalama yok** (sertifika yok) → yerine dokümantasyon + checksum doğrulama rehberi.
3. Teşhis = **yerel log dosyası + UI hata banner'ı + "Copy diagnostics"**. Telemetri yok, hiçbir veri makineden çıkmıyor.
4. **i18n dahil**: react-i18next, 6 dil — İngilizce, Türkçe, Almanca, Rusça, Çince, Japonca.

---

## Her step oturumuna yapıştırılacak global önsöz

```
Repo: /home/mfx/Documents/monkey/kube-in-go  (Go + Electron shell + React/TS)
Önce CLAUDE.md'yi oku — 53KB mimari doküman.
graphify knowledge graph var: grep'ten önce `graphify query "..."`.
GOEXPERIMENT=jsonv2 her go build/vet/test için ZORUNLU (Trivy → encoding/json/v2).
Makefile export ediyor; çıplak `go` komutlarında elle vermek gerek.
Shipped GUI = Electron (`make dev`). Wails sadece dev.
internal/tui + cmd/tui Wails'siz kalmalı:
    grep -rn "wailsapp/wails" internal/tui cmd/tui   # boş olmalı
Binding'ler gitignore'lu frontend/wailsjs içinde. `make bindings` sadece
dizin YOKSA üretir — exported App metodu veya models struct'ı değiştiyse:
    rm -rf frontend/wailsjs && make bindings
frontend/wailsjs elle düzenlenmez.
```

**Her step sonunda koşulacak evrensel doğrulama:**
```bash
cd /home/mfx/Documents/monkey/kube-in-go
GOEXPERIMENT=jsonv2 go build ./... && GOEXPERIMENT=jsonv2 go vet ./...
GOEXPERIMENT=jsonv2 go test ./...
rm -rf frontend/wailsjs && make bindings
cd frontend && npx tsc --noEmit && npm run build
```

---

## Bağımlılık grafiği

```
S1 (harness) ─┬─ S2 ApplyYaml ────┐
              ├─ S3 backend fix   │  (S2/S3/S4/S5 tamamen paralel)
              ├─ S4 IPC hub       │
              ├─ S5 session leak  │
              └─ S6 logging ──────┴─→ S7 error returns (backend)
                                            ↓
                                       S8 error UI (frontend)
                                            ↓
              ┌──────────────┬──────────────┼──────────────┐
          S9 describe    S10 scale/restart  S11 port-forward   (S9/S10/S11 paralel)
              └──────────────┴──────────────┘
                             ↓
                     S12 i18n altyapı ──→ S13 çeviriler
                             ↓
                     S14 performans
                             ↓
              S15 release infra ──┬── S16 docs    (S15/S16 paralel, S1'den sonra her an)
                                  ↓
                             S17 beta cut
```

**S15 (CI/paketleme)** ve **S16 (docs)** uygulama kaynağına dokunmaz, S1'den sonra istenen zamanda yapılabilir. **S14** S8 ve S13 ile aynı dosyalara dokunur — ikisinden sonra yapılmalı.

---

## Step 1 — Doğrulama altyapısı: lint, vet, test, PR CI

**Neden ilk:** sonraki her step'in "verify" komutu bunların var olmasına bağlı. Şu an `go vet` yok, golangci-lint config yok, ESLint config yok, frontend test runner yok, mevcut 2 Go test dosyası CI'da hiç koşmuyor.

**Hedef:** `make check` tek komutla derleme + vet + lint + typecheck + test kanıtlasın, ve her PR/push'ta koşsun (release workflow'undan ayrı).

**Dosyalar**
- Yeni `.golangci.yml` — `govet, staticcheck, errcheck, ineffassign, unused, bodyclose, contextcheck, gosec`. `run.build-tags` + GOEXPERIMENT ayarla. `internal/tui` için `errcheck` gürültülüyse başlangıçta hariç tut ama TODO ile kaydet.
- Yeni `frontend/eslint.config.js` (flat config) + devDeps: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`. `react-hooks/exhaustive-deps` **warn** (bilinçli ihlaller var), `no-explicit-any` warn. Bugün sıfır hata alınabilmeli.
- Yeni `frontend/vitest.config.ts` + `vitest`, `@testing-library/react`, `jsdom`. `package.json`'a `"test": "vitest run"`.
- Yeni `e2e_tests/pytest.ini` — `markers = integration: ...` (kayıtsız marker uyarısını giderir).
- Yeni `.github/workflows/ci.yml` — `pull_request` + non-tag `push`. Job'lar: `go` (build/vet/golangci-lint/test, `GOEXPERIMENT: jsonv2`, Go 1.26), `frontend` (npm ci → `wails generate module` → tsc → eslint → vitest → build).
- `.github/workflows/build.yml:3-6` — tag filtresini `'*'` → **`'v*'`**. Şu an rastgele bir tag tam release + R2 upload + docs deploy tetikliyor. build.yml'de başka bir şeye dokunma (S15'in işi).
- `Makefile` — `check:` target'ı (5 komutu zincirle) + `test-go:`. `.PHONY`'ye ekle.
- Repo temizliği: `git rm TODO` (boş ama tracked); sil: `report.html`, `keygensh/`, `__pycache__/`, kök `node_modules/` + kök `package-lock.json` (89 byte, eşleşen package.json yok), `dist/*v0.11.0-alpha*`. `.gitignore`'a ekle ve `docs/downloads.md`'nin **çift** girdisini (`:22`, `:24`) tekilleştir.
- `Makefile:189-198` — tracked `docs/downloads.md` üzerinde `sed -i` yapmayı bırak (her `make docs-serve` working tree'yi kirletiyor). Kaynağı `docs/downloads.md.in` yap, `docs-downloads` ondan üretsin, `docs/downloads.md`'yi `git rm --cached` ile untrack et. Ancak o zaman mevcut ignore kuralı gerçekten işler.
- İlk gerçek testler (böylece `go test`/`vitest` boş koşmaz):
  - `internal/business/update_test.go` — `isNewer` tablo testi: `1.0.0 > 0.15.0-alpha`, `0.16.0-beta.1 > 0.16.0-alpha.3`, `1.0.0 == 1.0.0` false, `1.0.0-alpha < 1.0.0`, geçersiz girdi false.
  - `internal/services/selfUpdateServices_test.go:101-105` — `TestPlatformAssetResolution` şu an sadece `t.Logf` yapıyor, **hiç assertion yok**. Derlenen `runtime.GOOS/GOARCH` için platform anahtarının dört manifest anahtarından biri olduğunu ve `kind`'ın boş olmadığını assert et.

**Risk:** düşük. `internal/` uygulama mantığı değişmiyor.

**Verify**
```bash
make check                                        # 0 dönmeli
make docs-build && git status --porcelain         # boş olmalı
grep -n "tags:" -A2 .github/workflows/build.yml   # 'v*' göstermeli
```

---

## Step 2 — ApplyYaml: cluster pinning + native server-side apply (kubectl'i bırak)

**Risk: YÜKSEK — uygulamadaki tek kaynak-oluşturma yolu bu.**

**İki kusur, tek çözüm:**
1. `internal/business/applyYaml.go:8` — `ApplyYaml(yamlContent string)` `clusterName` almıyor, `repository.GetActiveKubeconfigPath()` kullanıyor. CLAUDE.md'de belgelenen per-tab cluster izolasyonu invariant'ını ihlal ediyor.
2. `internal/services/applyYamlServices.go:10` — `exec.LookPath("kubectl")`. kubectl paketlenmiyor ve `build/nfpm.yaml`'da `depends:` yok (Electron shell'in bütün amacı bu). Temiz makinede "Apply YAML" çalışmıyor. Hata mesajı da Türkçe (`"kubectl bulunamadı"`).

**Tasarım — subprocess yerine native dynamic-client server-side apply.** Gereken her şey zaten var: `internal/services/objectYamlServices.go` içinde `newDynamicAndMapper(*rest.Config)` (QPS/Burst'ü 50/100'e çıkarıyor) ve `resolveResourceInterface`. **Aynen tekrar kullan, kopyalama.**

Yeni `internal/services/applyYamlServices.go`:
```go
// ApplyYaml applies a (possibly multi-document) manifest with server-side apply.
// Field manager "kube-inspector". Returns one "<kind>/<name> applied" line per doc.
func ApplyYaml(ctx context.Context, config *rest.Config, yamlContent string) (string, error)
```
1. `k8s.io/apimachinery/pkg/util/yaml.NewYAMLOrJSONDecoder` ile tüm buffer üzerinde döngü, `*unstructured.Unstructured`'a decode, `io.EOF`'a kadar. Boş dokümanları atla.
2. Doküman başına: `apiVersion`+`kind` zorunlu; `schema.FromAPIVersionAndKind` ile GVK; `mapper.RESTMapping(gvk.GroupKind(), gvk.Version)` → GVR **ve** `mapping.Scope`.
3. Namespace: scope namespaced ve `obj.GetNamespace() == ""` ise `"default"`. Cluster-scoped ise namespace'i **zorla boşalt** (cluster-scoped objede namespace alanı 400 döner).
4. `dyn.Resource(gvr).Namespace(ns).Apply(ctx, obj.GetName(), obj, metav1.ApplyOptions{FieldManager: "kube-inspector", Force: true})`. **`Force: true` zorunlu** — daha önce kubectl'in oluşturduğu (`kubectl-client-side-apply` field manager'lı) bir kaynakta conflict verir.
5. Çıktıyı biriktir. İlk hatada, biriken çıktıyı hatanın içine katla — **mevcut yorumdaki sözleşmeyi koru**: Wails, error non-nil olduğunda ilk dönüş değerini atar, o yüzden mesaj kullanıcının ihtiyacı olan her şeyi taşımalı. Doküman indeksini ekle (`document 3: ...`) ki çok-dokümanlı kısmi hata teşhis edilebilsin.
6. `context.TODO()` değil — business katmanında 60s timeout'lu ctx.

`internal/business/applyYaml.go`:
```go
func ApplyYaml(clusterName string, yamlContent string) (string, error) {
    _, config, err := repository.NewK8sClientAndConfigForCluster(clusterName)
    if err != nil { return "", err }
    ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
    defer cancel()
    return services.ApplyYaml(ctx, config, yamlContent)
}
```

**Cascade — tam çağrı listesi:**
- `internal/controller/functionBuilder.go:638` — `ApplyYaml(clusterName string, yamlContent string) (string, error)`. **Parametre sırası önemli:** `clusterName` önce, diğer tüm business fn'lerle tutarlı.
- `internal/business/ai.go:237` — `apply_yaml` tool closure'ı `clusterName`'i zaten **alıyor ama atıyor**. Geçir. Bu sessizce AI asistanının yanlış cluster'a apply etmesini de düzeltir.
- `frontend/src/components/workspace/ApplyYamlPanel.tsx` — panelin `clusterName`'i yok. `TabContext.openApplyYaml()` artan bir sayaçla açıyor. **Gerçek bir UX kararı:** panel başlığına cluster seçici ekle, aktif cluster'ı varsayılan yap, seçimi `params.clusterName`'e yaz. `openApplyYaml(clusterName: string)` (TabContext.tsx) ve çağıranı `titlebar/TitleBar.tsx` (Open ▸ Apply YAML) güncelle. Panel id → `applyYaml:${clusterName}:${n}`, başlık `Apply YAML • ${clusterName}`.
- `internal/tui/` — `applyyaml` view'ı `menu.go`/`resourcelist.go` üzerinden dispatch ediliyor; cluster'ı geçir.
- `build/nfpm.yaml` — `depends:` boş kalsın; kubectl'in **gerekmediğini** belirten bir yorum ekle ki kimse shell-out'u geri getirmesin.

**Verify**
```bash
GOEXPERIMENT=jsonv2 go build ./... && GOEXPERIMENT=jsonv2 go vet ./...
grep -rn "exec.LookPath\|kubectl" internal/services/ internal/business/   # kubectl exec kalmamalı
rm -rf frontend/wailsjs && make bindings
grep -n "ApplyYaml" frontend/wailsjs/go/controller_app/App.d.ts          # iki argüman göstermeli
```
Manuel (`~/.kube-ins/` içinde **iki** cluster ile):
1. PATH'ten kubectl'i çıkar, `make dev`.
2. Global aktif cluster **A**. Apply YAML aç, cluster **B** seç, 2 dokümanlı manifest uygula (Namespace + içinde ConfigMap).
3. İkisi de **B**'ye düşmeli, A'ya hiçbiri. Aynı manifesti tekrar uygula → conflict hatası olmamalı.
4. Geçersiz manifest → hata metni hatalı doküman indeksini içermeli ve İngilizce olmalı.

---

## Step 3 — Backend doğruluk paketi: nil-client panic, path traversal, timeout

Üçü de repository/business sınırında; birlikte yapmak üç ayrı bindings regen'ini önler.

**3a. Nil-client dereference — `internal/business/pod.go:13-18`.** `NewK8sClientForCluster` hatası basılıyor ama dönülmüyor; ardından `services.GetPods("", client, mc)` nil `*kubernetes.Clientset` üzerinde `client.CoreV1()` çağırıyor → panic. **Wails tarafında dispatcher recover'ı yok** (sadece `rpcserver.go:267`'de var), yani bağlantı ölüyor ve frontend hiç settle olmayan bir promise'te kalıyor. Bu **kalan tek örnek** — diğer tüm list fn'ler `return nil` yapıyor (referans: `internal/business/deployment.go:11-14`). Şimdilik o kalıba uydur; Step 7 zaten gerçek error return ile değiştirecek.

**3b. clusterName path traversal.** `internal/repository/k8sClient.go:65,82,102` ve `internal/business/cluster.go:67,75,87` hepsi `filepath.Join(home, ".kube-ins", clusterName+".yaml")` yapıyor, sıfır doğrulama ile. `SaveCluster("../../.ssh/authorized_keys")` / `DeleteCluster("../../../etc/foo")` dizinden kaçıyor. Frontend binding'lerinden erişilebilir.

`internal/repository/k8sClient.go`'ya ekle:
```go
// validClusterName matches what ListClusters can produce: one path segment of
// [A-Za-z0-9._-], no leading dot, no separators, no traversal.
var clusterNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`)

func ClusterConfigPath(clusterName string) (string, error) {
    if !clusterNameRe.MatchString(clusterName) || strings.Contains(clusterName, "..") {
        return "", fmt.Errorf("invalid cluster name %q", clusterName)
    }
    home, err := os.UserHomeDir()
    if err != nil { return "", err }
    return filepath.Join(home, ".kube-ins", clusterName+".yaml"), nil
}
```
**Altı** inşa noktasını da buradan geçir (k8sClient.go'daki üç `*ForCluster` + cluster.go'daki üç). `internal/repository/k8sClient_test.go` ekle: `"prod"` ok, `"my-cluster.1"` ok, `"../etc/passwd"` red, `".active"` red, `"a/b"` red. `""` durumu mevcut `clusterName == ""` fallback dalında, doğrulamadan **önce** kalmalı — o yolu bozma.

**3c. Client timeout'ları.** `k8sClient.go` altı constructor'ın hiçbirinde `rest.Config.Timeout` yok; ölü API server'da poll sonsuza kadar asılı kalıyor ve her 2s'de bir yenisi yığılıyor.
```go
const k8sRequestTimeout = 20 * time.Second
func tune(c *rest.Config) *rest.Config { c.Timeout = k8sRequestTimeout; return c }
```
Altı constructor'da `BuildConfigFromFlags` sonrası uygula. **Uzun ömürlü akışlara uygulama** — log stream, exec ve port-forward. Aynı constructor'ı kullanıyorlarsa `NewK8sClientAndConfigForClusterStreaming(clusterName)` ekle (`Timeout: 0` ile kopya); `rest.CopyConfig` zaten `objectYamlServices.go`'da emsal.

Ayrıca list/get/update/delete servis fonksiyonlarındaki `context.TODO()`'yu `context.Background()` yap — timeout artık `rest.Config`'ten geliyor. Akış dosyalarını (`logServices.go`, `podExecServices.go`, `terminalServices.go`, `cliModeServices.go`, `selfUpdate*.go`) hariç tut; onların kendi iptal edilebilir context'leri var. (Toplam 128 site; hariç tutulanlar dışında betikli bir geçişle.)

**Verify**
```bash
GOEXPERIMENT=jsonv2 go test ./internal/repository/... -run TestClusterConfigPath -v
grep -rn "context.TODO()" internal/services/ | wc -l   # sadece akış dosyalarına düşmeli
```
Manuel: bir cluster'ın kubeconfig'ini erişilemez IP'ye çevir, Pods panelini aç → ~20s içinde asılı kalmayı bırakmalı ve panic atmamalı.

---

## Step 4 — IPC hub sertleştirme (localhost:34200)

**Risk: güvenlik-kritik.** `internal/ipc/hub.go`'da iki kusur.

**4a. Origin kontrolü yok, auth yok.** `hub.go:23-25`: `CheckOrigin: func(r *http.Request) bool { return true }`. Hub **sabit** `localhost:34200`'e bağlanıyor. Kullanıcının ziyaret ettiği herhangi bir sayfa `new WebSocket("ws://localhost:34200/ws")` ile bağlanıp register olabilir, çalışan tüm instance'ları listeleyebilir (`MsgInstanceList`) ve `MsgTransferTab` ile uygulamaya keyfi Dockview paneli enjekte edebilir. `SerializedPanel` `componentType` + `params` taşıdığı için bu, herhangi bir kaynağa yönlendirilmiş `yamlEditor`/`objectYaml` paneli veya bir `applyYaml` paneli açmayı kapsar.

**Kopyalanacak referans: `internal/controller/rpcserver.go:359-398`** (`authorized` + `originAllowed`) — `crypto/subtle` ile sabit-zamanlı token karşılaştırma, header-veya-query token (tarayıcı WS handshake'inde header set edemez), boş Origin = tarayıcı-dışı çağıran.

Hub tasarımı:
- Paylaşılan sır: `~/.kube-ins/.hubtoken`, mod `0600`, sunucu olan ilk process `crypto/rand` ile 32 byte hex üretir. İstemciler dial'dan önce okur. Gerekçe: hub **process'ler arası**, o yüzden per-process token işlemez; sadece kullanıcının okuyabildiği bir dosya doğru güven sınırı (`~/.kube-ins/*.yaml` ile aynı sınır). Dosya yoksa/okunamıyorsa **açık moda düşme, bağlanmayı reddet**.
- Sunucu: `CheckOrigin: func(r *http.Request) bool { return r.Header.Get("Origin") == "" }` — tarayıcı WS handshake'te Origin'i **her zaman** gönderir, meşru hiçbir hub istemcisi tarayıcı değil. Tek başına deliği kapatır; token ayrıca başka bir kullanıcı hesabındaki yerel saldırganı engeller.
- İstemci token'ı `?token=` ile gönderir; sunucu REGISTER okumadan **önce** `subtle.ConstantTimeCompare` ile doğrular.
- Upgrade yerine **403** dön ki hata logda görünsün.

**4b. Slice-bounds panic + hayalet client — `hub.go:219`.** `reg.ID[:8]` doğrulanmamış wire verisi üzerinde. `{"id":"x"}` ile REGISTER panic atıyor. Daha kötüsü: panic `h.clients[reg.ID] = client` (`:216`) **sonrasında**, `go client.writePump()` (`:222`) **öncesinde** oluyor — yani map'te yazıcısı olmayan, kalıcı kayıtlı bir client kalıyor; 64 slotluk `sendCh`'i doluyor ve sonraki her `send()` sessizce düşüyor (`default:` dalı), hayalet sonsuza kadar instance listesinde görünüyor.
1. Map'e dokunmadan **önce** payload'ı doğrula: `reg.ID` UUID olarak parse edilebilmeli (`uuid.Parse`) — hub ID'leri `uuid.New()` ile üretiyor, tam da bu şekil.
2. Gösterim için asla slice alma: `func shortID(s string) string { if len(s) > 8 { return s[:8] }; return s }` ekle, hem `:150` hem `:219`'da kullan.
3. `handleWS` başına recover'lı defer ekle (map'ten sil + conn.Close) — kuşak+askı, ve hayalet kaydı yapısal olarak imkânsız kılar.

`serverReadPump`'taki (`hub.go:~240`) çıplak `defer func() { recover() }()`'ı loglayan bir versiyonla değiştir (`log.Printf` — S6 zaten süpürecek).

**Verify**
```bash
GOEXPERIMENT=jsonv2 go test ./internal/ipc/...
```
`internal/ipc/hub_test.go` ekle (`hubAddr`'ı test'in override edebilmesi için package var'a çıkar): (a) `Origin: https://evil.example` ile dial reddedilmeli, (b) token'sız dial reddedilmeli, (c) `{"id":"x"}` REGISTER panic atmamalı ve `len(h.clients) == 0` bırakmalı, (d) geçerli client register olup listede görünmeli.

Manuel: uygulama açıkken bir tarayıcı sekmesinde `new WebSocket("ws://localhost:34200/ws")` → upgrade başarısız olmalı. Sonra iki instance başlat, tab transfer'in hâlâ çalıştığını doğrula.

---

## Step 5 — Session yaşam döngüsü: zombiler, sızan map'ler, restart yarışı

Beş sızıntı, aynı şekil. Her birinin bir referans implementasyonu var.

**5a. Terminal zombileri — `internal/services/terminalServices.go:92-103`.** `CloseTerminalSession` process'i öldürüp pty'yi kapatıyor ama **`cmd.Wait()` çağırmıyor** → kapatılan her terminal paneli başına bir zombi; ayrıca shell kendi kendine çıkınca (kullanıcı `exit` yazınca) reader goroutine kendi map kaydını silmiyor, `termSessions` sonsuza kadar büyüyor ve panel sinyalsiz ölüyor.
**Kopyalanacak referans: `internal/services/cliModeServices.go:216-224`** — doğru yapıyor. Aynen yansıt: reader goroutine'in `defer`'ında `_ = cmd.Wait()`, mutex altında map'ten sil, ve `terminal:exit:{id}` event'i yayınla. `CreateTerminalSession`'a `onExit func()` parametresi ekle (cliMode'un `climode:exit:{id}` sinyali gibi), `functionBuilder.go:437` ve `frontend/src/components/terminal/TerminalPanel.tsx`'e bağla.

**5b. Pod exec sızıntısı — `internal/services/podExecServices.go:94-116`.** `StreamWithContext` goroutine'inin `defer`'ı sadece `stdoutWriter`'ı kapatıyor. Uzak shell çıkınca `execSessions[id]` sonsuza kadar kalıyor, `sizeQueue.ch` hiç kapanmıyor (bir goroutine `Next()`'te sonsuza kadar bloke), ve **`exec:closed:` event'i yayınlanmıyor** — xterm paneli sessizce yanıt vermez oluyor. Uygulamadaki en kafa karıştırıcı hata bu.
**Kopyalanacak referans: `internal/services/logServices.go:170-177`.** Aynısını exec goroutine'ine uygula: defer'da stream'i kapat, cancel et, mutex altında map'ten sil, `onClosed()` çağır. `ClosePodExecSession` de `sizeQueue.ch`'i kapatıyor — çift kapamaya karşı **önce map'ten sil, ancak silme başarılıysa kapat** (map kaydı sahiplik jetonu). `exec:closed:${id}` yayınla; `frontend/src/components/pod/PodExecPanel.tsx`'te `\r\n[session closed]\r\n` yaz ve girdiyi kapat.

**5c. "Deferred cleanup YENİ session'ı siliyor" — dört örnek.** `internal/controller/functionBuilder.go` `:955-973` (StartAiChat), `:44-57` (StartSelfUpdate), `:900-913` (PullAiModel), `:715-728` (TrivyStartK8sScan). Hepsi:
```go
mu.Lock(); if old, ok := m[key]; ok { old.cancel() }; m[key] = new; mu.Unlock()
go func(){ defer func(){ mu.Lock(); delete(m, key); mu.Unlock() }(); ... }()
```
Kullanıcı 1. tur bitmeden 2. turu başlatırsa, 1. turun deferred `delete(m, key)`'i **2. turun** kaydını siliyor. Somut belirti: **AI chat, tool onay diyaloğunda sonsuza kadar asılı kalıyor** — `ConfirmToolCall` `aiSessions[sessionId]`'i bulamıyor, nil dönüyor, agent loop context ölene kadar kanalda bloke.

Düzeltme kalıbı (dördüne de aynen): anahtara göre değil **kimliğe göre** sil.
```go
defer func() {
    mu.Lock()
    if cur, ok := m[key]; ok && cur == sess {   // pointer identity
        delete(m, key)
    }
    mu.Unlock()
    cancel()
}()
```
`internal/controller/`'a test ekle: aynı id için art arda iki session başlat, map'te ikincisinin kaldığını assert et.

**5d. Goroutine recover.** 17 goroutine'in sadece 2'sinde `recover()` var. **Wails'te dispatcher recover'ı yok**, yani bir akış goroutine'indeki panic tüm process'i düşürüyor. `internal/safego/safego.go` ekle:
```go
package safego
// Go runs fn in a goroutine, recovering and logging any panic with a stack.
func Go(name string, fn func()) { /* defer recover + log name, r, debug.Stack() */ }
```
`internal/services/`, `internal/controller/`, `internal/ipc/` içindeki her çıplak `go func()`'ı `safego.Go("name", func(){...})` yap. Bul: `grep -rn "go func()" internal/`.

**Verify**
```bash
GOEXPERIMENT=jsonv2 go test ./internal/controller/... ./internal/services/... -race
grep -rn "go func()" internal/services internal/controller internal/ipc   # boş olmalı
```
Manuel:
1. Terminal paneli aç, `exit` yaz, paneli kapat. `ps -o stat,cmd --ppid $(pgrep -f 'kube-inspector --serve')` → **`Z` (zombie) olmamalı**.
2. Pod exec paneli aç, içinde `exit` → panel `[session closed]` yazmalı.
3. AI chat: mutating tool tetikleyen bir soru sor, **hemen** ikinci mesajı gönder; ikinci turun onay diyaloğu Approve/Deny'e yanıt vermeli.

---

## Step 6 — Yerel loglama + diagnostics blob (telemetri yok)

**Kısıt (`main.go:41-51`): stdout, RPC URL'ini ve shell token'ını taşıyan Electron'a giden özel bir pipe. O protokol dışında hiçbir şey oraya yazmamalı, asla yönlendirilmemeli.** Logger sadece dosyaya yazar.

**6a. `internal/logging/logging.go`** — `log/slog` üzerine ince sarmalayıcı:
- `Init(appVersion string) error` — `~/.kube-ins/logs/` oluştur, `kube-inspector.log` aç (mod 0600), `slog.NewTextHandler` `LevelInfo` (`KUBE_INS_LOG_LEVEL=debug` ile `LevelDebug`).
- Rotasyon: boyut tabanlı, **bağımlılık ekleme**. 5 MB'ı geçince `.1`'e taşı, `.1`→`.2`, `.3`'ü düşür. `*os.File`'ı mutex'li küçük bir `rotatingWriter`'a sar.
- `L() *slog.Logger`; `Init` öncesi no-op handler dönmeli ki `internal/tui` ve testler patlamasın.
- `Tail(n int) []string` — mevcut dosyanın son n satırı (diagnostics blob için).
- Her iki giriş noktasından çağır: `main.go`'nun `serve()` ve Wails dalı, ve `cmd/tui/main.go`. `internal/logging` **Wails'siz** kalmalı (TUI import edecek).

**6b. Print'leri süpür.** `internal/`'daki **44 `fmt.Println` + 3 `log.Printf`**'i `logging.L().Error("...", "err", err, "cluster", clusterName)` ile değiştir. Muaf tutulacaklar (yorumla belgele): `main.go`'nun URL/token `fmt.Println`'leri (protokol), `internal/tui/*` kullanıcıya dönük çıktı.
```bash
grep -rn "fmt.Print\|log.Print" internal/ | grep -v _test.go
```

**6c. Electron shell logu.** `electron/main.cjs:82` sadece `!app.isPackaged`'de logluyor. `rememberLog`'u her zaman `~/.kube-ins/logs/shell.log`'a append edecek şekilde değiştir (aynı rotasyon fikri veya açılışta 1 MB'da truncate), `dialog.showErrorBox` (`:185`) için in-memory `logTail`'i koru. Paketlenmiş çökme şu an tamamen teşhis edilemez durumda.

**6d. Diagnostics blob.** Yeni `internal/business/diagnostics.go` → `GetDiagnostics() (string, error)`. `business.GetAppInfo()` (`internal/business/appInfo.go:122`) zaten app version, Go version ve bağımlılık sürümlerini dönüyor — **onu kullan**.
```
Kube Inspector diagnostics
  version / commit / build date
  go version, GOOS/GOARCH, shell (electron|wails|browser)
  OS release
  clusters configured: 3 (names redacted)
  active cluster: <sha256[:8] of name>
  dependencies: <from GetAppInfo>
  --- last 200 log lines (redacted) ---
```
**Redaction** (`redact(string) string`, unit-test'li): `$HOME` → `~`; `(?i)(bearer|token|password|secret|apikey)[\s:=]+\S+` düşür; ≥40 karakterlik base64-vari dizileri düşür; cluster adlarını (`ListClusters`'tan) `<cluster-1>` ile değiştir; `kubeinspector.com` dışındaki URL'leri scheme+`<host>`'a indir.

`functionBuilder.go`'ya yeni "Diagnostics" bölümü: `GetDiagnostics() (string, error)` ve `OpenLogFolder() error` (mevcut `Transport` üzerinden; Electron'da `shell:relaunch`'ı yansıtan bir `shell:openPath` IPC kanalı ekle — `main.cjs` + `preload.cjs`).

**6e. Frontend.** Yeni `frontend/src/components/diagnostics/DiagnosticsModal.tsx` — read-only monospace `<pre>`, **Copy diagnostics** butonu (`navigator.clipboard.writeText` + Toast) ve **Open log folder**. Erişim: `cluster/AboutModal.tsx`'e "Diagnostics" butonu, ve Step 8'in hata banner'ı/ErrorBoundary fallback'inden (küçük bir `stores/diagnosticsStore.ts` — `themeStore.ts` şablon).

**Verify**
```bash
GOEXPERIMENT=jsonv2 go test ./internal/business/... -run TestRedact -v
grep -rn "fmt.Print\|log.Print" internal/ | grep -v _test.go | grep -v internal/tui   # boş
make dev && ls -la ~/.kube-ins/logs/ && tail -20 ~/.kube-ins/logs/kube-inspector.log
```
Manuel: bir panel poll ederken cluster'ın kubeconfig'ini sil, About → Diagnostics → Copy. Editöre yapıştır: hata görünmeli, **hiçbir** mutlak home path'i, cluster adı veya bearer token görünmemeli.

---

## Step 7 — 24 business list fonksiyonuna error return (BACKEND)

**Risk: YÜKSEK / breaking — plandaki en büyük mekanik değişiklik.** Dokunmadan önce bu bölümün tamamını oku.

### Karar: imzaları değiştir. Paralel mekanizma ekleme.

**Gerekçe:**
1. **Üretilen TypeScript yüzeyi hiç değişmiyor.** Wails hem `[]T` hem `([]T, error)` için `Promise<Array<T>>` üretiyor. Mevcut binding'lerde doğrulandı:
   ```
   App.d.ts:163  GetPods(arg1:string):Promise<Array<models.PodInfo>>;   // Go: []models.PodInfo
   App.d.ts:73   GetCRDs(arg1:string):Promise<Array<models.CRDInfo>>;   // Go: ([]models.CRDInfo, error)
   ```
   Sondaki `error` sadece *runtime* semantiğini değiştiriyor: promise resolve yerine **reject** ediyor. `rpcserver.go` bunu bilinçli olarak yansıtıyor. Yani **hiçbir frontend çağrı sitesinde tip değişikliği gerekmiyor** — `useResourceList.ts:73-81`'deki mevcut `try/catch` reject'i bedavaya almaya başlıyor. Paralel mekanizma (`GetPodsWithError` gibi) binding yüzeyini ve AI tool registry'sini ikiye katlar, eski sessiz yolu da hayatta bırakır.
2. **TUI etki alanı küçük ve regresyon değil, iyileştirme.** `internal/tui/registry.go`'daki `list` closure'ları zaten `func(cluster string) ([]rowData, error)` imzasında — şu an business çağrısının başarısız olduğu bilgisini **atıyorlar** ve boş tablo çiziyorlar. Her closure iki satır kazanıyor. Toplam: tek dosyada **24 çağrı sitesi**, artı `internal/tui/{monitoring,exec,logs,crd,clusters}.go`'da birkaç tane. (`grep -rn "business.Get" internal/` sadece 8 TUI dosyasına düşüyor.)
3. `internal/business/ai.go`'da etkilenen tek site `:132` (`list_pods`) ve kardeşleri — tool `Run` closure'ları zaten `(string, error)` dönüyor.
4. **Reddedilen anti-pattern:** hem hatayı loglayıp hem hata durumunda nil-olmayan slice dönmek. Birini seç: hatada **`return nil, err`**. Çağıranlar ikisini birden kontrol etmek zorunda kalmamalı.

### Tekrarlanabilir kalıp

**Referans: `internal/business/deployment.go:10-22`** (zaten iki-dallı şekilde, sadece error return'ü yok).

24 dosya (`internal/business/`):
```
pod.go deployment.go statefulSet.go replicaSet.go daemonSet.go job.go cronJob.go
service.go ingress.go ingressClass.go endpoint.go networkPolicy.go configMap.go
secret.go serviceAccount.go role.go roleBinding.go namespace.go node.go
persistentVolume.go persistentVolumeClaim.go storageClass.go limitRange.go event.go
```
```go
// SONRA
func GetX(clusterName string) ([]models.XInfo, error) {
    client, err := repository.NewK8sClientForCluster(clusterName)
    if err != nil {
        return nil, fmt.Errorf("connect to cluster %q: %w", clusterName, err)
    }
    items, err := services.GetX("", client)
    if err != nil {
        return nil, fmt.Errorf("list x in cluster %q: %w", clusterName, err)
    }
    return items, nil
}
```
`GetPods` ayrıca metrics client alıyor — `mc, _ := repository.NewMetricsClientForCluster(...)` **toleranslı kalsın** (metrics-server gerçekten opsiyonel; `podServices.go` zaten `usage < 0`'ı "yok" olarak kodluyor), ama metrics hatasını `logging.L().Debug` ile **logla**.

**Hata mesajı sarmalaması bu step'in bütün amacı** — banner'da kullanıcının göreceği metin buradan geliyor. `verb + object + cluster: %w` kalıbını izle, böylece RBAC 403 şöyle görünür:
`list pods in cluster "prod": pods is forbidden: User "dev" cannot list resource "pods" in API group "" at the cluster scope`

**Controller (`functionBuilder.go`), 24 metot:** düz pass-through, `return bussiness.GetX(clusterName)`. Burada loglama — business zaten sardı.

**TUI (`internal/tui/registry.go`), 24 `list` closure'ı:**
```go
list: func(c string) ([]rowData, error) {
    items, err := business.GetX(c)          // <- YENİ iki satır
    if err != nil { return nil, err }
    ...
},
```
Generic list ekranı (`internal/tui/resourcelist.go`) error return'ü zaten alıyor — **yuttuğunu değil gösterdiğini doğrula**; yutuyorsa status bar'da göster.

**Diğer TUI çağıranlar:** `internal/tui/{monitoring,exec,logs,crd,clusters,describe}.go` — grep'le ve düzelt.

**AI (`internal/business/ai.go`):** list çağıran her tool closure'ı `items, err := GetPods(clusterName); if err != nil { return "", err }`. Agent loop tool hatasını modele tool result olarak zaten iletiyor — bu, modelin "cluster boş" halüsinasyonu görmesinden kesinlikle daha iyi.

### Bu step'i çalıştıran oturuma tavsiye
**Kaynak kaynak ilerle**, her birinden sonra derle: `pod → deployment → …`. `go build ./...` kalan her çağrı sitesini gösterecek. **Repo geneli sed deneme** — `registry.go`'daki closure gövdeleri farklı.

**Verify**
```bash
GOEXPERIMENT=jsonv2 go build ./... && GOEXPERIMENT=jsonv2 go vet ./...
grep -rn "^func Get[A-Za-z]*(clusterName string) \[\]models\." internal/business/   # boş olmalı
grep -rn "wailsapp/wails" internal/tui cmd/tui                                      # boş olmalı
rm -rf frontend/wailsjs && make bindings
cd frontend && npx tsc --noEmit    # SIFIR değişiklikle geçmeli — 1. maddeyi kanıtlar
GOEXPERIMENT=jsonv2 go build ./cmd/tui
```
Manuel: ölü IP'li kubeconfig ile TUI → boş tablo değil, bağlantı hatası göstermeli.

---

## Step 8 — UI'da hata + yükleme durumu (FRONTEND)

**Step 7'ye bağımlı.** Beta deneyimindeki en büyük kazanç: bugün RBAC-403, ölü API server ve gerçekten boş namespace ~21 view'da **aynı** `"No pods found"` metnini veriyor.

**8a. `frontend/src/lib/useResourceList.ts`.** `UseResourceListResult`'a (satır 30-49) ekle:
```ts
error: string | null;
loading: boolean;      // sadece İLK yükleme settle olana kadar true
refreshing: boolean;   // arka plan poll'ü sırasında true (tabloyu boşaltma)
```
`reload`'u (73-81) yeniden yaz:
```ts
try {
    const data = await fetcher(clusterName);
    setItems(data.map(createFrom));
    setError(null);
} catch (e: any) {
    // Son iyi satırları görünür tut; geçici bir poll hatası kullanıcının
    // okuduğu tabloyu boşaltmamalı. Banner verinin bayat olduğunu söyler.
    setError(errText(e));
} finally {
    setLoaded(true);
}
```
**Kritik davranış değişikliği: hatada `setItems([])` çağırmayı bırak.** Paylaşılan `frontend/src/lib/errText.ts` ekle — CRD explorer'da zaten yerel bir `errText` var; **onu `lib/`'e taşı** ve oradan import et, kopyalama.

Bu dosyadayken kimlik çalkantısını da düzelt: `buildInOptions`'ı (132-146) `items` yerine `useMemo`'lu türetilmiş bir imzaya bağla (tam perf işi S14, ama burası bedava).

**8b. `frontend/src/components/shared/ResourceListView.tsx`.** Toolbar ile tablo arasına banner. **Kopyalanacak referanslar:** `crd/InstanceTable.tsx:229` ve `security/SecurityRoleMap.tsx:525-528` (VscWarning + mesaj + Retry). 21 view'ın hepsi aynısını alsın diye paylaşılan bileşen:

Yeni `frontend/src/components/shared/ErrorBanner.tsx`:
```tsx
<ErrorBanner message={error} onRetry={reload} onDiagnostics={openDiagnostics} />
```
`theme-monolith.css`'ten `var(--red)` kullan, `#ef4444` **hardcode etme** (S14g). Kapatılabilir strip: VscWarning + mesaj + **Retry** + **Copy diagnostics** (S6'nın `diagnosticsStore`'una bağlı).

Üç yönlü ayrımı doğru kur: `loading` → spinner/skeleton; `error && items.length === 0` → banner (empty message **yerine**); `!error && items.length === 0` → `emptyMessage`. Bu ayrım step'in bütün amacı.

**8c. React error boundary.** `frontend/src/` içinde **hiç yok**. `frontend/src/components/shared/PanelErrorBoundary.tsx` (class, `componentDidCatch` → console.error + stack'i `diagnosticsStore`'a) ve şunları sar:
- `workspace/DockviewContainer.tsx`'teki `components` map değerlerini **tek seferde**: `Object.fromEntries(Object.entries(components).map(([k,C]) => [k, withBoundary(C)]))`. Böylece çöken bir panel tüm pencereyi beyazlatmak yerine retry kartı gösterir.
- `pages/main/appmain.tsx`'te app kökü.
Fallback UI **Reload panel** + **Copy diagnostics** sunmalı.

**8d. `ResourceListView` kullanmayan dört el-yazımı view** — aynı `error`/`loading` + `<ErrorBanner>`: `node/main.tsx:231-234`, `resourcequota/main.tsx:157-160`, `overview/main.tsx:60`, `monitoring/main.tsx:179`.

**8e. Bu dosyalardaki iki gerçek hata, hazır oradayken:**
- `monitoring/main.tsx:240,245` — **aynı** `clusterTrend` veri seti hem "Cluster CPU" hem "Cluster Memory" kartına çiziliyor. `metricsStore.ts`'ten `cpuTrend`/`memTrend` olarak ayır.
- `events/main.tsx:88` ve `resourcequota/main.tsx:149` — hiç kullanılmayan `Toast` ref'leri. Ya yeni hata yüzeyine bağla ya sil.

**8f. İlk frontend testleri** (vitest S1'de eklendi): `frontend/src/lib/useResourceList.test.ts` — (a) reject eden fetcher `error`'ı set edip önceki `items`'ı **korumalı**, (b) resolve eden fetcher `error`'ı temizlemeli, (c) `loading` sadece ilk settle öncesi true.

**Verify**
```bash
cd frontend && npx tsc --noEmit && npm run test && npm run build
grep -rn "setItems(\[\])" frontend/src/lib/useResourceList.ts   # kalmamalı
```
Manuel, Pods panelinde üç yönlü ayrım:
1. Ölü IP'li kubeconfig → bağlantı hatalı kırmızı banner + Retry.
2. `list pods` RBAC'i olmayan kullanıcı → banner birebir 403 metnini göstermeli.
3. Sağlıklı cluster + boş namespace → düz `No pods found`, **banner yok**.
4. Bir column body'ye geçici `throw` koy → panel boundary kartı göstermeli, uygulamanın geri kalanı çalışmaya devam etmeli.

---

## Step 9 — Eksik eylemler A: Describe, Resource Quota, eksik delete/update, namespace create

**Saf ekleme. Mevcut hiçbir davranış değişmiyor. Düşük risk.** S10 ve S11 ile paralel çalışabilir (üçü de bindings regen ettiği için ya sıraya koy ya her biri kendi regen'ini koşsun).

**9a. Describe — plandaki en ucuz kazanç.** `business.GetObjectDescribe` (`internal/business/objectYaml.go:89` → `internal/services/objectYamlServices.go:119`) **tamamen yazılmış**, API üzerinden `k8s.io/kubectl/pkg/describe` kullanıyor, subprocess yok, CRD'ler için generic-describer fallback'i bile var. Sadece **bind edilmemiş** — sadece TUI erişiyor (`internal/tui/describe.go`).
- `functionBuilder.go` "Generic object CRUD" bölümüne (`:755` civarı): `GetObjectDescribe(clusterName, resource, namespace, name string) (string, error)`.
- Yeni `frontend/src/components/workspace/DescribePanel.tsx` — read-only, monospace, `white-space: pre`, Refresh + copy butonu. **Monaco kullanma** (düz metin dökümü, ve Monaco bundle'daki en ağır import — S14).
- `DockviewContainer.tsx:30-44`'e `describe: DescribePanel` kaydet.
- `TabContext.tsx` — `DescribePanelDef { clusterName, resource, name, namespace, referencePanel }` + `openDescribePanel(def)`; id `describe:${clusterName}:${resource}:${namespace}/${name}`, başlık `Describe ${name} • ${clusterName}`; mevcut `positionAfter()` helper'ını kullan.
- Her `ResourceListView` view'ına "Describe" satır eylemi. **Tek seferde yap**: `ResourceListView`'a opsiyonel `describeResource?: string` prop'u ekle (çoğul, ör. `"pods"`) ve butonu action kolonunda otomatik render et — her `main.tsx` buton yerine tek prop kazanır. Çoğul stringler `internal/tui/registry.go`'daki `view` adlarıyla eşleşiyor, aynı sözlüğü kullan.
- Security Role Map detay modalı ve CRD `InstanceTable`'a da Describe ekle — ikisi de zaten (group, resource, ns, name) konuşuyor.

**9b. Resource Quotas.** `business.GetResourceQuotas` (`internal/business/resourceQuota.go:10`) yazılmış, TUI kullanıyor (`registry.go:435`), bind edilmemiş. GUI'nin `resourcequota/main.tsx`'i şu an quota verisini `GetNamespaces`'ten yeniden kuruyor. Bind et ve view'ı ona çevir. (`GetResourceQuotaYaml`/`UpdateResourceQuotaYaml` zaten bağlı, `:151`/`:155`.)

**9c. Eksik delete'ler** — business/controller fn'i hiç olmayan: **ServiceAccount, Role, RoleBinding, LimitRange, IngressClass, Endpoint, PersistentVolume, StorageClass, Node**.
- **Typed** (`internal/services/deploymentServices.go::DeleteDeployment` kalıbı + `internal/services/errors.go`'daki `errNamespace*Required` guard'ı): ServiceAccount, Role, RoleBinding, LimitRange, Endpoint.
- **Generic** mevcut `business.DeleteObject(cluster, group, resource, ns, name)` üzerinden (TUI resourcequota'lar için zaten böyle yapıyor, `registry.go:462`): IngressClass, PersistentVolume, StorageClass.
- **Node**: düz delete **ekleme**. Node objesini silmek yıkıcı bir topoloji operasyonu ve uygulama zaten cordon/drain sunuyor. **Öneri: beta için Node delete'i atla**, Known Limitations'a yaz (S16).
- Sonra: ilgili `main.tsx`'lerde `ResourceListView`'a `deleter=`, ve `internal/tui/registry.go`'daki `resourceDef`'e `del:` ekle ki TUI de kazansın.

**9d. Eksik update'ler** — Job, IngressClass, Endpoint, PV, PVC, StorageClass'ta `GetXYaml` var ama `UpdateXYaml` yok, YAML paneli sebepsiz read-only. `internal/services/deploymentServices.go::UpdateDeploymentYaml` kalıbıyla ekle (unmarshal → ns/name'i zorla → `Update`). Job'da `spec`'in çoğu immutable — update net bir API hatası verecek, ki Step 8'in banner'ı artık onu doğru gösteriyor; bu kabul edilebilir ve dürüst.

**9e. Namespace create.** `GetNamespaces`/`DeleteNamespace`/`GetNamespaceYaml` var, create yok. `business.CreateNamespace(clusterName, name string, labels map[string]string) error` → `services.CreateNamespace`. `namespace/main.tsx`'e "+ New Namespace" butonu + küçük dialog.

**Verify**
```bash
GOEXPERIMENT=jsonv2 go build ./... && rm -rf frontend/wailsjs && make bindings
grep -c "GetObjectDescribe\|DeleteServiceAccount\|CreateNamespace" frontend/wailsjs/go/controller_app/App.d.ts
cd frontend && npx tsc --noEmit && npm run build
```
Manuel: Pods → bir pod'da Describe → Events dahil tam `kubectl describe` metni. `kubectl describe pod <name> -n <ns>` ile karşılaştır. Bir ServiceAccount, bir Role, bir Endpoint sil. Namespace oluştur, sonra sil.

---

## Step 10 — Eksik eylemler B: Scale ve Rollout Restart

`frontend/wailsjs/go/controller_app/App.js`'te **hiç `Scale*` veya `Restart*`/`Rollout*` binding'i yok**. Kullanıcıların ilk beş dakikada ihtiyaç duyduğu iki eylem bunlar.

**10a. Scale — Deployment, StatefulSet, ReplicaSet.** Tam obje update'i değil, **`scale` subresource'u** kullan — tam update controller ile yarışır ve eşzamanlı değişiklikleri ezer.

Yeni `internal/services/scaleServices.go`:
```go
func ScaleWorkload(ctx context.Context, client *kubernetes.Clientset, kind, namespace, name string, replicas int32) error {
    if namespace == "" || name == "" { return errNamespaceNameRequired }
    if replicas < 0 { return fmt.Errorf("replicas must be >= 0") }
    sc := &autoscalingv1.Scale{
        ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
        Spec:       autoscalingv1.ScaleSpec{Replicas: replicas},
    }
    switch kind {
    case "deployment":  _, err := client.AppsV1().Deployments(namespace).UpdateScale(ctx, name, sc, metav1.UpdateOptions{}); return err
    case "statefulset": _, err := client.AppsV1().StatefulSets(namespace).UpdateScale(ctx, name, sc, metav1.UpdateOptions{}); return err
    case "replicaset":  _, err := client.AppsV1().ReplicaSets(namespace).UpdateScale(ctx, name, sc, metav1.UpdateOptions{}); return err
    }
    return fmt.Errorf("scaling not supported for %s", kind)
}
```
`internal/business/scale.go` → `ScaleWorkload(clusterName, kind, name, namespace string, replicas int32) error`.
Controller: `ScaleWorkload(clusterName, kind, name, namespace string, replicas int) error` — **`int32` değil `int`**: JS'te int32 yok, üretilen TS zaten `number`; controller'da dönüştür ve aralık kontrolü yap.

**10b. Rollout restart — Deployment, StatefulSet, DaemonSet.** `kubectl rollout restart`'ı birebir taklit et: pod template annotation'ını **strategic-merge-patch** et, pod silme.
```go
patch := fmt.Sprintf(
  `{"spec":{"template":{"metadata":{"annotations":{"kubectl.kubernetes.io/restartedAt":"%s"}}}}}`,
  time.Now().Format(time.RFC3339))
// types.StrategicMergePatchType ile Deployments/StatefulSets/DaemonSets Patch
```
kubectl ile aynı annotation anahtarını kullan ki `kubectl rollout status`/`history` tutarlı kalsın. **ReplicaSet ve Job'da rollout yok** — sessizce hiçbir şey yapmak yerine net "not supported" hatası dön; frontend o kind'larda butonu gizler.

**10c. Frontend.**
- Yeni `frontend/src/components/shared/ScaleDialog.tsx` — mevcut replica sayısı dolu, `InputNumber` min 0, 0'a çekerken uyarı, Confirm/Cancel, hata panel `Toast`'unda.
- `components/{deployment,statefulset,replicaset,daemonset}/main.tsx` action kolonuna **Scale** ve **Restart**. Restart `ConfirmDialog` ile onaylı, Scale dialog açar.
- Başarılı eylemden sonra `reload()` çağır — `ResourceListView`'ın `ColumnsContext`'i şu an sadece `{items, buildInOptions}` taşıyor, `reload` ekle.
- TUI pariteti: `registry.go`'da ilgili `resourceDef`'lere `rowAction` ekle (node cordon/drain emsali `:403-407`). Tuşlar: `s` = scale (prompt), `r` = restart (confirm).

**Verify**
```bash
GOEXPERIMENT=jsonv2 go build ./... && rm -rf frontend/wailsjs && make bindings
cd frontend && npx tsc --noEmit
```
Manuel (kind cluster):
```bash
kubectl create deploy nginx --image=nginx --replicas=2
# Uygulamada: Deployments → nginx'i 5'e scale et:
kubectl get deploy nginx -o jsonpath='{.spec.replicas}'      # 5
# Uygulamada: Restart nginx:
kubectl get deploy nginx -o jsonpath='{.spec.template.metadata.annotations}'
kubectl rollout history deploy/nginx
```
0'a scale de çalışmalı ve liste `Scaled Down` göstermeli (bu durum `deploymentToInfo`'da zaten var).

---

## Step 11 — Port forwarding: tam session modeli

**En büyük yeni özellik. Yaşam döngüsü kararı işin can alıcı kısmı.**

### Yaşam döngüsü kararı
Log ve exec session'ları **panele bağlı**: panel açar, panel kapanınca ölür. Port-forward bunun **tersi** olmalı — **process'e bağlı**. Kullanıcı `localhost:8080 → svc/api:80` başlatır, paneli kapatıp tarayıcısında çalışmaya gider. Panel kapanınca tüneli öldürmek hatadan ayırt edilemez.
- Forward'lar servis katmanında **process-global registry**'de yaşar (`logSessions`/`execSessions` gibi), ama panel dispose'ta hiçbir şey onları kapatmaz.
- "Port Forwards" paneli backend registry'sine **bakan bir view**, sahibi değil. State `ListPortForwards()` ile çekilir → panel kapanıp açılınca aynı canlı forward'lar görünür, pencere reload'unda da hayatta kalır.
- Sadece kullanıcı açıkça durdurur veya process çıkışında `StopAllPortForwards()` (`Server.Close` / Wails shutdown).
- Forward'lar **instance başına**, instance'lar arası paylaşılmaz (yerel port bind ediyorlar; aynı yerel portu iki instance forward ederse ikincisi "address already in use" alır — bu doğru ve dürüst).

### Model — yeni `internal/models/portForwardInfo.go`
```go
type PortForwardInfo struct {
    ID, ClusterName, Namespace string
    ResourceKind string  // pod | deployment | statefulset | replicaset | service
    ResourceName, PodName string
    LocalPort, RemotePort int   // LocalPort: 0 istendiyse gerçekte bağlanan port
    Address string              // her zaman 127.0.0.1
    Status  string              // starting | ready | error | closed
    Error   string
    StartedAt string            // RFC3339
}
```

### Services — yeni `internal/services/portForwardServices.go`
`StartPortForward(id, cfg, client, req, onEvent) (models.PortForwardInfo, error)`:
1. **Hedef çözümleme.** Port-forward yalnızca **Pod**'a karşı çalışır.
   - `pod` → doğrudan.
   - `deployment`/`statefulset`/`replicaset` → **`internal/services/logServices.go`'daki mevcut helper'ları kullan** (`GetDeploymentPods`, `GetStatefulSetPods`, `GetReplicaSetPods` ve ortak `podsByLabelSelector`). İkinci bir selector resolver yazma. Phase `Running` **ve** tüm container'ları ready olan ilk pod'u seç; yoksa net hata.
   - `service` → `Services(ns).Get(...)`, `spec.selector`'ı `podsByLabelSelector` ile çöz, istenen service port'unu `targetPort`'a eşle (isimli targetPort'u pod'un container port'larından çöz).
2. **Dialer:**
   ```go
   url := client.CoreV1().RESTClient().Post().
       Resource("pods").Namespace(ns).Name(pod).SubResource("portforward").URL()
   transport, upgrader, err := spdy.RoundTripperFor(cfg)
   dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, "POST", url)
   ```
   **Step 3c'nin streaming rest config'ini kullan** (`Timeout: 0`); 20s timeout tüneli öldürür.
3. **Sadece loopback bind — pazarlık konusu değil.** `portforward.NewOnAddresses(dialer, []string{"127.0.0.1"}, ports, stopCh, readyCh, out, errOut)` kullan, `portforward.New` **değil** (o `localhost` bind eder → `::1` içerebilir ve tarihsel olarak daha genişti). Frontend'den asla adres parametresi kabul etme. Nedenini yoruma yaz: forward edilmiş bir port, cluster iş yüküne kimliksiz erişimdir.
4. **Yerel port 0 = otomatik.** `readyCh` kapandıktan sonra `fw.GetPorts()` ile gerçek `Local`'i `info.LocalPort`'a yaz, sonra `ready` yayınla.
5. Goroutine `safego.Go` ile (S5d): `fw.ForwardPorts()` bloklar; dönünce mutex altında registry'den sil, `closed`/`error` durumunu `onEvent` ile yayınla.
6. **Ready bekleme**: `select { case <-readyCh: case <-time.After(15*time.Second): stop; return error }`. Dolu `PortForwardInfo`'yu senkron dön ki UI bağlanan portu hemen gösterebilsin.
7. `out`/`errOut` `io.Writer` — atma, `logging.L().Debug`'a bağla.

`StopPortForward(id)` — `s.once.Do(func(){ close(s.stopCh) })`, mutex altında sil, idempotent. `ListPortForwards()` — mutex altında snapshot, `StartedAt`'e göre sıralı. `StopAllPortForwards()` — shutdown'dan çağrılır.

### Business / Controller
`internal/business/portForward.go` — cluster'ın streaming client+config'ini çözüp delege eder.
`functionBuilder.go` yeni "Port Forwarding" bölümü:
```go
func (a *App) StartPortForward(clusterName, kind, name, namespace string, localPort, remotePort int) (models.PortForwardInfo, error)
func (a *App) StopPortForward(id string) error
func (a *App) ListPortForwards() []models.PortForwardInfo
```
`StartPortForward` id'yi `uuid.New()` ile üretir, `onEvent` = `a.emit("portforward:update", info)`. **Session-son ekli event değil, tek broadcast kanal** — log/exec'in aksine tüketici tek bir registry view'ı, payload id taşıyor. Start'ta ve close'ta da yayınla. Shutdown yoluna (`rpcserver.go`'da `Server.Close`, Wails `OnShutdown`) `StopAllPortForwards()` kaydet.

### Frontend
- Yeni `frontend/src/components/portforward/main.tsx` — `ViewPanel.tsx`'te `portforwards` view'ı + `menuItems.tsx`'te menü girdisi. Kolonlar: cluster, kind/name, namespace, `127.0.0.1:local → remote`, status tag, age, Stop, ve `BrowserOpenURL(\`http://127.0.0.1:${local}\`)` çağıran Open. Veri `ListPortForwards()`'tan, `portforward:update` event'i (`EventsOn`) + 5s güvenlik poll'ü ile tazelenir.
- Yeni `frontend/src/components/shared/PortForwardDialog.tsx` — yerel port (boş = otomatik), uzak port (satırdan ön dolu), Start.
- `pod/`, `service/`, `deployment/`, `statefulset/` `main.tsx`'lerine "Port forward" satır eylemi (S9'daki Describe ile aynı action-column kalıbı).
- Bu view `api` prop'unu alsın ve `usePanelActive` kullansın (S14 kuralı) — forward'lar backend'e ait olduğu için poll'ü duraklatmak zararsız.

**Beta kapsamı dışı:** tünel ölünce otomatik yeniden bağlanma (`error` durumu göster, kullanıcı yeniden başlatsın) ve Service ClusterIP'sine forward (kubectl gibi arkadaki pod'a forward ediyoruz).

**Verify**
```bash
GOEXPERIMENT=jsonv2 go build ./... && GOEXPERIMENT=jsonv2 go vet ./...
grep -n "NewOnAddresses" internal/services/portForwardServices.go   # olmalı, portforward.New olmamalı
rm -rf frontend/wailsjs && make bindings && cd frontend && npx tsc --noEmit
```
Manuel (kind):
```bash
kubectl create deploy nginx --image=nginx && kubectl expose deploy nginx --port=80
# App: Services → nginx → Port forward → local boş, remote 80 → Start
curl -sSI http://127.0.0.1:<port>/ | head -1     # HTTP/1.1 200 OK
ss -ltnp | grep <port>                            # 127.0.0.1 OLMALI, asla 0.0.0.0
# Paneli kapat, yeniden aç -> forward hâlâ listede ve çalışıyor.
# UI'dan durdur -> curl başarısız.
kubectl delete pod -l app=nginx                   # tünel ölür -> status "error", panic yok
# Uygulamadan çık -> ss portun serbest bırakıldığını göstermeli.
```

---

## Step 12 — i18n altyapısı + İngilizce katalog + dil seçici

**Kapsam disiplini (step'e yaz, kapsam patlamasını önler):**
- **Çevrilecek:** menü/nav etiketleri, panel başlıkları, kolon başlıkları, butonlar, dialoglar, toast'lar, boş-durum ve hata-banner *çerçeve* metni, ayarlar, About, tur adımları (`lib/tourSteps.ts`).
- **Çevrilmeyecek:** cluster'dan gelen Kubernetes API değerleri (`Running`, `Pending`, kind adları, reason'lar, RBAC verb'leri), YAML içeriği, backend hata metni (Kubernetes'in kendi ifadesi; çevirmek aranabilirliği bozar), log çıktısı, kaynak adları.
- **Sözlük:** `frontend/src/locales/GLOSSARY.md` — her dilde İngilizce kalacak terimler: Pod, Deployment, StatefulSet, ReplicaSet, DaemonSet, Job, CronJob, Namespace, ConfigMap, Secret, Ingress, Service, Node, PersistentVolume, StorageClass, ServiceAccount, RoleBinding, CRD, YAML, kubectl, kubeconfig, Kube Inspector, Trivy, Ollama.

**12a. Bağımlılıklar.** `i18next`, `react-i18next`. `i18next-browser-languagedetector` **ekleme** — `app://` altında güvenilecek tarayıcı-dil bağlamı yok; `en` varsayılan, seçim persist edilir.

Yeni `frontend/src/i18n/index.ts`:
```ts
// Kataloglar code-split: sadece aktif locale (+ en fallback) indirilir.
const loaders = import.meta.glob('../locales/*/*.json');
```
`fallbackLng: 'en'`, `ns: ['common','nav','resources','panels','errors','settings']`, `defaultNS: 'common'`, `interpolation:{escapeValue:false}`, `returnNull:false`, dev'de `console.warn`'layan `missingKeyHandler`. `main.tsx`'te **`wailsBridge.ts`'ten sonra** import et (wailsBridge ilk kalmalı — global'leri o kuruyor) ve ağacı `<Suspense>` ile sar.

**12b. Locale store.** Yeni `frontend/src/stores/localeStore.ts` — **`stores/themeStore.ts`'i birebir şablon al** (zustand + `persist`, localStorage anahtarı `kube-ins-locale`, flash olmaması için modül yüklenirken senkron uygula). `document.documentElement.lang`'i de set etmeli. Diller: `en, tr, de, ru, zh, ja` (görünen adlar: English, Türkçe, Deutsch, Русский, 中文, 日本語).

**12c. Seçici.** `titlebar/TitleBar.tsx`'teki mevcut menüye tema seçicinin yanına dil `Dropdown`'ı — aynı kalıp, yeni UI kabuğu gerekmiyor.

**12d. Anahtar isimlendirme** (`frontend/src/locales/README.md`'ye yaz):
```
common:    action.delete, action.cancel, action.retry, state.loading, state.noResults
nav:       group.workloads, item.pods
resources: pods.title, pods.column.status, pods.empty, pods.delete.confirm_one / _other
panels:    yaml.title, describe.title, portforward.local_port
errors:    banner.title, banner.copy_diagnostics, boundary.title
settings:  language.label, theme.label
```
i18next çoğul son eklerini kullan (`_one`/`_other`) — Rusça `_few` de istiyor; i18next bunu locale'in çoğul kurallarından otomatik çözüyor, yani **en** kataloğu sadece `_one`/`_other` tanımlar, çevirmenler gerektiğinde `_few`/`_many` ekler. Parite denetleyicisi (S13) fazladan çoğul formlara izin vermeli.

**12e. İngilizce çıkarma — mekanik geçiş.** ~68 `.tsx`. Sıra:
1. `components/menu/menuItems.tsx` + `contexts/TabContext.tsx` (`:13-37`'deki `viewLabels` map'i panel başlıklarının tek kaynağı — değerlerini `nav.item.*` anahtarlarına çevir, `openTab`/`openReceivedPanel`'de render anında çevir).
2. `components/shared/ResourceListView.tsx` + `ErrorBanner.tsx` — bu tek dosya **21 list view'ın** toolbar'ını, delete dialog'unu ve empty message'ını **aynı anda** kapsıyor. En yüksek kaldıraç, ikinci sırada yap.
3. 21 `components/*/main.tsx` — (2)'den sonra sadece kolon `header=` stringleri ve action tooltip'leri kalıyor.
4. Paneller: `workspace/*`, `logs/`, `terminal/`, `pod/PodExecPanel`, `crd/`, `security/`, `monitoring/`, `overview/`, `node/`, `resourcequota/`, `events/`, `titlebar/`, `cluster/`, `diagnostics/`, `portforward/`.
5. `lib/tourSteps.ts` — const yerine `t` alan bir fonksiyona dönüşür.

**12f. Koruma bariyerleri** (S13'ün zorlayabilmesi için burada eklenir). ESLint: `eslint-plugin-i18next`, `i18next/no-literal-string` kuralı `frontend/src/components/**/*.tsx` kapsamında, `markupOnly: true`, `onlyAttribute: ['header','label','title','placeholder','tooltip','emptyMessage','summary','detail']`, glossary terimleri + CSS/class stringleri için `ignore` listesi. Bu step'te **warn**, S13'te katalog tamamlanınca **error**.

**Verify**
```bash
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```
Manuel: seçiciyi İngilizce ile diğer diller arasında değiştir (S13'e kadar İngilizce göstermeye devam edecekler — bu beklenen ara durum ve fallback'in çalıştığını kanıtlıyor). Yeniden başlat → seçim korunmalı. `document.documentElement.lang` güncellenmeli.

---

## Step 13 — tr / de / ru / zh / ja çevirileri + çürüme koruması

**Çeviriler gerçekte nasıl üretilecek (dürüst ol):**
1. `en` S12'den gelen elle yazılmış tek doğru kaynak. `en` tamamlanmadan hiçbir şey çevrilmez.
2. Diğer beşi **bu oturumda, model tarafından, namespace dosyası dosya** `en`'den çevrilir; `GLOSSARY.md` çevrilmeyecekler listesi olarak verilir. Bu, sözlüklü makine çevirisi — beta için yeterli ve bütçesiz tek gerçekçi seçenek.
3. **Türkçe insan gözden geçirmesi alır** — maintainer ana dili konuşuyor. `locales/README.md`'de tr'yi "reviewed", de/ru/zh/ja'yı **"machine-translated, community corrections welcome"** olarak işaretle ve **uygulamada da söyle**: dil seçicisinin altına çeviri düzeltme issue template'ine (S16) link veren tek satırlık not. Bu doğru beklentiyi kurar ve beta-aşaması OSS'te standart pratiktir.
4. UI-fit kontrolü: Almanca ve Rusça stringler İngilizce'den tipik olarak %20-35 daha uzun; Çince/Japonca daha kısa ama farklı satır kırma istiyor. Çeviriden sonra uygulamayı `de` ve `ru`'da çalıştır, taşan buton/kolonları **çeviriyi kısaltarak değil** CSS ile düzelt (`text-overflow: ellipsis` + `title` attribute).

**13a. Dosyalar.** `frontend/src/locales/{tr,de,ru,zh,ja}/{common,nav,resources,panels,errors,settings}.json` — 30 dosya, `en` ile aynı anahtar yapısı.

**13b. Parite denetleyicisi** — yeni `frontend/scripts/i18n-check.mjs`:
- `src/locales/*/` gezer, (locale, namespace) başına düzleştirilmiş anahtar kümesi kurar.
- `en`'de olup bir locale'de olmayan anahtar → **fail**.
- `en`'de olmayıp bir locale'de olan anahtar → **fail** (ölü anahtarlar sessizce çürür). Çoğul son ekleri (`_zero,_one,_two,_few,_many,_other`) için allowlist.
- Bir locale'in değerlerinin >%20'si `en` ile birebir aynıysa → **warn** (kopyalanmış ama çevrilmemiş dosya işareti). Glossary terimleri hariç.
- Interpolation placeholder kümesi farklıysa → **fail** (`{{count}}` en'de var tr'de yok = runtime'da bozuk string). Bu, en yaygın MT hata modunu yakalar.
- `package.json`'a `"i18n:check": "node scripts/i18n-check.mjs"`, `make check`'e ve `ci.yml`'deki `frontend` job'ına ekle.

**13c. Lint kuralını çevir.** `i18next/no-literal-string` `warn` → **`error`**. Bundan sonra yeni bir hardcoded UI stringi CI'ı kırar. Asıl çürüme koruması bu: parite denetleyicisi katalogların ayrışmasını, lint kuralı yeni stringlerin katalogları atlamasını durdurur.

**Verify**
```bash
cd frontend && npm run i18n:check && npm run lint && npm run build
```
Manuel: 6 dilin her biri için Pods, Deployments, Nodes, Monitoring ve CRD panelleri + delete dialog + About modal'ı aç. Kontrol: hiçbir yerde ham anahtar (`resources.pods.title`) görünmemeli, `de`/`ru`'da kırpılmış buton olmamalı, Kubernetes isimleri İngilizce kalmalı, hata banner'ının çerçevesi çevrilmiş ama Kubernetes hata metni İngilizce olmalı.

---

## Step 14 — Performans ve render hijyeni

**S8 ve S13'ten sonra** yapılmalı — aynı frontend dosyalarına dokunuyor.

**14a. Pencere gizliyken poll'ü durdur.** Hiçbir yerde `visibilitychange`/`document.hidden` yok. Yeni `frontend/src/lib/useDocumentVisible.ts`; `useResourceList.ts:82-87` içinde `usePanelActive` ile birleştir:
```ts
const active = usePanelActive(api) && useDocumentVisible();
```
El-yazımı view'larda da aynısı. ~15 panel 2s'de açıkken, küçültülmüş pencere şu an boşuna dakikada ~450 API çağrısı yapıyor.

**14b. Hiç duraklamayan üç view.** `workspace/ViewPanel.tsx:56` (nodes), `:59` (resourcequotas), `:69` (monitoring) **`api` prop'u olmadan** mount ediliyor, `usePanelActive` sonsuza kadar `true`'ya düşüyor. **İki yerde birden** düzelt (prop tek başına yetmez):
1. `ViewPanel.tsx`'te üçüne de `api={api}` geçir.
2. Bileşenlerin kendi effect'lerinde gerçekten kullan: `node/main.tsx:237-241`, `resourcequota/main.tsx:163-167`, `monitoring/main.tsx:159-184`. Monitoring 4s'de metrics-server fan-out'u ile uygulamanın en pahalı poll'ü.

**14c. Overview dashboard.** `overview/main.tsx:46-59` **her 5 saniyede altı tam list endpoint'i** çekip her birinden sadece `.length` kullanıyor — altı tam obje serializasyonu, altı tamsayı için. **Öneri: adanmış backend count endpoint'i.** `business.GetClusterCounts(clusterName) (models.ClusterCounts, error)` — altı `List` çağrısı `metav1.ListOptions{Limit: 1}` ile ve `ListMeta.RemainingItemCount` okunarak, veya (daha basit ve kesin) mevcut servisleri kullanıp sadece sayıları dönerek, böylece RPC sınırını altı int geçer. Aralığı da **15s**'e çıkar — bir dashboard kutucuğu 5s granülerliğe ihtiyaç duymuyor.

**14d. Sınırsız büyüme (iki OOM/kota riski).**
- `logs/LogViewerPanel.tsx:60` — `logText` sürekli büyüyen tek bir string; konuşkan bir pod dakikalar içinde belleği dolduruyor. **Kopyalanacak referans: `stores/metricsStore.ts:29-33`** (`MAX_POINTS = 1800`). `MAX_LOG_LINES = 5000` ile sınırlı `string[]` ring buffer tut, render için join et, "…truncated, showing last 5000 lines" başlığı göster. Ayrıca append'i debounce et: gelen `log:output:` event'lerini satır başına bir `setState` yerine 100ms `requestAnimationFrame` flush'ında topla.
- `stores/eventsStore.ts:39-53` her 5s poll'de **sınırsız** event dizisini localStorage'a persist ediyor (`events/main.tsx:63,119`) → yoğun cluster'da `QuotaExceededError`, ki zustand `persist`'te store yazımı içinde fırlıyor. `MAX_EVENTS = 1000` (en eskiyi düşür), sadece satırlar + filtreler persist olsun diye `partialize` ekle, persist storage'ı kota hatasında anahtarı temizleyen try/catch'e sar.

**14e. Render kimlik çalkantısı.** `useResourceList.ts:76` her tick'te tüm diziyi değiştiriyor ve `buildInOptions` (132-146) `items`'a bağlı — yani **her MultiSelect options dizisi 2 saniyede bir yeni kimlik alıyor**, açık her panelin her filtre dropdown'ı sonsuza kadar yeniden render ediliyor. `frontend/src`'de **sıfır `React.memo`** olmasıyla birleşince uygulamanın taban CPU maliyeti bu.
- `reload`'da yeni payload eskisiyle derin-eşitse `setItems`'ı atla (ucuz: `createFrom` öncesi serialize edilmiş payload stringini karşılaştır).
- Alan başına options dizilerini `items` kimliğine değil türetilmiş bir imzaya bağlı `useMemo` ile hafızala.
- Zaten modül seviyesinde olan column body helper'larını `React.memo`'la (`DaemonSetActionsBody`, `NodeCard`) — CLAUDE.md bunları açık prop alan modül-kapsamlı helper'lar olarak belgeliyor, yani memo-güvenliler.

**14f. Bundle: code splitting + toolchain.** `React.lazy` yok, dinamik import yok, `manualChunks` yok. Monaco + reactflow + chart.js + MUI + primereact + xterm tek eager chunk'ta.
- `frontend/vite.config.ts` — `build.rollupOptions.output.manualChunks` ile ayır: `monaco-editor`/`@monaco-editor/react`/`monaco-yaml`, `reactflow`/`@dagrejs/dagre`, `chart.js`, `@xterm/*`, `@mui/*`, `primereact`. `build.chunkSizeWarningLimit`'i dürüstçe ayarla (sorunu gizlemek için yükseltme).
- `DockviewContainer.tsx`'in components map'inde ağır panelleri `React.lazy`'le: `yamlEditor`, `applyYaml`, `objectYaml`, `configMapEditor`, `secretEditor`, `roleEditor`, `roleBindingEditor` (Monaco), `clusterResource` + `securityrolemap` (reactflow), `terminal` + `podExec` (xterm), `monitoring` (chart.js), `trivy`. `<Suspense fallback={<PanelSkeleton/>}>` ile sar — bunlar S8c'nin error boundary'siyle zaten sarılı, `Suspense`'i onun **içine** yerleştir.
- **`monaco-editor` doğrudan import ediliyor** (`main.tsx:37-38`, `workspace/ApplyYamlPanel.tsx:10`) ama **`frontend/package.json`'da yok** — sadece `@monaco-editor/react`/`monaco-yaml`'dan hoisting ile çözülüyor. Herhangi bir lockfile değişiminde build kırılır. `monaco-editor`'ı açık bağımlılık olarak ekle, `monaco-yaml`'ın istediği sürüme pinle.
- `vite ^3.0.7` → `^5` ve `@vitejs/plugin-react ^2.0.1` → `^4` (React 18 + TS 5.9'a karşı 2022 araç zinciri). **Bu, adımın en riskli alt maddesi** — step'in **son commit'i** olarak yap ki tek başına geri alınabilsin. Dikkat: `vite.config.ts`'teki `nm()` alias helper'ı (Vite 5 `@fontsource`'u zaten çözüyor, alias'lar kaldırılabilir olabilir), `devToken` `transformIndexHtml` plugin'i (API değişmedi), `/rpc` + `/events` proxy'si (değişmedi).

**14g. Bu dosyalardayken stil borcu.** 13 `.tsx`'te **180 hardcoded hex** tema değişkenlerini bypass ediyor, dolayısıyla alternatif temaları (`last-samurai`, `god-of-war`, `hello-kitty`) bozuyor. En kötüler: `networkpolicy/PolicyViewerPanel.tsx` (46), `clusterresource/ClusterResourcePanel.tsx` (31), `security/SecurityRoleMap.tsx` (29), `terminal/TerminalPanel.tsx` (21, `:31-51`'de tüm xterm paleti), `pod/PodExecPanel.tsx` (21). `theme-monolith.css`'teki `--app/--panel/--ink/--teal/--red/--green/--amber` ile değiştir; xterm paleti için mount'ta hesaplanmış CSS var'ları bir kez oku ve tema değişiminde `ITheme`'i yeniden kur (`themeStore`'a subscribe ol). `getUsageColor` üç kez var (`node/main.tsx:23-27`, `resourcequota/main.tsx:25-29`, kanonik kopya `lib/usage.tsx`'te) — iki kopyayı sil, import et.
Kalan Türkçe kaynak yorumlarını İngilizce'ye çevir: `lib/useResourceList.ts:134-135`, `stores/eventsStore.ts:55-59`, `.github/workflows/build.yml:248`, `Makefile:40-42`.

**Verify**
```bash
cd frontend && npm run build       # chunk tablosuna bak: tek chunk > ~800KB olmamalı
npx tsc --noEmit && npm run lint && npm run test
grep -rEn "#[0-9a-fA-F]{6}" frontend/src --include=*.tsx | wc -l   # sıfıra yakın olmalı
grep -rn "React.memo\|React.lazy" frontend/src | wc -l             # > 0 olmalı
```
Manuel, ~10 panel açıkken gerçek cluster'da:
1. DevTools Network (Electron `--remote-debugging-port` ile): pencereyi küçült → RPC trafiği bir poll aralığı içinde ~sıfıra düşmeli.
2. Bir Dockview sekmesini arka plana al → poll'ü durmalı.
3. Konuşkan bir pod'da 5 dakika log viewer aç → renderer belleği tırmanmayıp plato yapmalı.
4. Tema değiştir → terminal ve exec panelleri de yeniden renklenmeli.

---

## Step 15 — Release altyapısı: CI, kanallar, updater sağlamlığı, paketleme

Uygulama kodundan bağımsız; S1'den sonra her an yapılabilir.

**15a. `build.yml` doğruluğu.**
- `:70,71,81,82,139,195` — her artifact rename `|| true` ile bitiyor, ve `VERSION` `${GITHUB_REF_NAME#v}`'den türetiliyorken Makefile `git describe --tags --abbrev=0 | sed 's/^v//'` kullanıyor. Ayrışırlarsa `mv` sessizce hiçbir şey yapmaz, yanlış adlı dosya yüklenir, ve `version.json` **sadece başarısız bir in-app update olarak yüzeye çıkan** 404'lere işaret eder. Düzelt: her `|| true`'yu kaldır, o step'lere `set -euo pipefail` ekle, ve VERSION'ı **tek kaynaktan** türet (`VERSION=$(make -s print-version)` — `print-version:` target'ı ekle). R2 sync öncesi, üretilen `docs/version.json`'daki her URL'i `curl -fsI` ile doğrulayıp non-200'de job'ı düşüren bir adım ekle.
- `:299-432` — `e2e` job'ı **ve** `mail-report` tamamen yorum satırında, `release` (`:229`) / `deploy-docs` (`:256`) sadece üç build job'ına bağlı. Açıkça karar ver ve kaydet: **öneri — yorumlu bloğu sil**, e2e suite'ini shipped shell'e yeniden yönlendir (15e) ve PR'larda koşan **ayrı**, bloklamayan bir workflow'a taşı. Release workflow'unda ölü yorum kodu tuzaktır.
- SonarCloud: README'de **token gömülü 5 SonarCloud rozeti** var ama CI'da **hiç SonarCloud taraması yok** — rozetler artık koşmayan bir taramanın sonucunu gösteriyor. Ya `sonarsource/sonarqube-scan-action`'ı `ci.yml`'e ekle ya rozetleri kaldır (16a). Yalan söyleyen rozetlerle beta çıkma.

**15b. Update kanalları.** `Makefile:189-198` tek bir `docs/version.json` üretiyor; `internal/business/update.go:17` tek sabit URL. `isNewer` (`update.go:90-97`) SemVer'e göre **doğru**, ama **kanal boyutu olmadığı için** ileride bir `v1.1.0-alpha` tag'i **her stable kullanıcıya alpha yüklemeyi önerir**.
- **İki** manifest üret: `docs/version.json` (sadece stable — prerelease son eki olmayan en yüksek tag) ve `docs/version-beta.json` (her türden en yüksek tag). `docs-downloads`'a `CHANNEL` değişkeni ekle.
- `update.go` — `~/.kube-ins/.channel`'da persist edilen kanal ayarı (`stable` | `beta`), 0.x build'lerde varsayılan **`beta`**, ≥1.0'da `stable`. `manifestURL()` dosyayı seçer. `KUBE_INS_UPDATE_MANIFEST` override'ını koru.
- `titlebar/UpdateModal.tsx` / About modal'a kanal seçici.
- **Sürüm şeması:** nokta-sayısal prerelease — `v0.16.0-beta.1`, `v0.16.0-beta1` **değil**. SemVer nokta ayrılmış tanımlayıcıları sayısal karşılaştırır; `beta10` vs `beta2` string karşılaştırmasıyla **yanlış** sıralanır, `beta.10` vs `beta.2` doğru. `golang.org/x/mod/semver` bunu doğru uyguluyor; disiplin tag formatında. S1'in `isNewer` tablosuna bunun için bir vaka ekle.

**15c. Updater sağlamlığı** (`internal/services/selfUpdate_{linux,windows,darwin}.go`).
- **Hiçbir yerde rollback yok.** Asgari uygulanabilir: paketi installer'a vermeden önce mevcut kurulu sürümü ve önceki artifact URL'ini `~/.kube-ins/.update-state`'e yaz; sonraki açılışta çalışan `appVersion` denenen sürümden **eskiyse** başarısız-güncelleme uyarısı logla ve UI'da bir kez göster (downloads sayfasına link ile). Tam ikili rollback beta kapsamı dışı — **Known Limitations'a yaz**.
- `selfUpdate_darwin.go:133` **`ditto` kullanıyor, bu MERGE ediyor** — eski sürümden kalan dosyalar sonsuza kadar yaşıyor. Değiştir: temp dizine stage et, eski bundle'ı `<bundle>.old`'a `mv` et, yeniyi yerine `mv` et, sonra `rm -rf <bundle>.old`; herhangi bir hatada eskiyi geri `mv` et. Aynı volume'de yeterince atomik.
- `selfUpdate_darwin.go:138` `os.Getppid()` bekliyor — parent zaten çıkmışsa `1` olabilir, o zaman bekleme ya no-op ya PID 1'de sonsuz. Helper'a **uygulamanın kendi PID'ini** geçir, sınırlı timeout'la `kill(pid, 0)` poll et.
- Detached macOS helper'ı **kullanıcıya görünür hata ve log olmadan** `exit 1` yapıyor. stdout/stderr'ını `~/.kube-ins/logs/update-helper.log`'a (S6'nın dizini) yönlendir, uygulama sonraki açılışta dosyanın boş olup olmadığına baksın.
- `selfUpdate_windows.go:39-50` ateşle-unut. Spawn'ı logla ve spawn öncesi denenen-sürüm işaretini yaz ki 15c'nin başarısız-güncelleme tespiti orada da çalışsın.
- Linux başarıda ~190MB temp indirmeyi sızdırıyor — `selfUpdate.go:20-21` temp dizini tutuyor ama `selfUpdate_linux.go:72` `RunInstaller` senkron ve o noktada bitmiş, `defer os.RemoveAll(tmpDir)` orada güvenli. Ekle, ve çökme durumu için açılışta `~/.kube-ins/tmp/*`'ın 24 saatten eskilerini süpür.
- İndirme devam ettirme yok: kısmi dosyanın boyutuna göre `Range` header desteği, 3 denemeye kadar. Sallantılı bağlantıda 190MB indirme gerçek bir beta şikâyeti.

**15d. Paketleme.**
- `build/nfpm.yaml:51-52` — setuid bitini / `chrome-sandbox` kalıntılarını temizleyen ve `update-desktop-database` + `gtk-update-icon-cache` koşan bir `postremove` ekle; aynı iki komutu `build/electron-postinstall.sh`'e de ekle.
- `build/nfpm.yaml:43-46` — ikon **sadece 512x512** kuruluyor. 16/32/48/64/128/256'yı `hicolor/*/apps/`'a ekle (paketleme sırasında ImageMagick ile `build/appicon.png`'den üret veya ölçeklenmiş PNG'leri commit et).
- `build/nfpm-cli.yaml:19,25` — `/usr/local/bin`'e kuruyor; desktop paketinin `/usr/bin` symlink'iyle tutarsız ve RPM `%{_bindir}` konvansiyonu dışı. `/usr/bin` yap.
- `docs/getting-started/installation.md:33` `rpm -i` diyor, **yeniden kurulumda/yükseltmede başarısız olur**. `rpm -Uvh` yap.
- **Checksum doğrulama talimatları** (kod imzalamanın yerine geçen şey): CI zaten artifact başına `.sha256` sidecar üretiyor. Release başına tek bir `SHA256SUMS` dosyası da yayınla ve installation docs'ta OS başına doğrulama komutunu belgele (`sha256sum -c`, `shasum -a 256 -c`, `CertUtil -hashfile <f> SHA256`).

**15e. e2e suite.** `e2e_tests/conftest.py:18` `http://localhost:34115`'i hedefliyor — **Wails dev server'ı**, ki shipped shell değil. Electron sidecar'ının koştuğu RPC server'a yönlendir (`kube-ins --serve` URL'ini stdout'a basıyor; bir fixture onu `-tags kubeinsdev` ile pinlenmiş `KUBE_INS_DEV_PORT`'ta spawn edip URL'i okuyabilir). Ayrıca:
- `test_navigation.py:113-118` sadece bir `.p-datatable` elementinin varlığını assert ediyor — **boş tablo geçiyor**. Bilinen bir kaynak seed'ledikten sonra `>= 1` `.p-datatable-tbody > tr` assert et.
- `test_panels.py:70` pod yoksa tüm dosyayı skip ediyor. kind fixture'ı bilinen bir deployment oluştursun ki skip hiç tetiklenmesin.
- S9–S11'in her yeni özelliği için birer test ekle (describe açılıyor ve "Events:" içeriyor, scale replica kolonunu değiştiriyor, port-forward listede beliriyor).

**Verify**
```bash
make print-version                  # git tag eksi 'v' ile eşleşmeli
make docs-downloads && cat docs/version.json docs/version-beta.json
GOEXPERIMENT=jsonv2 go test ./internal/business/... -run TestIsNewer -v
make pkg-deb && sudo dpkg -i dist/*.deb && sudo dpkg -i dist/*.deb   # yeniden kurulum başarılı olmalı
sudo dpkg -r kube-inspector && ls /usr/share/applications/ | grep kube   # postremove temizlemiş olmalı
```

---

## Step 16 — Beta dokümantasyonu

Mevcut 39 sayfa iyi ve `--strict` ile derleniyor; eksik olan, bir şey ters gittiğinde ilk kullanıcının ihtiyaç duyduğu her şey.

**16a. `README.md`'yi yeniden yaz — bugün maddi olarak yanlış:**
| Satır | Yanlış | Doğru |
|---|---|---|
| `:11` | `opensourcemonkeys.github.io` linki | `https://kubeinspector.com` |
| `:19-22` | CI çıktısıyla eşleşmeyen dosya adları | gerçek `kube-inspector-<ver>-linux-amd64.deb` vb. |
| `:21` | macOS **Universal** iddiası | v0.11.0'dan beri **sadece arm64** |
| `:24-41` | `libwebkit2gtk` kurun diyor | Electron paketlerinin **hiç bağımlılığı yok** (`build/nfpm.yaml:54-56`) |
| `:51` | "Go 1.24+" | Go **1.26** + `GOEXPERIMENT=jsonv2` (opsiyonel değil, zorunlu) |
| `:70` | `wails dev` öneriyor | `make dev` (Electron loop, `Makefile:151`) |
| rozetler | token gömülü 5 SonarCloud rozeti, CI'da tarama yok | kaldır veya taramayı ekle (15a) |
Ekle: beta durum bandı, güvenlik duruşu (sadece loopback, telemetri yok, kubeconfig'ler makineden çıkmıyor) ve checksum doğrulama bölümüne link.

**16b. Yeni docs sayfaları** (her birine `description:` front-matter; sitemap/llms.txt nav'dan otomatik yenileniyor — `mkdocs_hooks.py`; her birini `mkdocs.yml` nav'ına ekle):
- `docs/getting-started/verifying-downloads.md` — OS başına SHA256 doğrulama.
- `docs/getting-started/unsigned-builds.md` — **kod imzalamanın yerine geçen sayfa.** Açıkça söyle: build'ler **imzalı değil** (sertifika yok), bunun ne anlama geldiği, ve tam bypass adımları. macOS: `xattr -d com.apple.quarantine /Applications/Kube\ Inspector.app` veya sağ tık → Aç, artı Gatekeeper "unidentified developer" diyalog anlatımı (ekran görüntüleriyle). Windows: SmartScreen "More info → Run anyway". Linux: yok. **Her bypass talimatını checksum doğrulamayla eşle** — rehber "doğrula, sonra bypass et" olsun, asla "sadece bypass et" olmasın.
- `docs/troubleshooting.md` — cluster bağlanmıyor, boş listeler (RBAC), metrics-server yok, exec/terminal çalışmıyor, port-forward "address already in use", update başarısız, logların yeri (`~/.kube-ins/logs/`), **Copy diagnostics** nasıl kullanılır (S6).
- `docs/faq.md`
- `docs/known-limitations.md` — beta dürüstlüğü: kod imzalama yok; macOS sadece arm64; update rollback yok; Node delete bilinçli olarak yok; de/ru/zh/ja makine çevirisi; port-forward otomatik yeniden bağlanmıyor; Trivy DB ağ istiyor; metrikler metrics-server istiyor.
- `docs/uninstall.md` — platform başına, `~/.kube-ins/` kaldırma dahil (kubeconfig tuttuğunu belirt).
- `docs/privacy.md` — **tüm telemetri hikâyesi**: uygulamada telemetri yok, çökme raporlama yok, analitik yok. Tek dışa giden istekler: (1) `kubeinspector.com/version.json` update manifest'i, (2) kullanıcı eylemiyle artifact indirmesi, (3) kullanıcı eylemiyle Trivy zafiyet DB'si, (4) AI asistanı kullanılırsa `registry.ollama.ai`. Kubeconfig'ler, cluster verisi ve loglar makineden çıkmıyor; diagnostics blob'unu kullanıcı panoya kopyalıyor ve redakte edilmiş. Docs **sitesinin** Google Analytics kullandığını (`mkdocs.yml`, `G-707GCW6202`) açıkça belirt — o site, uygulama değil.
- `docs/support.md` — hata nereye açılır, neyi eklemeli (diagnostics blob + log dosyası), güvenlik bildirim yolu.

**16c. `.github/` topluluk dosyaları** — dizin şu an **sadece** `workflows/build.yml` içeriyor:
- `CONTRIBUTING.md` (`GOEXPERIMENT=jsonv2` dahil build önkoşulları, PR öncesi `make check`, resource-triple konvansiyonu, yeni stringlerin `t()`'den geçmesi kuralı).
- `SECURITY.md` (desteklenen sürümler, özel bildirim adresi, loopback/token tehdit modeli).
- `CODE_OF_CONDUCT.md`.
- `ISSUE_TEMPLATE/bug_report.yml` (**zorunlu** diagnostics-blob alanı ile), `feature_request.yml`, `translation_fix.yml` (S13'ün seçici notunun referans verdiği), `config.yml`.
- `PULL_REQUEST_TEMPLATE.md`.
- `dependabot.yml` — `gomod`, `npm` (`/frontend`), `github-actions`, haftalık, minor/patch gruplu.

**16d. Yeni özellik dokümanları** (S9–S11): `docs/workspace/describe.md`, `docs/workspace/port-forwarding.md`, ve scale/restart bölümleri `docs/workloads/deployments.md` + `statefulsets-replicasets.md` + `daemonsets.md`'ye. Artı `docs/settings/language.md`.

**Verify**
```bash
make docs-build     # mkdocs --strict geçmeli (kırık link / eksik nav girdisi yakalar)
grep -rn "opensourcemonkeys\|libwebkit2gtk\|Go 1.24\|wails dev\|Universal" README.md   # boş olmalı
ls site/llms.txt site/llms-full.txt site/sitemap.xml    # yeni sayfalarla yenilenmiş olmalı
```
Manuel: `docs/troubleshooting.md` ve `unsigned-builds.md`'yi uygulamayı hiç görmemiş biri gibi oku; her talimat ön bilgi olmadan uygulanabilir olmalı.

---

## Step 17 — Beta sürümünü çıkar

**Sürüm:** `v0.16.0-beta.1`. Minor bump (gerçek yeni özellikler: describe, scale, restart, port-forward, i18n) ve **nokta-sayısal** prerelease tanımlayıcısı, ki `beta.10` `beta.2`'den sonra doğru sıralansın.

**17a. `CHANGELOG.md` — başlık formatı katı bir kısıt.**
`.github/workflows/build.yml:239` GitHub Release gövdesini şununla çıkarıyor:
```awk
awk "/^## \[${TAG}\]/{found=1; next} found && /^## \[/{exit} found{print}"
```
`TAG` = `${GITHUB_REF_NAME}` — **`v` dahil tag**. Yani başlık **tam olarak** şu olmalı:
```markdown
## [v0.16.0-beta.1] - 2026-XX-XX
```
Herhangi bir sapma (eksik `v`, farklı parantez, `[` öncesi ek metin) **hatasız biçimde boş release gövdesi** üretir. `mkdocs_hooks.py:78-107` de bu dosyayı parse ediyor — girdiyi ekledikten sonra changelog sayfasının hâlâ render olduğunu doğrula. 28 önceki girdinin Keep-a-Changelog yapısını izle. Belirgin bir **Breaking / Behaviour changes** alt bölümü ekle: `ApplyYaml` artık `clusterName` alıyor (S2), list endpoint'leri hatada boş dönmek yerine reject ediyor (S7), IPC hub artık token istiyor (S4 — karışık eski/yeni instance'ların birbirini görmeyeceğini belirt).

**17b. Tag öncesi kontrol listesi (hepsi geçmeli):**
```bash
cd /home/mfx/Documents/monkey/kube-in-go
git status --porcelain                       # temiz
make check                                   # go build/vet/lint/test + tsc/eslint/vitest/i18n:check
make docs-build                              # --strict
GOEXPERIMENT=jsonv2 go build ./cmd/tui
grep -rn "wailsapp/wails" internal/tui cmd/tui        # boş
grep -n "^## \[v0.16.0-beta.1\]" CHANGELOG.md         # tam eşleşme, tek sonuç
awk "/^## \[v0.16.0-beta.1\]/{f=1;next} f&&/^## \[/{exit} f{print}" CHANGELOG.md | head   # boş olmamalı
make pkg-linux
```
Yerel deb **ve** rpm'i temiz container'larda kurulum testinden geçir: kur, başlat, kind cluster'a bağlan, describe / scale / restart / port-forward / apply-yaml dene, dili değiştir, sonra `dpkg -r` / `rpm -e` ve artık kalmadığını doğrula.

**17c. Tag ve release.**
```bash
git tag -a v0.16.0-beta.1 -m "Beta 1"
git push origin v0.16.0-beta.1
```
Bu `build.yml`'i tetikler (artık `v*` filtreli): üç build job → `.sha256` sidecar'larıyla R2 `/dist` upload → CHANGELOG gövdeli GitHub Release → R2 kök dizinine docs deploy.

**17d. Release sonrası doğrulama (atlama — update yolu tag var olmadan test edilemeyen tek şey):**
```bash
curl -fsSL https://kubeinspector.com/version.json      | jq .
curl -fsSL https://kubeinspector.com/version-beta.json | jq .
curl -fsSL https://kubeinspector.com/version-beta.json | jq -r '.assets[]' \
  | xargs -I{} curl -fsIo /dev/null -w '%{http_code} {}\n' {}
curl -fsSL https://kubeinspector.com/version-beta.json | jq -r '.assets[]+".sha256"' \
  | xargs -I{} curl -fsIo /dev/null -w '%{http_code} {}\n' {}
gh release view v0.16.0-beta.1                          # gövde boş OLMAMALI
```
Sonra **önceki** sürümü (v0.15.0-alpha) kur, kanalı `beta` yap, ve in-app updater'ın v0.16.0-beta.1'i önerdiğini, indirdiğini, checksum doğruladığını ve kurduğunu Linux (deb + rpm), Windows ve macOS-arm64'te doğrula. Bu, S15c'yi uçtan uca sınar ve en önemli release-sonrası kontroldür.

**17e. Tag sonrası:** 1.0'a ertelenen her şeyi listeleyen bir takip issue'su aç (kod imzalama, update rollback, de/ru/zh/ja çeviri gözden geçirmesi, port-forward otomatik yeniden bağlanma, Node delete) ve `docs/known-limitations.md`'den link ver.

---

## Risk kaydı

| Step | Risk | Etki alanı | Azaltma |
|---|---|---|---|
| **7** | **En yüksek.** 24 business imzası `functionBuilder.go` (24 metot), `internal/tui/registry.go` (24 closure) + 5 TUI dosyası, `internal/business/ai.go`'ya yayılıyor; bindings regen gerekiyor. | Tüm backend + TUI | Üretilen TS **kanıtlanabilir biçimde değişmiyor** (`[]T` ve `([]T,error)` ikisi de `Promise<Array<T>>` üretiyor), frontend'e dokunulmuyor. Kaynak kaynak ilerle; derleyici kalan her siteyi sayar. |
| **2** | Uygulamadaki tek kaynak-oluşturma yolu; apply motoru kubectl'den SSA'ya geçiyor. | ApplyYaml paneli, AI `apply_yaml` tool'u, TUI | Merge öncesi test et: çok-dokümanlı, cluster-scoped, kubectl-yönetilenin üzerine tekrar apply, ve geçersiz YAML. `Force: true` opsiyonel değil, zorunlu. |
| **4** | Hub'da token/Origin, **eski ve yeni instance'ların birbirini görememesi** demek. | Multi-instance tab transfer | Tek sürüm içinde beklenen ve kabul edilebilir; CHANGELOG'un breaking bölümünde belirt. |
| **11** | Process-global registry'li yeni uzun ömürlü ağ makinesi. | Sadece yeni kod | Loopback-only bind kodda zorunlu (`NewOnAddresses`), asla yapılandırılabilir değil. Shutdown'da `StopAllPortForwards`. |
| **13/14f** | i18n `no-literal-string`'in `error` olması ve Vite 3→5 yükseltmesi. | Tüm frontend | Lint kuralını ancak kataloglar tamamlanınca çevir. Vite yükseltmesini S14'ün son, ayrı geri alınabilir commit'i yap. |
| **15a** | Release workflow değişiklikleri tag push etmeden tam test edilemez. | Sürümler | Önce fork/atılabilir tag'de dene; `version.json` URL'lerindeki `curl -fsI` assertion'ı sessiz 404'ü kırmızı job'a çevirir. |

---

## Uygulama için kritik dosyalar

- `internal/controller/functionBuilder.go` — S2, S7, S9, S10, S11'de eklenen/değişen her binding buraya iner; ayrıca dört session-restart yarışı `:44`, `:715`, `:900`, `:955`'te.
- `internal/tui/registry.go` — `view → business.*`'ın tek veri-güdümlü haritası; 24 `list` closure'ı S7'nin tüm TUI etki alanı, S9/S10 parite için buraya `del:`/`rowAction` ekliyor.
- `frontend/src/lib/useResourceList.ts` — tek dosya, ~21 list view'a hata/yükleme durumu (S8), görünürlük gating'i (S14a) ve kimlik-kararlı filtre seçenekleri (S14e) veriyor.
- `internal/services/objectYamlServices.go` — GVR-adresli dynamic iş için referans; `newDynamicAndMapper`/`resolveResourceInterface` yeni native `ApplyYaml` (S2) tarafından aynen kullanılıyor, ve `:119`'daki `GetObjectDescribe` S9'un sadece bind etmesi gereken tamamlanmış describe implementasyonu.
- `.github/workflows/build.yml` — tag filtresi (`'*'` → `'v*'`, S1), `|| true` rename'leri ve VERSION ayrışması (S15a), ve `:239`'daki awk'ın dayattığı tam `## [v0.16.0-beta.1]` CHANGELOG başlık formatı (S17).
