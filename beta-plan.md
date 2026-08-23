# Kube Inspector: ALPHA → BETA Planı

**Baseline:** v0.15.0-alpha · **Hedef:** v0.16.0-beta.1

> Her step **ayrı bir Claude oturumunda** çalıştırılmak üzere, kendi kendine yeterli olacak şekilde yazıldı.
> Yeni oturumda: `beta-plan.md`'yi aç, aşağıdaki "Global önsöz"ü ve ilgili step'in tamamını oku, bitince kutuyu işaretle.

## İlerleme

- [x] **S1** — Doğrulama altyapısı: lint, vet, test, PR CI ✅
- [x] **S2** — ApplyYaml: cluster pinning + native server-side apply *(riskli)* ✅
- [x] **S3** — Backend doğruluk paketi: nil panic, path traversal, timeout ✅
- [x] **S4** — IPC hub sertleştirme *(güvenlik)* ✅
- [x] **S5** — Session yaşam döngüsü: zombiler, sızıntılar, restart yarışı ✅
- [x] **S6** — Yerel loglama + diagnostics paneli ✅
- [x] **S7** — 24 business fonksiyonuna error return *(en riskli)* ✅
- [x] **S8** — UI'da hata + yükleme durumu ✅
- [x] **S9** — Describe, Resource Quota, eksik delete/update, namespace create ✅
- [x] **S10** — Scale ve Rollout Restart ✅
- [x] **S11** — Port forwarding: process-ömürlü tünel modeli ✅
- [x] **S12a** — i18n altyapısı + koruma bariyerleri + yüksek kaldıraçlı yüzeyler ✅
- [x] **S12b** — kalan 21 list view + panellerin İngilizce çıkarımı ✅
- [x] **S13a** — parite denetleyicisi + CI/Makefile wiring ✅
- [x] **S13b** — tr / de / ru / zh / ja çevirileri + dürüstlük işaretleri ✅
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

## Step 6 — Yerel loglama + Diagnostics paneli (telemetri yok) ✅

**Uygulandı.** Aşağısı fiilen inşa edilen tasarımdır; orijinal taslaktan sapmalar
gerekçeleriyle işaretli.

**Kısıt 1 (`main.go`): stdout, RPC URL'ini ve shell token'ını taşıyan Electron'a
giden özel bir pipe.** O protokol dışında hiçbir şey oraya yazmaz. `internal/logging`
**dosya-only**; isteğe bağlı geliştirme tee'si stderr'e gider ve `RoleCLI` için
`Init` içinde **zorla kapalıdır** (tview ekranı).

**Kısıt 2: `slog.Default()`'a asla güvenme.** Trivy'nin `pkg/log` `init()`'i
`slog.SetDefault`'u kayıtları yalnızca bir slice'a biriktiren bir handler ile
çağırıyor; Go 1.21'den beri bu standart `log` paketini de yönlendiriyor.
`internal/logging` **kendi `*slog.Logger`'ını** tutar ve `slog.SetDefault`'u
**hiç çağırmaz**; `main.go`/`cmd/tui` bunun yerine
`log.SetOutput(logging.StdlibWriter())` + `log.SetFlags(0)` yapar.

**6a. `internal/logging`** — sadece stdlib import eder (leaf paket; `safego → logging`
tek intra-proje kenarı).
- Format: **logstash `json_event` v1** — `@timestamp` (UTC, 3 hane), `@version:"1"`,
  `level`, `message`, `logger`, ve tüm çağıran attr'ları **`fields` altında**.
  `slog.NewJSONHandler` + `WithGroup("fields")` + `ReplaceAttr`; `ReplaceAttr`'daki
  `if len(groups) != 0 { return a }` guard'ı `level` adlı bir caller attr'ının üst
  seviyeyi ezmesini imkânsız kılar (`TestCallerAttrsCannotEscape`).
- Dosya: `~/.kube-ins/logs/kube-inspector-<yerel tarih>.log`, `0600`, dizin `0700`.
  **Tek dosya, tüm roller** — backend + cli + Electron shell. Satırlar `fields.role`
  ve `fields.pid` ile ayrışır.
- Eşzamanlılık: `O_APPEND` + **kayıt başına tek `Write`** (cross-process kilit yok;
  `slog.commonHandler` zaten kayıt başına tek `w.Write` garantisi veriyor).
  32 KiB kayıt cap'i kısmi yazmanın kaydı ikiye bölmesini engeller.
- Gün dönüşü: **her yazımda deadline karşılaştırması, ticker değil** (suspend/resume
  ve DST'de kendini düzeltir). Rename yok — her gün baştan kendi dosyasını açar.
- Retention: **7 gün, boyut tavanı yok** (bilinçli). `.retention` marker + `O_EXCL`
  `.retention.lock` ile koordine; dosya adındaki tarihe göre siler, mtime'a göre değil;
  katı `^kube-inspector-\d{4}-\d{2}-\d{2}\.log$` regex'i başka dosyayı silmeyi
  yapısal olarak imkânsız kılar.
- Seviye: `*slog.LevelVar` → runtime değişimi rebuild gerektirmez.
  Öncelik `KUBE_INS_LOG_LEVEL` > `logs/.level` > `INFO`.
- `Init` öncesi `slog.DiscardHandler` — argümanlar değerlenmez bile.
- **`logging.With(name)`'i paket seviyesi değişkende çağırma** — `Init`'ten önce
  bağlanır ve discard handler'ı kalıcı yakalar. Log yerinde çağır.

**6b. Giriş noktaları — 2 değil 3.** `--tui` dalı (`main.go`) eski `log.SetOutput`
satırından **önce** return ediyordu, yani CLI binary'sinde hiçbir `log.Print` çıkmıyordu.
Init: `main.go` tui dalı, `main.go` (serve+wails ortak), `cmd/tui/main.go`.

**6c. Print süpürmesi — kısmi, bilinçli.** `internal/ipc` (14), `internal/repository` (3),
`internal/controller` (2), `internal/safego` (1), `business/selfUpdate.go` (6),
`business/resourceQuota.go` (1) süpürüldü. **`internal/business`'ın kalan 48 print'i
S7'ye bırakıldı**: S7 zaten o 24 fonksiyonu `return nil, fmt.Errorf(...)` şekline
çeviriyor ve log satırı bırakmıyor — S6'da yazılacak 48 satırı S7 hemen silerdi.
Muaf: `main.go:42,51` (protokol), `internal/tui/exec.go` (raw-mode kullanıcı çıktısı),
`internal/tui/logs.go:100` (tview widget'a yazıyor).

**6d. Electron (`electron/logfile.cjs`).** Node **aynı dosyaya** `role:"shell"` ile
yazar — sidecar URL basmadan ölünce iki tarafın satırlarını zaman damgasına göre iç içe
okumak gerekiyor. `fs.openSync(p,'a')` + `fs.writeSync` (tek syscall);
`createWriteStream`/`appendFileSync` **kullanılmaz**. Aynı 7 günlük sweep'i aynı marker
+ lock ile çalıştırır. **`SECRET` scrub'ı zorunlu**: `rememberLog` ham sidecar stdout'unu
alıyor, içinde `kube-ins shell token <64 hex>` var. `fatal()` de scrub'lanır (eskiden
token'ı ekrana basıyordu). Yeni siteler: sidecar start/error/exit, `fatal`,
`render-process-gone`, `child-process-gone`.

**6e. Diagnostics.** `business/redact.go` + `business/diagnostics.go` +
`services/diagnosticsServices.go` + `models/diagnosticsInfo.go`.
- Redaksiyon sırası **zorunlu**: `$HOME` → cluster adları → secret → base64 → URL.
  (`$HOME` önce olmalı: ev dizininin son parçası bir cluster adıysa ters sırada
  `/home/` sızar.) Cluster numaralandırması alfabetik → iki export diff'lenebilir.
  **40 karakterlik hex (git commit) korunur**; **64 karakterlik hex silinir** — bu
  uygulamanın iki gerçek sırrı (RPC ve hub token'ı) tam da o şekilde.
  Base64 sınıfında `/` **yok** (uzun mutlak yolları yemesin). `redact(redact(s))==redact(s)`.
- Sağlık kontrolleri `safego.Go` ile eşzamanlı, 6s/kontrol + 20s toplam, önceden
  boyutlandırılmış slice'a indeksle yazılır → sıra sabit, mutex yok, panik eden bir
  kontrol WaitGroup'u serbest bırakır.
- Zip: `diagnostics.txt` + `report.json` + `shell.json` + `logs/*`, hepsi redakte.
  `copyRedacted` **`bufio.Reader`** kullanır, `Scanner` değil (32 KiB'lık kırpılmış
  panic kaydı Scanner'ın 64 KiB limitini patlatır ve kopyayı sessizce keser).

**6f. Transport.** `Transport`'a **`OpenLogFolder() error`** (sıfır argümanlı) ve
`Kind() string` eklendi. `OpenPath(string)` **reddedildi**: renderer'dan gelen bir
string'in `shell.openPath`'e ulaşması `.desktop`/`.lnk`/`.exe` açtırma primitifi yaratır.
`shellchannel.go` generic `shellCall`'a çevrildi; tipler `saveFile|openLogFolder|diagnostics`.
`main.cjs`'teki `if (req.type !== 'saveFile') return;` **`default:` hızlı-hata dalına**
çevrildi — eskiden bilinmeyen tipi cevapsız düşürüp Go tarafını 2 dakika bekletirdi.

**6g. Frontend.** `components/diagnostics/` — Dockview paneli, `TabView` ile üç sekme:
Overview (ortam + sağlık kontrolleri, **otomatik yenileme yok**), Logs (2 sn tail,
`usePanelActive` ile gated, backend-tarafı level+arama filtresi, role/pid filtresi,
runtime level seçici), Export. Panel id **`diagnostics`** — singleton, cluster-scoped
değil, `params: {}` (structured-clone güvenli). Giriş: Help ▸ Diagnostics ve About
modalı. `lib/clipboard.ts` `CliModeOverlay`'den çıkarıldı (WebKitGTK async clipboard'u
blokluyor). Stiller `theme-monolith.css`'te `.diag-*`.

**Verify (koşuldu, geçti)**
```bash
GOEXPERIMENT=jsonv2 go build ./... && GOEXPERIMENT=jsonv2 go vet ./... && GOEXPERIMENT=jsonv2 go test ./...
grep -rn "kube-ins/internal/" internal/logging/*.go | grep -v _test.go          # boş (stdlib-only)
grep -rn "fmt.Print\|log.Print\|fmt.Fprint" internal/ipc internal/repository \
     internal/controller internal/safego | grep -v _test.go                     # boş
rm -rf frontend/wailsjs && make bindings && cd frontend && npx tsc --noEmit && npm run build
go run . --serve --shell-channel < /dev/null | head -5    # TAM OLARAK iki satır
```
Canlı doğrulandı: 15 sağlık kontrolü gerçek cluster'lara karşı ~15 ms; export zip'inde
`$HOME`, kullanıcı adı, cluster adı, bearer **yok**, TLS hatası ve git commit **var**;
TUI ekranına tek satır sızmıyor; backend + cli kayıtları tek dosyada, `jq` hepsini parse ediyor.

---

## Step 7 — 24 business list fonksiyonuna error return (BACKEND) ✅

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

> **S6'dan devir:** o step bu 24 dosyaya bilinçli olarak dokunmadı — buradaki hedef şekil
> log satırı bırakmıyor, dolayısıyla S6'da yazılacak 48 satırı bu step hemen silerdi.
> Mevcut `fmt.Println(err)` çiftlerini silip yerine `return nil, fmt.Errorf(...)` koy;
> `logging.L()` çağırma. (`GetNamespaces`/`GetNodes` şu an `[]models.X{}` dönüyor,
> diğerleri `nil` — bu step ikisini `nil, err`'de birleştiriyor.)

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
# S6'dan devralındı: business'ın 48 print'i bu step'te error return'e dönüşüyor,
# dolayısıyla repo geneli print gate'i ancak burada geçebilir.
# NOT: plandaki ilk hâli (`grep -rn "fmt.Print\|log.Print"`) boş çıkmıyor — `.`
# wildcard olduğu için internal/logging/{logging.go:19,stdlib.go:18}'deki iki DÜZ
# YORUM satırı ("...swallowed every log.Print in this binary...") eşleşiyor.
# Kodda kalan print yok; gate'in kendisi hatalıydı. Doğru hâli:
grep -rnE '(^|[^/[:alnum:]_.])(fmt|log)\.Print' internal/ \
  | grep -v _test.go | grep -v internal/tui | grep -v internal/logging          # boş olmalı
grep -rn "wailsapp/wails" internal/tui cmd/tui                                      # boş olmalı

# Binding yüzeyinin DEĞİŞMEDİĞİNİ kanıtla (bu step'in temel varsayımı):
cp frontend/wailsjs/go/controller_app/App.d.ts /tmp/App.d.ts.before
rm -rf frontend/wailsjs && make bindings
diff /tmp/App.d.ts.before frontend/wailsjs/go/controller_app/App.d.ts   # boş olmalı
cd frontend && npx tsc --noEmit    # SIFIR değişiklikle geçmeli — 1. maddeyi kanıtlar
GOEXPERIMENT=jsonv2 go build ./cmd/tui
```
> `npm run build` `frontend/dist`'i boşaltıp **takipli `.gitkeep`'i siliyor**
> (CLAUDE.md'deki uyarı). Frontend build'inden sonra `git checkout -- frontend/dist/.gitkeep`.

Manuel: ölü IP'li kubeconfig ile TUI → boş tablo değil, bağlantı hatası göstermeli.

### Uygulandı — sonuç

**Kırılan çağrı sitesi tam olarak 51'di, 3 dosyada** (repo geneli çıplak-isim
taramasıyla doğrulandı): `functionBuilder.go` 24 wrapper, `tui/registry.go` 24
closure, `business/ai.go` 3 tool. **Planın "diğer TUI çağıranları grep'le" notu boş
çıktı** — `monitoring/exec/logs/crd/clusters/describe.go` yalnızca zaten error dönen
fonksiyonları çağırıyor. `metrics.go`/`securityGraph.go`/`resourceQuota.go`/
`diagnostics.go` doğrudan `services.*` çağırdığı için etkilenmedi.

**1. maddesi kanıtlandı:** regen sonrası `App.d.ts` **ve** `App.js` bayt bayt aynı
(`diff` boş). Frontend'de tek satır değişmedi, `tsc --noEmit` + `npm run build` geçti.

**Frontend regresyon riski yok:** bu 24'ün her frontend çağrı sitesi zaten
`try/catch` içindeydi — `useResourceList.ts` (21 view) + el-yazımı dördü
(`node`, `resourcequota`, `events`, `overview`'ün `Promise.all`'u). Reject
sessizce yutuluyor; banner S8'in işi. Unhandled rejection üretilmiyor.

**`"fmt"` import'u 24 dosyada da kaldı** — `fmt.Println` gitti, `fmt.Errorf` geldi.
Sarmalamayı bırakıp çıplak `return nil, err` seçilseydi 24 import'un da silinmesi
gerekirdi.

**`pod.go` + `node.go`:** metrics client toleranslı bırakıldı ama artık `_` ile
yutulmuyor — `logging.With("business.{pod,node}").Debug` ile loglanıyor.
`node.go`/`namespace.go`'nun `[]models.X{}` dönen ikinci şekli `nil, err`'de
birleştirildi.

**`tui/resourcelist.go` — ticker hatayı yutuyordu, düzeltildi.** Ama `a.flash`
**bloklayan bir modal**, status bar değil: her tick'te modal açmak fokusu çalardı.
Bunun yerine `listErr` durumu eklendi ve `render` çiziyor — boş tabloda `(no items)`
yerine hata metni (`colDanger`), dolu tabloda başlıkta `· stale`. Modal yalnızca
manuel yolda (`r` tuşu / ilk yükleme) kalıyor. Ayrıca `reload` artık hatada
`allRows`'u **ezmiyor**: geçici bir hata okunan tabloyu boşaltmasın diye son iyi
satırlar korunuyor — S8'in frontend'de vereceği kararla aynı.

**Not:** `resourcequotas` ve `crds` closure'ları zaten hedef şekildeydi, 24'e dahil
değil, dokunulmadı.

**Üretilen hata metni — ölçüldü** (geçici bir `127.0.0.1:1` kubeconfig'i ile;
dosya ve geçici test sonrasında silindi). S8 banner'ının göstereceği metin bu:
```
list pods in cluster "s7-deadip-check": Get "https://127.0.0.1:1/api/v1/pods":
    dial tcp 127.0.0.1:1: connect: connection refused
list nodes in cluster "s7-deadip-check": Get "https://127.0.0.1:1/api/v1/nodes":
    dial tcp 127.0.0.1:1: connect: connection refused
connect to cluster "s7-no-such-cluster":
    stat /home/mfx/.kube-ins/s7-no-such-cluster.yaml: no such file or directory
```
Yani iki dal ayırt edilebiliyor: **`connect to cluster ...`** = kubeconfig/erişim,
**`list <kind> in cluster ...`** = API çağrısı (RBAC 403 buraya düşer).

---

## Step 8 — UI'da hata + yükleme durumu (FRONTEND) ✅

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

### Uygulandı — sonuç

**Üç yönlü ayrım tek yerde kuruldu.** `useResourceList` artık `error` / `loading`
(yalnız ilk settle'a kadar) / `refreshing` (her fetch sırasında) veriyor ve
hatada **satırlara dokunmuyor**. Bu tek dosya 21 list view'ı birden kapsıyor;
`ResourceListView` üçlü ayrımı çiziyor: `loading` → `ProgressSpinner`,
`error` → banner, `error && boş` → DataTable'ın `emptyMessage`'ı `' '`e
düşürülüyor ki "No pods found" bir hatayı taklit etmesin.

**Yeni paylaşılan parçalar:**
- `lib/errText.ts` — CRD explorer'daki yerel kopya buraya taşındı (`useCrdExplorer`
  artık buradan import ediyor). İki shell farklı reddediyor: Wails çıplak Go
  hata **string**'i, RPC bridge ise `Error` — ikisi de burada normalize ediliyor.
- `components/shared/ErrorBanner.tsx` — VscWarning + mesaj + **Retry** +
  **Copy diagnostics** + kapat. Mesaj **birebir** gösteriliyor (S7'nin
  `list pods in cluster "prod": … forbidden` metni banner'ın kendisi).
  Kapatma **mesaj başına**: aynı hata tekrar gelirse gizli kalıyor, farklı bir
  hata banner'ı geri açıyor. Stil `theme-monolith.css`'te `--red`/`--amber` ile
  (S14g'ye borç bırakmadan, hardcoded hex yok).
- `components/shared/PanelErrorBoundary.tsx` + `withBoundary()` —
  `DockviewContainer`'ın components map'i **tek seferde** sarıldı (modül
  seviyesinde, yoksa her render'da yeni component identity'si tüm panelleri
  remount ederdi), ayrıca `appmain.tsx`'te kök boundary (`root` varyantı
  "Reload window" gösteriyor).
- `lib/diagnosticsReport.ts` — `ExportTab`'ın `renderReport`'u buraya çıkarıldı;
  `copyDiagnostics(context)` raporu kurup panoya yazıyor. Banner'ın ve crash
  kartının "Copy diagnostics"i bunu çağırıyor, yani **25 panelin hiçbiri** bir
  raporun neyden oluştuğunu bilmek zorunda değil. Backend raporu kurulamazsa
  (ki hata anında en muhtemel durum) client tarafı bilgilerle kısmi rapor
  kopyalanıyor.

**`diagnosticsStore` genişletildi:** `uiErrors` + `recordUiError`. Boundary
stack'i buraya yazıyor — Go log dosyası bir renderer crash'ini **göremez**, bu
tek kayıt. `partialize` eklendi: sadece tercihler persist ediliyor, önceki
oturumun crash'i bu oturumun raporuna sızmıyor (store'un kendi felsefesi zaten
buydu).

**El-yazımı view'lar (8d) + events:** `node`, `resourcequota`, `overview`,
`monitoring` aynı `error`/`loading`/`refreshing` + banner kalıbını aldı.
`overview`'ün tick'i `useCallback`'e çıkarıldı (Retry'ın çağırabilmesi için) ve
ölü `activeRef` silindi; `monitoring`'inki de aynı şekilde, ayrıca ilk snapshot
hiç gelmediğinde artık sonsuza kadar "Loading metrics…" yazmıyor.
Plan `events`'i saymıyordu ama 8e'nin ölü Toast ref'i oradaydı ve view zaten
hatayı sessizce yutuyordu — Toast silindi, yerine banner geldi.

**8e'nin iki gerçek hatası:** `clusterTrend` `cpuTrend`/`memTrend` olarak
ayrıldı (iki kart birbirinin **aynısını** çiziyordu; `metricsStore` zaten hem
cpu hem mem tutuyor, store'a dokunmak gerekmedi). `events/main.tsx` ve
`resourcequota/main.tsx`'teki kullanılmayan `Toast` ref'leri (+ import'ları)
silindi.

**Bedava alınan perf işi:** `buildInOptions` artık alan başına, değerlerin
kendisinden türetilen bir imzayla önbelleklenmiş — değerler değişmediği sürece
**aynı dizi kimliği** dönüyor. S14e'nin "her MultiSelect 2 saniyede bir yeniden
render oluyor" maddesinin yarısı burada kapandı (kalan yarısı: `setItems`'ın
kendisi).

**Plandan bilinçli sapma:** plan `reload`'a `clusterName` değişiminde reset
öneriyordu; eklendi, sonra **geri alındı** — `setItems([])` gate'ini kırıyordu
ve panel zaten cluster'a pinli (CLAUDE.md), yani pratikte hiç tetiklenmiyor.

**Testler (8f):** `lib/useResourceList.test.ts` (4) — reddeden fetcher `error`'ı
set edip satırları **koruyor**, başarı `error`'ı temizliyor, `loading` yalnız
ilk settle'a kadar true, `buildInOptions` aynı değerlerde aynı diziyi dönüyor.
Ek olarak `components/shared/PanelErrorBoundary.test.tsx` (6) — boundary crash
kartını çiziyor + stack'i store'a yazıyor, "Reload panel" subtree'yi remount
ediyor, `uiErrors` persist **edilmiyor**, banner mesajı birebir gösteriyor ve
mesaj başına kapanıyor. Toplam 17 test geçiyor.

> Boundary testinde bir tuzak: "Reload panel" **children'ı remount ediyor ama
> ebeveyni yeniden render etmiyor**, dolayısıyla throw'u prop olarak geçen bir
> test kurgusu remount'u hiç göremez. Bayrağı render içinde okumak gerekiyor.

**Verify çıktısı:** `npx tsc --noEmit` temiz, `npm run test` 17/17,
`npm run build` geçti (`frontend/dist/.gitkeep` geri alındı), `npm run lint`
**0 hata** (127 uyarı, hepsi önceden var olan `no-explicit-any` /
`exhaustive-deps` sınıfı), `grep "setItems(\[\])" lib/useResourceList.ts` boş,
`go build`/`go vet`/`go test ./...` etkilenmedi (backend'e tek satır
dokunulmadı, binding yüzeyi değişmedi → `make bindings` gerekmedi).

**Yapılmayan:** plandaki 4 maddelik manuel kontrol (ölü IP'li kubeconfig, RBAC'siz
kullanıcı, sağlıklı+boş namespace, geçici `throw`) canlı cluster istiyor; bu
oturumda koşulmadı. Dördüncüsünün mekaniği yukarıdaki boundary testiyle
kapsanıyor.

---

## Step 9 — Eksik eylemler A: Describe, Resource Quota, eksik delete/update, namespace create ✅

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

### Uygulandı — sonuç

**9a. Describe.** `GetObjectDescribe` binding'i eklendi (backend'e tek satır bile
yazılmadı — S9'un öngördüğü gibi implementasyon hazırdı, sadece bağlanmamıştı).
Yeni `components/workspace/DescribePanel.tsx` düz `<pre>`; **Monaco bilinçli
olarak kullanılmadı** (dökümün dili yok, şeması yok, düzenlenmiyor — bundle'daki
en ağır import'u bir metin bloğu için ödemek anlamsız). Refresh **scroll
pozisyonunu koruyor**, hata S8'in `ErrorBanner`'ıyla gösteriliyor ve son iyi
metin ekranda kalıyor (liste view'larıyla aynı kural). `describe` paneli
`DockviewContainer`'a kaydedildi, `TabContext`'e `openDescribePanel` +
`openReceivedPanel`'e `describe` case'i eklendi — yani panel pencereler ve
instance'lar arası taşınabiliyor (params saf veri, structured-clone güvenli).

**Tek prop ile 22 view.** `ResourceListView`'a `describeResource?: string`
eklendi; buton kolonu otomatik olarak **en sona** ekleniyor. Burada gerçek bir
tuzak vardı: `columns` render-prop'u bir Fragment döndürüyor ve
`React.Children.toArray` dizileri düzleştirirken **Fragment'leri düzleştirmiyor**
— bu yüzden `<>{columns(...)}{describeColumn}</>` şeklinde sarmak *bütün veri
kolonlarını görünmez yapardı* (dosyanın başındaki `toColumnArray` yorumu tam
olarak bu hatayı anlatıyor). Çözüm: `toColumnArray(node, extra)` — Fragment
açıldıktan **sonra** ekleme. Ayrıca ek kolon action-kolonu imzasına uyduğu için
mevcut action kolonu onun sol komşusu oluyor ve ikisinin de resize handle'ı
zaten var olan kurala göre gizleniyor.

CRD `InstanceTable` ve Security Role Map detay modalı da Describe kazandı — ikisi
de zaten (group, resource, ns, name) konuşuyordu, describe'a group bile gerekmiyor
(plural'ı REST mapper çözüyor, CRD'ler generic describer'a düşüyor).

**9b. Resource Quotas.** `GetResourceQuotas` bind edildi ve view `GetNamespaces`
üzerinden yeniden kurmayı bıraktı — eskiden namespace başına bir quota list'i
fan-out ediliyordu, şimdi tek çağrı. Düz liste namespace'e göre gruplanıp
alfabetik sıralanıyor. **Bilinçli kayıp:** namespace başlığındaki Active/
Terminating rozeti gitti (`NamespacedResourceQuota` status taşımıyor); yerine
o namespace'teki quota sayısı yazıyor. Quota satırlarına Describe de eklendi.

**9c. Eksik delete'ler.** Typed: ServiceAccount, Role, RoleBinding, LimitRange,
Endpoint (mevcut `errNamespace*Required` guard'larıyla). Generic
`DeleteObject` üzerinden: IngressClass, PersistentVolume, StorageClass.
**Node delete eklenmedi** — plan böyle diyordu; S16'da Known Limitations'a
yazılacak.

**9d. Eksik update'ler.** Job, IngressClass, Endpoint, PV, PVC, StorageClass için
`UpdateXYaml` eklendi ve `YamlEditorPanel`'in `editable` listesi genişletildi.
Job'ın spec'i büyük ölçüde immutable — API server'ın net reddi artık toast'ta
görünüyor, ki bu sebepsiz read-only bir editörden dürüst.

**9e. Namespace create.** `CreateNamespace(cluster, name, labels)`. İsim **elle
doğrulanmıyor**: DNS-1123 kurallarının sahibi API server ve reddi birebir
gösteriliyor, böylece kurallar değişse de doğru kalıyor. `ResourceListView`'a
`toolbarExtra` render-prop'u eklendi (`{ reload }` alıyor) ki dialog başarıyla
kapandığında liste 10 saniyelik poll'ü beklemeden yenilensin.

**TUI parite (registry.go).** GUI'ye eklenen her delete/update TUI'ye de indi:
`clusterScopedUpdate` ve `clusterScopedDelete` yardımcıları eklendi (mevcut
`clusterScopedYAML`'ın yazma/silme karşılıkları), sonra endpoints /
serviceaccounts / roles / rolebindings / limitranges / jobs / pvc'ye `del:` ve
`updateYAML:`, ingressclasses / persistentvolumes / storageclasses'a generic
delete bağlandı.

**Verify çıktısı:** `go build` / `go vet` / `go test ./...` temiz (17 Go paketi),
`grep -rn "wailsapp/wails" internal/tui cmd/tui` boş, bindings regen sonrası
plandaki grep 3 döndü, `npx tsc --noEmit` temiz, `npm run test` 17/17,
`npm run build` geçti, `npm run lint` **0 hata** (127 uyarı — S8'deki sayının
aynısı, hepsi önceden var), `frontend/dist/.gitkeep` geri alındı,
`graphify update .` koşuldu.

**Yapılmayan:** plandaki manuel kontrol (Describe çıktısını `kubectl describe`
ile karşılaştırma, gerçek silme/oluşturma) canlı cluster istiyor; bu oturumda
koşulmadı. Ayrıca `node/main.tsx` el-yazımı olduğu için Describe almadı —
plan onu saymıyordu ama Node describe'ı doğal bir adaydır, S16'ya not.

---

## Step 10 — Eksik eylemler B: Scale ve Rollout Restart ✅

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

### Uygulandı — sonuç

**Kapsam planın ötesine geçti (kullanıcı onaylı):** Scale + Rollout Restart'a
ek olarak **CronJob suspend/resume** ve **Scale dialog'unda HPA uyarısı**.
İlki teknik olarak restart ile birebir aynı iş (tek alanlık patch), ikincisi
olmadan HPA'lı bir workload'u scale etmek "uygulama bozuk" gibi görünüyordu.

**10a. Scale.** `services/scaleServices.go::ScaleWorkload` — `autoscalingv1.Scale`
+ `UpdateScale`, planın dediği gibi **scale subresource'u**. İmza plandan
kasten farklı: `(kind, namespace, name, replicas, client)` — komşu typed
servislerin hiçbiri `ctx` almıyor ve hepsinde `client` **son** parametre;
plandaki `(ctx, client, ...)` şekli bu dosyada yalnız kalırdı.
`errNegativeReplicas` `errors.go`'ya eklendi.

**10b. Rollout restart.** `services/rolloutServices.go::RestartWorkload` —
`kubectl.kubernetes.io/restartedAt` annotation'ı, strategic-merge-patch, pod
silme yok. Patch gövdesi `fmt.Sprintf` değil **`json.Marshal`** ile kuruluyor;
zaman damgası gömüldüğü JSON string'inden kaçamasın diye.

**10c. CronJob suspend.** `services/cronJobServices.go::SetCronJobSuspend` —
kind'a özel olduğu için kendi dosyasında, cross-kind olan diğer ikisi ayrı
dosyalarda.

**HPA uyarısı.** `FindScaleAutoscaler` `autoscaling/v2` HPA'larını listeleyip
`scaleTargetRef` ile eşleştiriyor (HPA'da Kind **TitleCase**, bizim sözlük
küçük harf — arada `scaleTargetKinds` map'i var). `business.GetWorkloadAutoscaler`
**hatayı yutuyor**: HPA listelemek ayrı bir RBAC fiili ve `autoscaling/v2` ancak
1.23'ten beri var, ikisinde de doğru cevap "bilmiyoruz", "scale başarısız olsun"
değil. Emsal `GetNodes`'un opsiyonel metrics client'ı (`business/node.go:56`).
Sonuç: uyarı **garanti değil**, ama yokluğu hiçbir zaman eylemi engellemiyor.

**Controller.** `ScaleWorkload` `replicas`'ı `int` alıyor (JS'te int32 yok) ve
aralık kontrolünü **daraltmadan önce** yapıyor — `int32(replicas)` taşan bir
değerde sessizce sarmalanıp workload'u rastgele bir sayıya çekerdi.

**10d. Frontend.** `ScaleDialog.tsx` (**Slider + InputNumber birlikte**; mevcut
sayı satırdan geliyor — ekstra çağrı yok; HPA notu; 0 uyarısı; hata dialog
**içinde**, kullanıcı oradayken toast'a göndermek anlamsız) ve
`ConfirmActionDialog.tsx`.

Slider'ın tavanı **latch'lenen state**, türetilmiş değer değil: replica sayısının
doğal bir üst sınırı yok, ama slider'ın bir `max`'ı olmak zorunda. Tavan açılışta
`max(10, mevcut*2)` ile başlıyor ve sadece **büyüyor** (HPA daha yükseğini
gösterirse veya kullanıcı üstünü yazarsa). `replicas`'tan türetilseydi handle'ı
sola sürüklerken tavan da küçülür, handle imlecin altından sağ uca geri
zıplardı. Büyük/kesin değerler için InputNumber duruyor — slider tek başına
tavanının ötesini ifade edemez. `theme-monolith.css`'e `.p-slider` override'ı
eklendi (yeni PrimeReact bileşenleri için proje kuralı; slider repoda ilk kez
kullanılıyordu ve base tema renkleriyle geliyordu).
**PrimeReact'ın `ConfirmDialog`'u kullanılmadı** — repoda hiç kullanılmıyor,
global bir servis + mount noktası istiyor; mevcut her onay düz `<Dialog>` +
footer (`ResourceListView`'ın delete'i, namespace create).

Butonlar `shared/WorkloadActions.tsx`'te toplandı: 5 view'a kopyalanacak
buton+dialog bloğu yerine tek bileşen, her `main.tsx` action kolonuna tek eleman
ekliyor. `clusterName`/`reload`/`toastRef` **açık prop** — DataTable body
renderer'ları module scope'ta, closure ile yakalayamazlar (CLAUDE.md kuralı).
`ColumnsContext` bunun için `reload` + `toastRef` kazandı (ikisi de
`useResourceList`'ten zaten dönüyordu).

**Yetenek matrisi kasten simetrik değil:** replicasets'te Restart yok (kendi
rollout'u yok, sahibi Deployment'ın işi), daemonsets'te Scale yok (replica
sayısı = node sayısı, scale subresource'u yok). Backend de bu çiftleri net
hatayla reddediyor; frontend sadece ölü butonu ekranda tutmuyor.

**TUI pariteti.** `app.go`'ya `prompt()` eklendi — `confirm` var ama sayı
sorabilecek hiçbir şey yoktu; `tview.Modal` sadece buton alıyor, o yüzden
`showAddCluster`'daki gibi küçük bir Form. `rowAction`'a `promptLabel`/`runArg`
eklendi, `resourcelist.go`'daki dispatch üç dallı oldu.
**Tuşlar plandan farklı: `S`/`R`/`P`/`U`, küçük harf değil** — `keys.go`'da
`r` zaten refresh, `s` pod ekranında shell; node eylemleri de bu yüzden
büyük harf (`C`/`U`/`D`). CronJob'da tek toggle yerine iki idempotent tuş,
çünkü `rowAction` satırın mevcut suspend durumunu görmüyor.

**Verify çıktısı:** `go build` / `go vet` / `go test ./...` temiz,
`grep -rn "wailsapp/wails" internal/tui cmd/tui` boş, bindings regen sonrası
plandaki grep **4** döndü, `npx tsc --noEmit` temiz, `npm run lint` **0 hata**
(127 uyarı — S9'daki sayının aynısı, hepsi önceden var), `npm run test` 17/17,
`npm run build` geçti, `frontend/dist/.gitkeep` geri alındı,
`graphify update .` koşuldu.

**Yapılmayan:** plandaki manuel kontroller (gerçek scale/restart/suspend,
`kubectl rollout history` karşılaştırması, HPA uyarısının canlı görünmesi)
canlı cluster istiyor; bu oturumda koşulmadı. **S16'ya not:** HPA uyarısının
`list hpa` yetkisi veya `autoscaling/v2` olmayan cluster'larda görünmemesi
Known Limitations'a yazılmalı.

---

## Step 11 — Port forwarding: process-ömürlü tünel modeli ✅

**En büyük yeni özellik. Yaşam döngüsü kararı işin can alıcı kısmı.**

### Yaşam döngüsü kararı
Log ve exec session'ları **panele bağlı**: panel açar, panel kapanınca ölür. Port-forward bunun **tersi** — **process'e bağlı**. Kullanıcı `127.0.0.1:8080 → svc/api:80` başlatır, paneli kapatıp tarayıcısında çalışmaya gider. Panel kapanınca tüneli öldürmek hatadan ayırt edilemez.
- Forward'lar servis katmanında **process-global registry**'de yaşar, ama panel dispose'ta hiçbir şey onları kapatmaz.
- "Port Forwards" paneli backend registry'sine **bakan bir view**, sahibi değil.
- Sadece kullanıcı açıkça durdurur veya process çıkışında `StopAllPortForwards()`.
- Forward'lar **instance başına**; aynı yerel portu iki instance forward ederse ikincisi "already in use" alır — bu doğru ve dürüst.

### Kullanıcı onaylı kararlar (planlama oturumu)

| Konu | Karar |
|---|---|
| Tünel öldüğünde | **Akıllı kural**: hedef workload/service ise pod'u yeniden çöz + backoff'lu 5 deneme; hedef doğrudan Pod ise reconnect yok, `error` göster |
| Global görünürlük | **Başlık çubuğunda pill + popover**, yalnız canlı forward varken |
| Kalıcılık | **Kapanışta hepsi ölür** — kaydedilmiş forward yok |
| TUI | **Tam parite** — `F` ile başlat, `portforwards` view'ı, `X` ile durdur |

---

### Uygulandı — sonuç

**11a. Model.** Yeni `internal/models/portForwardInfo.go`: `PortForwardInfo`
(id, cluster, ns, kind/name, **pod** — reconnect'te değişir —, local/remote/**target**
port, address, status, error, startedAt, attempts, **hint**, **reconnect**) ve
`PortOption` (dialog'un uzak-port seçicisini besler).

`Hint` plandan sonra eklendi: "Open in browser" butonunun ne zaman gösterileceğine
karar veriyor. Port **numarasından** türetiliyor (`portHint("", RemotePort)`) —
Postgres tüneline tarayıcı açmak kimseye faydası olmadığı için buton gizleniyor,
ama "Copy address" her zaman duruyor, yani yanlış tahmin en fazla bir butona mal olur.

**11b. Services — iki dosya, kasten ayrı.**
- `portForwardTarget.go` — "hangi pod, hangi port?" Cluster'sız test edilebilen
  kısım burada: `resolveForwardTarget`, `resolveServiceTargetPort`, `pickReadyPod`,
  `workloadPodTemplate`, `ResolveForwardablePorts`, `portHint`, `SuggestLocalPort`.
- `portForwardServices.go` — registry, session yaşam döngüsü, dialer, supervisor.

Plandaki "logServices.go helper'larını aynen kullan" tam olarak uygulanamadı:
o helper'lar `[]string` **isim** dönüyor, port-forward'ın ise Running **ve** tüm
container'ları ready olan bir pod objesine ihtiyacı var (değilse tünel kurulur ve
her isteği reddeder — "uygulama bozuk" gibi görünür). Bunun yerine
`labelSelectorString` `logServices.go`'dan **çıkarıldı** ve iki taraf da onu
kullanıyor; selector çözümü tek yerde kaldı, readiness filtresi yeni.

**Loopback-only, pazarlık konusu değil:** `portforward.NewOnAddresses(dialer,
[]string{"127.0.0.1"}, ...)`. `portforward.New` yok. Frontend'den adres parametresi
**alınmıyor** — gerekçe kodda yorum olarak.

**Dialer plandan farklı ve daha iyi:** client-go v0.36.1'de
`portforward.NewSPDYOverWebsocketDialer` + `NewFallbackDialer` var. kubectl 1.30+
websocket'i önce dener, `httpstream.IsUpgradeFailure`/`IsHTTPSProxyError`'da SPDY'ye
düşer. Taslak yalnızca SPDY diyordu; SPDY kalkıyor ve bazı proxy'ler upgrade'i
blokluyor. Websocket dialer kurulamazsa **sessizce SPDY'ye düşülüyor** — tercih
edilen transport'u kaybetmek forward'ı başarısız kılmaya değmez.

**Supervisor.** `run()` session'ın tüm ömrünü sahipleniyor: çöz → bağlan → servis
et → (uygunsa) yeniden bağlan. Üç kural:
1. **Reconnect kuralı `reconnectForKind(kind)`** — `kind != "pod"`. Pinlenmiş bir
   pod silindiyse başka bir pod'a sessizce geçmek yanlış cevap.
2. **Reconnect'te yerel port sabit** (`boundPort()`), 0 değil. Kullanıcının açık
   tarayıcı sekmesi/`curl`'ü çalışmaya devam etmeli; yeni port seçmek reconnect'i
   anlamsız kılar.
3. **Hiç ready olmadan ölen forward `StartPortForward`'ın hatası olarak dönüyor ve
   registry'de iz bırakmıyor** (kullanıcı zaten dialog'a bakıyor); **ready olup
   sonra ölen ise `error` durumuyla registry'de kalıyor** ki panelde nedeni
   okunabilsin. Ayrım `everReady`.

`runOnce` attempt başına ayrı bir `attemptStop` kanalı kullanıyor — bir denemeyi
bırakmak session'ı bitirmemeli, ama session stop'u denemeyi bitirmeli.
`ForwardPorts()` goroutine'i `defer close(errCh)` ile korunuyor: safego panic'i
yakalarsa alıcı nil alır, sonsuza kadar beklemez.

**Kayıt kimliğe göre siliniyor** (`pfRemove`), CLAUDE.md session-registry kuralı.
`out`/`errOut` atılmıyor, `pfLogWriter` ile `logging.With("portforward").Debug`'a
gidiyor — client-go bağlantı hatalarını başka hiçbir yere yazmıyor.

**Ön bind kontrolü** (`localPortFree`): TOCTOU var ve kabul; amacı kriptik bir
stream hatası yerine *"local port 8080 is already in use"* demek.

**11c. Business / Controller.** `business/portForward.go` **streaming** client+config
çözüyor (`NewK8sClientAndConfigForClusterStreaming`) — normal constructor'ların 20s
timeout'u tüneli oturum ortasında keserdi. Controller'da beş metot; portlar `int`
(JS'te int32 yok, S10'daki `ScaleWorkload` emsali); id `uuid.NewString()`.

**Tek broadcast event `portforward:update`**, session-son ekli değil: tüketici bir
registry view'ı + bir başlık çubuğu göstergesi, payload zaten id taşıyor. Ve
`tab:received`'ın aksine **`isPrimaryWindow()` guard'ı yok** — bir shell'in tüm
pencereleri aynı backend'i ve dolayısıyla aynı tünelleri paylaşıyor.

**Kapanış iki yoldan da bağlandı:** `serve()` içinde `srv.Close()` öncesi, ve Wails
`OnShutdown`. İkincisi **metot değil closure** — Wails her exported `App` metodunu
binding'e çevirir.

**11d. Frontend.**
- `stores/portForwardStore.ts` — zustand, **persist yok** (`metricsStore` emsali:
  bir forward, portunu bind eden process'ten uzun yaşayamaz, açılışta liste
  göstermek yalan olurdu). `startSync()` idempotent; `EventsOn` + 5s güvenlik
  poll'ü. **`TitleBar`'dan başlatılıyor, panelden değil** — pill, panel kapalıyken
  de çalışmak zorunda.
- `components/portforward/PortForwardsPanel.tsx` — singleton `portforwards` paneli,
  `params: {}`, `${view}:${clusterName}` şemasının dışında (Diagnostics emsali).
  Kolonlar: status, address, target, namespace, pod, cluster, age. Aksiyonlar:
  Open in browser (yalnız `hint` http/https ise), Copy address, **Restart**, Stop.
  Restart backend fiili değil, stop+start: yeni tünel hedefi yeniden çözer ve yeni
  bir id alır — pod değiştikten sonra istenen tam olarak bu. Yerel port açıkça
  isteniyor ki kullanıcının elindeki adres çalışmaya devam etsin.
- `components/shared/PortForwardDialog.tsx` — **uzak port `Dropdown`'dan seçiliyor,
  yazılmıyor**: `GetForwardablePorts` hedefin gerçek portlarını isimleriyle veriyor
  (`http · 8080/TCP · api`), sonda `Custom…`. Tek portlu hedefte otomatik seçim.
  UDP **disabled** (yok sayılmıyor — yokluğunu açıklamak gizlemekten iyi). Port
  listelenemezse **engellemiyor**, elle girişe düşüyor. Yerel port
  `SuggestLocalPort` ile öneriliyor, farklıysa *"Port 8080 is already in use —
  suggesting 8081"*. Tek satır güvenlik notu: *"Bound to 127.0.0.1 only."*
  Hata dialog'un **içinde** (S10 `ScaleDialog` kararı).
- `ResourceListView`'a `portForward?: { kind }` prop'u. **`describeColumn` tek bir
  `trailing` kolonuna dönüştürüldü**, iki ayrı kolon eklenmedi: `toColumnArray` tek
  `extra` alıyor ve aksiyon kolonu **ile solundaki komşuyu** etiketleyerek resize
  handle'larını gizliyor; araya ikinci bir kolon girseydi sürüklenebilir bir kenar
  geri gelir ve butonlardan yer çalardı. `pods`/`services`/`deployments`/
  `statefulsets`/`replicasets`'e tek satır prop.
- `titlebar/PortForwardPill.tsx` + `theme-monolith.css`'te `.tb-pf` / `.pf-overlay__*`.
  Update pill'inin solunda, **yalnız canlı forward varken**. Tek tık popover
  (Open/Copy/Stop), çift tık panel. `reconnecting`/`starting` varsa amber, `error`
  varsa kırmızı. Update pill'inden **daha sessiz** stillendi: normal bir durumu
  bildiriyor, eyleme çağırmıyor.

**11e. TUI — tam parite.** `portForwardAction('F')` pods/services/deployments/
statefulsets/replicasets'e eklendi; prompt `"8080:80"`, `":80"` veya `"80"` kabul
ediyor (`parsePortPair`). Yeni `portforwards` view'ı CLUSTER menüsünde,
`list` cluster argümanını yok sayıyor, `X` durduruyor, `getYAML`/`del` nil
(`resourcelist.go` nil-toleranslı). `keys.go`'ya `F` eklendi.
**Büyük harf `F`**, çünkü `r` refresh ve `s` pod ekranında shell (S10'daki
`S`/`R`/`P`/`U` ile aynı gerekçe).

**Düzeltilen kusur (ilk denemede kaçtı, canlı cluster'da yakalandı).**
Ready-işaretlemesi tasarımdaki `onReady` callback'inden `runOnce`'ın içine
taşınırken **`report(nil)` çağrısı kayboldu**. Sonuç sinsi: tünel açılıyor,
`ready` event'i yayınlanıyor, port gerçekten bind ediliyor — ama `run()` ancak
`runOnce` döndükten sonra rapor ediyor, o da **tünel ölene kadar dönmüyor**.
Yani `StartPortForward` süresiz bloke oluyordu; RPC settle olmadığı için
dialog'un Start butonundaki promise hiç çözülmüyor, modal ne kapanıyor ne iptal
edilebiliyordu. Backend'de hiçbir hata görünmüyor — belirti "uygulama dondu".

Üç katmanlı düzeltme:
1. `runOnce(t, localPort, onReady func())` — ready dalında `onReady()` çağrılıyor;
   `run()` bunu `func() { report(nil) }` olarak geçiyor.
2. `pfSession`'a **`resolve`/`attempt` seam'leri** eklendi (`newPFSession`'da
   gerçekleriyle dolduruluyor). Kontrat — *hazır olunca* rapor et, tünel bitince
   değil — canlı API server olmadan başka türlü gözlemlenemiyor;
   `TestStartReturnsWhenReadyNotWhenTunnelEnds` bu seam sayesinde hermetik.
3. `pfStartTimeout` (45s) backstop: `StartPortForward` artık hiçbir koşulda
   süresiz beklemiyor — bir RPC'nin dönmemesi, iptal bile edilemeyen bir dialog
   demek. 20s resolve + 15s ready zaten üst sınır, yani 45s'ye ulaşmak
   "session hiç rapor etmedi" anlamına geliyor.

**Frontend tarafı:** dialog artık **başlatma sürerken de kapatılabiliyor**.
Forward backend'e ait, dialog'a değil — kullanıcı vazgeçtikten sonra başlatma
başarılı olursa forward zaten Port Forwards panelinde ve pill'de belirir, ki
doğru yeri orası. `alive` ref'i, dismiss'ten sonra düşen state yazımlarını
koruyor.

**11f. Testler.** `internal/services/portForwardServices_test.go` — 12 test,
hepsi hermetik: kimliğe-göre-silme (aynı id'yle gelen replacement'ın eski
session'ın cleanup'ıyla düşmemesi), idempotent stop, `StopAllPortForwards`,
liste sıralaması, reconnect kuralı, `SuggestLocalPort` (gerçekten bir port bind
edip önericinin atladığını doğruluyor), `resolveServiceTargetPort` (sayısal /
boş / isimli / eşleşmeyen isim), `servicePortByNumber`, `podIsReady`,
`containerPortOptions`, `portHint`, ve yukarıdaki iki regresyon testi
(**ready'de rapor**, **start backstop**).
`frontend/src/stores/portForwardStore.test.ts` — 7 test: id'ye göre upsert,
sıra kararlılığı, `closed` düşüyor / `error` kalıyor, backend erişilemezken
son liste korunuyor, `isWebForward`/`forwardUrl`/`forwardAddress`.

### Bilinen kısıtlar (S16 Known Limitations'a)
- **TUI ayrı bir process** — kendi forward registry'si var, GUI'ninkini görmez.
  GUI'nin CLI Mode'u binary'yi bir pty'de yeniden exec ettiği için overlay
  kapanınca o process ölür ve orada başlatılan tüneller de ölür.
- TUI'de `F` **senkron** çalışıyor (tünel hazır olana kadar bekler, en kötü 15s).
  Scale/restart de aynı şekilde senkron (20s client timeout'u ile), yani davranış
  tutarlı; tek bir aksiyon için asenkron `rowAction` varyantı eklenmedi.
- `Hint` yalnız **port numarasından** türüyor, port adından değil: `metrics`
  adlı 9091 portu "Open in browser" butonunu almaz. Copy address her zaman var.
- Otomatik reconnect **workload/service** hedeflerine mahsus ve **5 deneme** ile
  sınırlı; sonrasında satır `error` durumunda kalır ve Restart bekler.

**Yapılmayan:** aşağıdaki manuel kontroller canlı bir cluster istiyor ve bu
oturumda koşulmadı.

**Verify**
```bash
GOEXPERIMENT=jsonv2 go build ./... && GOEXPERIMENT=jsonv2 go vet ./... && GOEXPERIMENT=jsonv2 go test ./...
grep -n "NewOnAddresses" internal/services/portForwardServices.go        # olmalı
grep -n "portforward\.New(" internal/services/portForwardServices.go     # BOŞ olmalı
grep -rn '0\.0\.0\.0|"localhost"' internal/services/portForwardServices.go  # BOŞ olmalı
grep -n "Streaming" internal/business/portForward.go                     # olmalı
grep -rn "go func()" internal/services internal/controller internal/ipc  # BOŞ olmalı
grep -rn "wailsapp/wails" internal/tui cmd/tui                           # BOŞ olmalı
rm -rf frontend/wailsjs && make bindings
grep -n "PortForward" frontend/wailsjs/go/controller_app/App.d.ts        # 5 metot
cd frontend && npx tsc --noEmit && npm run lint && npm run test && npm run build
git checkout -- frontend/dist/.gitkeep
```
Manuel (kind):
```bash
kubectl create deploy nginx --image=nginx && kubectl expose deploy nginx --port=80
# 1. Services -> nginx satirinda ⇄ -> dropdown 80/TCP'yi kendiliginden secmeli,
#    local port onerilmis olmali. Start.
curl -sSI http://127.0.0.1:<port>/ | head -1     # HTTP/1.1 200 OK
ss -ltnp | grep <port>                            # 127.0.0.1 OLMALI, asla 0.0.0.0
# 2. Paneli kapat, yeniden ac -> forward hala listede. Pill panel kapaliyken de
#    "1 forward" gostermeli.
kubectl rollout restart deploy/nginx              # status reconnecting -> ready,
                                                  # curl AYNI portta calismaya devam
                                                  # etmeli, PodName degismeli
# 3. Pods -> bir pod'a forward ac, kubectl delete pod <ad>
#    -> status error, yeniden deneme YOK, panic yok, satir panelde kaliyor
# 4. Ayni yerel portu ikinci kez iste -> "local port N is already in use"
# 5. UI'dan Stop -> curl basarisiz, satir dusuyor, pill kayboluyor
# 6. Uygulamadan cik -> ss bos (port serbest)
# 7. TUI: Services'te F, "8081:80" -> Port Forwards view'inda gorunmeli, X durdurmali
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

### Uygulandı — S12a sonuç ✅

**Step ikiye bölündü** (planlama oturumu kararı): ~600 sabit string sitesi 84
`.tsx` dosyasına yayılmış; tek diff yarıda kalırsa ağaç yarı-migrate kalıyor.
**S12a** altyapı + koruma bariyerleri + yüksek kaldıraçlı yüzeyleri kapsadı,
**S12b** kalan view/panelleri alacak. İkisi de S13'ten önce.

**Kurulan altyapı**
- `i18next@26` + `react-i18next@17`. `en` **statik bundle** (`locales/en/index.ts`),
  diğer beş locale `import.meta.glob` ile code-split — planın "aktif locale + en
  fallback" hedefi, ama fallback her zaman senkron çözülüyor.
- `main.tsx` `<Suspense>` yerine **`initI18n()`'i await ediyor**; hiçbir bileşen
  çeviri için askıya alınmıyor ve İngilizce olmayan kullanıcı önce İngilizce bir
  kare görmüyor.
- `i18n/i18next.d.ts` — `CustomTypeOptions.resources = typeof en`. **Yanlış
  yazılmış anahtar artık `tsc --noEmit` hatası.** Planda yoktu; statik `en`
  importu bunu bedava yaptı ve S13'ün parite denetleyicisinden bağımsız üçüncü
  bariyer oldu.
- `i18n/useT.ts` — `useTranslation(NAMESPACES)` sarmalayıcısı. Zorunlu: çıplak
  `useTranslation()` `t`'yi sadece `defaultNS`'e göre tipliyor, yani `ns:key`
  formu her çağrı yerinde tip hatası veriyor.
- `stores/localeStore.ts` (themeStore şablonu, `kube-ins-locale`), TitleBar'da
  Theme'in yanında `Language` alt-menüsü.

**Sekme başlıkları canlı çevriliyor.** `TabContext`'teki `viewLabels` map'i
silindi; her panel `params`'ında `titleKey` + `titleVars` taşıyor ve
`renderPanelTitle()` (16 çağrı yeri) tek üretim noktası. `DockviewContainer`
locale değişiminde `api.panels`'i gezip `setTitle` çağırıyor. İki yan kazanç:
`openReceivedPanel`'deki başlık-suffix soyma hack'i kalktı (alıcı başlığı **kendi**
dilinde üretiyor), ve `TerminalPanel`/`ApplyYamlPanel`'in
`api.title.split(' • ')[0]` splice'ı yerine kendi anahtarlarından yeniden
adlandırıyorlar.

**Kolon başlıkları paylaşıldı** (`resources.column.*`): 203 `header=` sitesi 98
benzersiz stringe iniyor, planın `resources.pods.column.status` şemasından
bilinçli sapma — katalog ve S13 çeviri hacmi yarıya indi.

**Migrate edilenler:** `menuItems.tsx` + `menu.tsx`, `TabContext.tsx`,
`DockviewContainer.tsx`, `ResourceListView.tsx` (21 list view'ın toolbar/delete
dialog/aksiyon tooltip'leri), `ErrorBanner.tsx`, `PanelErrorBoundary.tsx`,
`useResourceList.ts`, `TitleBar.tsx`, `AboutModal.tsx`, `UpdateModal.tsx`,
`PortForwardPill.tsx`, `TerminalPanel.tsx`, `ApplyYamlPanel.tsx`,
`tourSteps.ts` (`appTour` const → `buildAppTour(t)`), `appmain.tsx`,
`overview/main.tsx`. **167 `en` anahtarı**, 6 namespace.

**ESLint kuralı planlanandan farklı yazıldı.** `eslint-plugin-i18next` **v6**,
plandaki `markupOnly` / `onlyAttribute` v5 seçeneklerini kaldırmış. Doğru şekil:
```js
'i18next/no-literal-string': ['warn', {
    mode: 'jsx-only',
    'jsx-attributes': { include: ['header','label','title','placeholder',
        'filterPlaceholder','tooltip','emptyMessage','aria-label','alt',
        'summary','detail'] },
    words: { exclude: [ /* boşluk/rakam + GLOSSARY terimleri */ ] },
}]
```
`**/*.test.tsx` kural kapsamı dışında (test fixture'ları UI değil).

**Testler:** `vitest.config.ts`'e `setupFiles: ['./src/test/i18n-setup.ts']` —
`en` ile senkron init, yoksa render edilen her bileşen ham anahtar döndürüp
mevcut string assert'lerini kırıyordu. Artı 8 yeni test:
`contexts/TabContext.test.tsx` (`renderPanelTitle` sözleşmesi: suffix
kompozisyonu, bilinmeyen anahtar fallback'i) ve `i18n/i18n.test.ts` (kataloğu
olmayan locale'e geçiş — S12↔S13 arası ara durum).

**Doğrulama**
```
npx tsc --noEmit                      -> temiz
npm test                              -> 7 dosya / 33 test geçti (25 -> 33)
npm run build                         -> başarılı
npx eslint .                          -> 0 error, 649 warning
GOEXPERIMENT=jsonv2 go build/vet/test -> temiz (Go'ya dokunulmadı)
grep -rn "wailsapp/wails" internal/tui cmd/tui -> boş
```
`en` değerlerinin bugünküyle **birebir aynı** olduğu makine kontrolüyle
doğrulandı (30 nav item + 6 grup `git show HEAD` ile karşılaştırıldı; e2e ve
vitest'in seçtiği 14 kritik string ayrıca) — `e2e_tests/` metinle element
seçtiği için bu koşul zorunluydu.

**Bindings regen edilmedi** — hiçbir exported App metodu veya `models` struct'ı
değişmedi.

### Uygulandı — S12b sonuç ✅

**Lint kuralının kör noktası bulundu ve kapatıldı — bu step'in en önemli
teknik sonucu.** `jsx-attributes` **`include`** listesiyle yapılandırıldığında
plugin, listede olmayan *her* attribute'u atlıyor ve bu atlama o attribute'un
**içindeki JSX'i de kapsıyor**. Bu uygulamada her kolon bir `columns={...}`
render prop'unun içinde tanımlı olduğu için **203 `header=` stringinin tamamı
kurala görünmezdi** — S12a sonundaki "528 uyarı" rakamı bu yüzden eksikti.
Kural `exclude` tabanlına çevrildi (`className`, `.*[Ss]tyle`, `field`,
`inputId`, `globalFilterFields` … gibi taşıyıcı attribute'lar hariç), gerçek
sayı **797**'ye çıktı ve sıfırlandı.

**Mekanik geçiş** (tekrar eden yüzeyler script'le):
- 203 `header=` → **89 paylaşılan `resources.column.*` anahtarı**
- 57 `placeholder="All"` → `common:filter.all`
- 28 `filterPlaceholder=` → 3 `resources.filter.*` + mevcut kolon anahtarları
- 23 `title=`/`emptyMessage=` → `resources.<dizin>.title` / `.empty`
  (bölümler **dizin adıyla** anahtarlanıyor: `resources.pod.*` ⇄
  `components/pod/main.tsx`)

**Elle geçirilenler:** `ai/AiChat.tsx`, `security/{TrivyScanner,SecurityRoleMap}.tsx`,
`cluster/{ClusterModal,ClusterBar}.tsx`, `monitoring/`, `node/`,
`networkpolicy/PolicyViewerPanel.tsx`, `diagnostics/` (4 dosya), `crd/` (3),
`shared/{WorkloadActions,ScaleDialog,PortForwardDialog,ConfirmActionDialog}.tsx`,
`portforward/`, `events/`, `resourcequota/`, `namespace/`, `limitrange/`,
`workspace/*`, `logs/`, `terminal/`, `climode/`, `transfer/`, `tour/`,
`{role,rolebinding,secret,configmap}` editör panelleri, `pages/info/`.

**İçine gömülü markup taşıyan cümleler `<Trans>` ile çevrildi** (düz `t()` ile
`<strong>`/`<code>` kaybolurdu): node drain uyarısı, workload restart/suspend
onayları, AI'ın Ollama-bulunamadı ve tool-desteği uyarıları.

**Yol boyunca çıkan üç gerçek bulgu:**
1. **`transfer/InstancePickerMenu.tsx` ve `workspace/FloatableTab.tsx` sabit
   Türkçe string taşıyordu** ("Yeni pencerede aç", "Pencereye Taşı",
   "Instance'a Taşı", "Kapat") — İngilizce varsayılan bir uygulamada hata.
   `en` kataloğu İngilizcelerini aldı; Türkçeleri S13'te `tr`'ye gidecek.
2. **`components/listbox.tsx` ölü kod** — `src/` içinde hiçbir yerden import
   edilmiyor. Çevrilmedi; dosya başına gerekçeli `eslint-disable` konuldu
   (ölü kod için katalog anahtarı üretmek S13'e erişilemeyen string çevirtir).
   **Silinmesi ya da bağlanması gerekiyor — karar kullanıcının.**
3. `PolicyViewerPanel.tsx::buildGraph` ve `TrivyScanner.tsx`'in
   `severityFilterTemplate`'i bileşen değil; `t` birinciye **parametre** olarak
   geçirildi, ikincisi gerçek bir bileşene (`SeverityFilter`) dönüştürüldü —
   PrimeReact bir `filterElement` template'ini tablonun kendi render'ı içinde
   çağırdığı için oraya konan hook, tablonun hook sırasına koşullu girerdi.

**Lint kuralı `warn` → `error` yapıldı (plandan sapma).** Plan bunu S13'e
bırakıyordu; gerekçe "S12 çıkarımı bitiremeyecek" varsayımıydı. Bitirdi ve
kural `src/` genelinde sıfır rapor ediyor. `warn`'da bırakmak, katalogların
elle düzenlendiği tek pencereyi aynı zamanda yeni bir sabit stringin build'i
kıramadığı tek pencere yapardı. Geri alınması tek kelimelik.

**Doğrulama**
```
npx tsc --noEmit                      -> temiz
npm test                              -> 7 dosya / 33 test geçti
npm run build                         -> başarılı
npx eslint .                          -> 0 error, 132 warning
                                         (i18next: 0; kalanlar önceden var olan
                                          no-explicit-any 112 + exhaustive-deps 19)
GOEXPERIMENT=jsonv2 go build/vet/test -> temiz (Go'ya dokunulmadı)
grep -rn "wailsapp/wails" internal/tui cmd/tui -> boş
```
**628 `en` anahtarı**, 6 namespace. `e2e_tests/`'in metinle seçtiği 25 panel
başlığı + 14 kritik string `git show HEAD` ile karşılaştırılarak **birebir aynı**
olduğu makine kontrolüyle doğrulandı.

### S13 için hazır

`en` tek doğru kaynak olarak tamam. S13 `{tr,de,ru,zh,ja}/` altına 30 dosya
yazacak; `tr` için hazır bir başlangıç var: yukarıdaki (1) numaralı bulgudaki
dört Türkçe string zaten yazılmıştı. Parite denetleyicisi (13b) `en`'i referans
alacak; lint kuralı 13c'de zaten `error` durumda.

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

### Adım ikiye bölündü (planlama oturumu kararı)

628 anahtar × 5 dil ≈ 4000 satır JSON. **S13a** çürüme korumasını (denetleyici +
wiring) tek başına merge edilebilir hâlde bitirir; **S13b** çevirileri getirir.
Bariyerin çevirilerden önce yürürlüğe girmesi kasıtlı: S13b'nin her locale'i
teslim edildiği anda makine tarafından denetlenir.

**13c'de yapılacak iş yok.** "Lint kuralını `warn` → `error` çevir" maddesi
**S12b'de zaten yapılmıştı** (`frontend/eslint.config.js:65`).

### Uygulandı — S13a sonuç ✅

**Yeni `frontend/scripts/i18n-check.mjs`** — bağımlılıksız (`node:fs/path/url` +
yerleşik `Intl.PluralRules`), `npm run i18n:check`.

**Çoğul kuralı plandan saptı — ve sapmak zorundaydı.** Plan "parite
denetleyicisi fazladan çoğul son eklere izin vermeli" diyordu; bu, hem `zh`/`ja`
hem `ru` için yanlış. CLDR kategorileri:

| | borçlu olduğu formlar |
|---|---|
| `en`, `tr`, `de` | `_one`, `_other` |
| `ru`             | `_one`, `_few`, `_many`, `_other` |
| `zh`, `ja`       | **yalnız** `_other` |

Naif "en'de var, locale'de yok → fail" kuralı zh/ja'yı Çince'de var olmayan bir
`_one` yüzünden düşürürdü; naif allowlist ise ru'nun eksik `_few`/`_many`'sini
sessizce geçirirdi. Denetleyici bunu `Intl.PluralRules(locale)`'den türetiyor,
yani her iki hata da fail. `en`'in üç çoğul grubu var:
`panels:portForward.pill`, `panels:crd.kind`, `panels:crd.deleteBody`.

**Sekiz FAIL kuralı:** (1) namespace dosya kümesi `en` ile farklı, (2) `LOCALES`'te
kayıtlı olmayan katalog dizini (asla yüklenemez), (3) `en`'de olup locale'de
olmayan anahtar, (4) tersi, (5) yukarıdaki çoğul kuralı, (6) `{{placeholder}}`
kümesi farklı, (7) `<Trans>` etiket indeksi düşmüş/yeniden numaralanmış,
(8) JSON parse hatası / string olmayan leaf. Ayrıca `en`'in namespace dosyaları
`i18n/index.ts`'teki `NAMESPACES` ile karşılaştırılıyor — kayıtsız katalog
dosyası hiç fetch edilmez ve eksik çeviriden ayırt edilemez.

**`<Trans>` etiketleri küme olarak karşılaştırılıyor, dizi olarak değil** —
Almanca ve Japonca etiketlerin etrafındaki cümle öğelerini meşru şekilde yeniden
sıralıyor; yakalanması gereken hata düşme/yeniden numaralama.

**Tek WARN:** bir dosyanın çevrilebilir değerlerinin >%20'si `en` ile birebir
aynıysa (kopyalanmış-ama-çevrilmemiş dosya imzası). Muafiyet zorunlu oldu:
`{{...}}` ve `<N>` temizlendikten sonra kalan her token'ı GLOSSARY terimi ya da
sayı olan değerler sayılmıyor — yoksa `nav.json` (`Pods`, `Nodes`,
`ConfigMaps` …) **doğru olduğu için** her locale'de uyarı verirdi. Sözlük
`GLOSSARY.md`'nin fenced bloğundan okunuyor (2+ boşlukta bölünüyor, böylece
`Kube Inspector` tek terim kalıyor); dosyaya bu bloğun makine tarafından
okunduğunu söyleyen bir not eklendi.

**Kayıtlı ama dizini hiç olmayan locale = WARN, fail değil.** S12→S13b arası
belgelenmiş ara durum; S13a bu sayede tek başına yeşil.

**`i18n.test.ts` sessizce anlamsızlaşmaktan kurtarıldı.** İlk test
`changeLocale('de')` ile "kataloğu yok, en'e düşmeli" diyordu. S13b `de/`
getirdiğinde assert **yanlış sebeple** geçmeye devam edecekti — kontrol ettiği
`nav:item.pods` her dilde "Pods". `'de'` → **`'xx'`** (hiç var olmayacak id) ve
ikinci bir assert (`common:action.delete`) eklendi.

**Wiring:** `package.json` scripts, `make check-frontend` (typecheck → lint →
**i18n:check** → test), `ci.yml` frontend job'ında Lint'ten sonra yeni adım.
`locales/README.md` denetleyicinin 8 fail + 1 warn sözleşmesini ve CLDR çoğul
tablosunu belgeliyor.

**Denetleyici gerçekten yakalıyor mu — kanıtlandı.** Sekiz kuralın her biri
kasıtlı bozuk fixture'larla tetiklendi (kısmi `de/` dizini, kayıtsız `xx/`,
`ru`'dan silinmiş `action.retry`, uydurma `portForward.bogus`, `en`'in
`_one/_other`'ını kopyalayan `zh`, `_few`/`_many`'si eksik `ru`, `{{count}}`
düşürülmüş `crd.deleteBody_other`, `<1>` → `<2>` yapılmış `ai.ollamaMissing`) —
hepsi fail verdi, fixture'lar silindi.

**Doğrulama**
```
npm run i18n:check   -> ✓ 1/6 locale çevrili, 628 anahtar, 6 ns, 5 warning
npx tsc --noEmit     -> temiz
npx eslint .         -> 0 error, 132 warning (S12b ile aynı; script de lint'leniyor)
npm test             -> 7 dosya / 33 test geçti
npm run build        -> başarılı
GOEXPERIMENT=jsonv2 go build/vet/test -> temiz (Go'ya dokunulmadı)
```
`npm run build` **`frontend/dist/.gitkeep`'i siliyor** (Vite dizini boşaltıyor;
CLAUDE.md'de yazılı). `git checkout -- frontend/dist/.gitkeep` ile geri alındı.

**Bindings regen edilmedi** — exported App metodu / `models` struct'ı değişmedi.

**S13 kapsamı dışında bulunan gerçek hata (S15'e):** `internal/logging` testleri
**flaky** — 6 koşudan 4'ü `TempDir RemoveAll cleanup: directory not empty` ile
düşüyor ve düşen testin adı değişiyor. Sebep `retention.go:37 sweepAsync`: hiçbir
şeyin beklemediği detached goroutine, `t.TempDir()`'in `RemoveAll`'ı ile yarışıp
`.retention`/`.retention.lock`'u dizin silindikten sonra yeniden yaratıyor.
Temiz checkout'ta (`git stash`) da üretildi — S13 ile ilgisi yok, ama `make check`
ve CI'ın `go` job'ı bu yüzden aralıklı kırmızı olacak.

### Uygulandı — S13b sonuç ✅

**30 katalog dosyası** yazıldı; `npm run i18n:check` → **6/6 locale, 629 anahtar,
0 uyarı**. 629 = S12'nin 628'i + yeni `settings:language.mtNote` (altı locale'e
aynı anda eklendi, plandaki gibi).

**Ne çevrilir, ne çevrilmez — plandaki sınır keskinleştirildi.** `GLOSSARY.md`
"Kubernetes özel adları çevrilmez" diyordu ama sınırı çizmiyordu; nav'daki
`Network Policies` / `Persistent Volumes` / `Service Accounts` gibi 12 etiket
tam bu boşluğa düşüyordu. Uygulanan kural, GLOSSARY'ye yeni bir bölüm olarak
yazıldı: **API'nin yazdığı hâliyle CamelCase olan ad (ve çıplak çoğulu) kalır**
(`Pods`, `Endpoints`, `Events`, `ConfigMaps`) — çünkü kullanıcının `kubectl`'e
yazacağı ve Kubernetes dokümanında arayacağı string odur; **boşluklu düzyazı
karşılığı çevrilir** (`Network Policies` → `Ağ Politikaları`), çünkü o, kind'ın
*adı* değil, hakkındaki *cümle*. Aynı kural cümle içinde de geçerli:
`Pod List` → `Pod Listesi`.

Bu keyfi bir tercih değil, ölçülebilir bir eşik meselesiydi: 12 etiketin hepsi
İngilizce bırakılsa `nav.json`'un çevrilebilir değerlerinin **%29'u** `en` ile
birebir aynı kalır ve denetleyici beş locale'in her birinde
"kopyalanmış-ama-çevrilmemiş" uyarısı verirdi — yani uyarı, doğru olduğu için
tetiklenip işe yaramaz hâle gelirdi. Alternatif (glossary'ye `Network Policy`
gibi boşluklu terimleri eklemek) çalışmıyor: denetleyici token bazlı eşleştirdiği
ve `policies` → `policie` tekilleştirmesi tutmadığı için hem yanlış hem de
denetleyiciyi gereksiz yere gevşetiyordu. Sınırı çevirinin kendisinde çizmek,
`identical` oranını **%7'ye** indirdi (`Ingresses`, `Endpoints`, `Events`).

**Rusça'nın `_one`'ı `{{count}}` alamıyor — plan bunu göremezdi.** Denetleyici
kuralı (6): bir anahtarın placeholder kümesi `en`'deki *aynı anahtarla*
eşleşmeli. `crd.deleteBody_one` `en`'de yalnız `{{label}}` taşıyor, `{{count}}`
taşımıyor. Rusça'da `one` kategorisi 1'i olduğu kadar 21, 31, 101'i de kapsar —
yani dilbilgisel olarak orada bir sayı isteniyor, ama koymak denetleyiciyi
kırıyor. `_one` sayısız bir cümleyle yazıldı
("Удалить следующий объект ({{label}})?"), `_few`/`_many`/`_other` sayıyı
taşıyor. `_few` ve `_many` `en`'de hiç yok, dolayısıyla placeholder kuralına
girmiyorlar — kontrol yalnızca `en`'in anahtarları üzerinde dönüyor.

**Denetleyicinin göremediği şey test edildi.** Parite denetleyicisi bir çoğul
formun *var olduğunu* kanıtlar; **doğru formun seçildiğini** yalnız i18next
kanıtlayabilir. `i18n.test.ts`'e dört test eklendi: code-split bir kataloğun
gerçekten yüklenmesi (`de` → "Löschen", ama `nav:item.pods` hâlâ "Pods"),
Rusça'nın dört kategorisi (`1 проброс` / `3 проброса` / `5 пробросов` /
**`21 проброс`** — İngilizce'nin gizlediği tuzak), `_one`'ı olmayan Çince'de
`count:1`'in `_other`'a düşmesi, ve çeviri sonrası interpolasyonun sağlam
kalması. 33 → **37 test**.

**Dürüstlük işareti üç yerde birden.** `locales/README.md`'ye köken tablosu
(`en`=kaynak, `tr`=reviewed, diğer dördü=machine-translated) ve
"machine-translated tam olarak ne demek" paragrafı; TitleBar'ın dil alt
menüsünde ayraçtan sonra `settings:language.mtNote` — tıklanabilir, `.tb-menu-note`
ile küçük/soluk/sarmalanan bir cümle olarak biçimlendirildi.

**Savunmacı ellipsis, `title` olmadan yarım kalıyordu.** de/ru %20-35 daha uzun,
ama kırpma ancak metnin tamamı bir yerden okunabiliyorsa kabul edilebilir. CSS
(`theme-monolith.css`, yeni "LONG-STRING DEFENCE" bölümü) sidebar etiketini,
`ResourceListView` başlığını, buton etiketlerini ve kolon başlıklarını tek satıra
kırpıyor; buna eşlik eden üç `title` attribute'u eklendi: `menu.tsx` sidebar
düğmesi, `ResourceListView`'ın yeni `.rlv-toolbar__title` `h3`'ü ve
`FloatableTab`'ın sekme metni (bu zaten 180px'te kırpıyordu, tooltip'i yoktu).
Kolon başlıkları bilerek sarmalamak yerine kırpılıyor: başlık satırının
yüksekliği `ktable-fill`'in gövdeyi boyutlandırmak için ölçtüğü şey, ve kolonlar
zaten yeniden boyutlandırılabilir.

**Doğrulama**
```
npm run i18n:check   -> ✓ 6/6 locale, 629 anahtar, 6 ns, 0 warning
npx tsc --noEmit     -> temiz
npx eslint .         -> 0 error, 132 warning (S13a ile aynı)
npm test             -> 7 dosya / 37 test geçti
npm run build        -> başarılı; her ns için 5 ayrı chunk (code-split çalışıyor)
GOEXPERIMENT=jsonv2 go build/vet -> temiz (Go'ya dokunulmadı)
```
`npm run build` yine `frontend/dist/.gitkeep`'i sildi; geri alındı.

**Yapılmayan iki şey (bilerek):**
1. **de/ru'da elle UI-fit turu atılmadı** — bu oturum başsız çalışıyor, GUI
   açılamadı. CSS savunması yerinde ama *hangi* butonun taştığı gözle
   doğrulanmadı; `make dev` ile `de` ve `ru`'da Pods / Monitoring / CRD
   panelleri ve delete dialog'u bir kez gezilmeli.
2. **`settings:language.mtNote`'un linki henüz 404.**
   `docs/contributing/translations.md` yok (`docs/` altında `contributing/`
   dizini hiç yok). Plan bunu zaten **S16 borcu** olarak kaydetmişti; S16'ya
   kadar link boş sayfaya gidiyor.

S16 borcu (değişmedi): `docs/contributing/translations.md` sayfası +
Known Limitations'a "`{{label}}`/`{{kind}}` İngilizce kind ismi enterpole
ediyor" maddesi.

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
