package controller_app

import (
	bussiness "kube-ins/internal/business"
	"kube-ins/internal/models"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ============================================================================
// App & System Functions
// ============================================================================

func (a *App) GetAppInfo() models.AppInfo {
	return bussiness.GetAppInfo()
}

func (a *App) GetK8sSchema() string {
	return bussiness.GetK8sSchema()
}

// ============================================================================
// Cluster Screen: Nodes & Namespaces
// ============================================================================

func (a *App) GetNodes() []models.NodeInfo {
	return bussiness.GetNodes()
}

func (a *App) GetNamespaces() []models.NamespaceInfo {
	return bussiness.GetNamespaces()
}

func (a *App) DeleteNamespace(name string) error {
	return bussiness.DeleteNamespace(name)
}

func (a *App) GetNamespaceYaml(name string) (string, error) {
	return bussiness.GetNamespaceYaml(name)
}

func (a *App) GetResourceQuotaYaml(name string, namespace string) (string, error) {
	return bussiness.GetResourceQuotaYaml(name, namespace)
}

func (a *App) UpdateResourceQuotaYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateResourceQuotaYaml(name, namespace, yamlContent)
}

func (a *App) CordonNode(name string) error {
	return bussiness.CordonNode(name)
}

func (a *App) UncordonNode(name string) error {
	return bussiness.UncordonNode(name)
}

func (a *App) DrainNode(name string) error {
	return bussiness.DrainNode(name)
}

func (a *App) GetNodeYaml(name string) (string, error) {
	return bussiness.GetNodeYaml(name)
}

func (a *App) UpdateNodeYaml(name string, yamlContent string) error {
	return bussiness.UpdateNodeYaml(name, yamlContent)
}

// ============================================================================
// Workloads Screen: Pods
// ============================================================================

func (a *App) GetPods() []models.PodInfo {
	return bussiness.GetPods()
}

func (a *App) DeletePod(name string, namespace string) error {
	return bussiness.DeletePod(name, namespace)
}

func (a *App) GetPodYaml(name string, namespace string) (string, error) {
	return bussiness.GetPodYaml(name, namespace)
}

func (a *App) CreatePodExecSession(sessionId string, namespace string, podName string, container string) error {
	return bussiness.CreatePodExecSession(sessionId, namespace, podName, container, func(data string) {
		runtime.EventsEmit(a.ctx, "exec:output:"+sessionId, data)
	})
}

func (a *App) WriteToPodExecSession(sessionId string, data string) error {
	return bussiness.WriteToPodExecSession(sessionId, data)
}

func (a *App) ResizePodExecSession(sessionId string, cols int, rows int) error {
	return bussiness.ResizePodExecSession(sessionId, cols, rows)
}

func (a *App) ClosePodExecSession(sessionId string) error {
	return bussiness.ClosePodExecSession(sessionId)
}

// ============================================================================
// Workloads Screen: Deployments
// ============================================================================

func (a *App) GetDeployments() []models.DeploymentInfo {
	return bussiness.GetDeployments()
}

func (a *App) DeleteDeployment(name string, namespace string) error {
	return bussiness.DeleteDeployment(name, namespace)
}

func (a *App) GetDeploymentYaml(name string, namespace string) (string, error) {
	return bussiness.GetDeploymentYaml(name, namespace)
}

func (a *App) UpdateDeploymentYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateDeploymentYaml(name, namespace, yamlContent)
}

// ============================================================================
// Workloads Screen: StatefulSets
// ============================================================================

func (a *App) GetStatefulSets() []models.StatefulSetInfo {
	return bussiness.GetStatefulSets()
}

func (a *App) DeleteStatefulSet(name string, namespace string) error {
	return bussiness.DeleteStatefulSet(name, namespace)
}

func (a *App) GetStatefulSetYaml(name string, namespace string) (string, error) {
	return bussiness.GetStatefulSetYaml(name, namespace)
}

func (a *App) UpdateStatefulSetYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateStatefulSetYaml(name, namespace, yamlContent)
}

// ============================================================================
// Workloads Screen: ReplicaSets
// ============================================================================

func (a *App) GetReplicaSets() []models.ReplicaSetInfo {
	return bussiness.GetReplicaSets()
}

func (a *App) DeleteReplicaSet(name string, namespace string) error {
	return bussiness.DeleteReplicaSet(name, namespace)
}

func (a *App) GetReplicaSetYaml(name string, namespace string) (string, error) {
	return bussiness.GetReplicaSetYaml(name, namespace)
}

func (a *App) UpdateReplicaSetYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateReplicaSetYaml(name, namespace, yamlContent)
}

// ============================================================================
// Workloads Screen: DaemonSets
// ============================================================================

func (a *App) GetDaemonSets() []models.DaemonSetInfo {
	return bussiness.GetDaemonSets()
}

func (a *App) DeleteDaemonSet(name string, namespace string) error {
	return bussiness.DeleteDaemonSet(name, namespace)
}

func (a *App) GetDaemonSetYaml(name string, namespace string) (string, error) {
	return bussiness.GetDaemonSetYaml(name, namespace)
}

func (a *App) UpdateDaemonSetYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateDaemonSetYaml(name, namespace, yamlContent)
}

// ============================================================================
// Workloads Screen: Jobs & CronJobs
// ============================================================================

func (a *App) GetJobs() []models.JobInfo {
	return bussiness.GetJobs()
}

func (a *App) DeleteJob(name string, namespace string) error {
	return bussiness.DeleteJob(name, namespace)
}

func (a *App) GetJobYaml(name string, namespace string) (string, error) {
	return bussiness.GetJobYaml(name, namespace)
}

func (a *App) GetCronJobs() []models.CronJobInfo {
	return bussiness.GetCronJobs()
}

func (a *App) DeleteCronJob(name string, namespace string) error {
	return bussiness.DeleteCronJob(name, namespace)
}

func (a *App) GetCronJobYaml(name string, namespace string) (string, error) {
	return bussiness.GetCronJobYaml(name, namespace)
}

func (a *App) UpdateCronJobYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateCronJobYaml(name, namespace, yamlContent)
}

// ============================================================================
// Configuration Screen: Secrets
// ============================================================================

func (a *App) GetSecrets() []models.SecretInfo {
	return bussiness.GetSecrets()
}

func (a *App) DeleteSecret(name string, namespace string) error {
	return bussiness.DeleteSecret(name, namespace)
}

func (a *App) GetSecretYaml(name string, namespace string) (string, error) {
	return bussiness.GetSecretYaml(name, namespace)
}

func (a *App) UpdateSecretYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateSecretYaml(name, namespace, yamlContent)
}

func (a *App) GetSecretData(name string, namespace string) (map[string]string, error) {
	return bussiness.GetSecretData(name, namespace)
}

func (a *App) UpdateSecretData(name string, namespace string, data map[string]string) error {
	return bussiness.UpdateSecretData(name, namespace, data)
}

// ============================================================================
// Configuration Screen: ConfigMaps
// ============================================================================

func (a *App) GetConfigMaps() []models.ConfigMapInfo {
	return bussiness.GetConfigMaps()
}

func (a *App) DeleteConfigMap(name string, namespace string) error {
	return bussiness.DeleteConfigMap(name, namespace)
}

func (a *App) GetConfigMapYaml(name string, namespace string) (string, error) {
	return bussiness.GetConfigMapYaml(name, namespace)
}

func (a *App) UpdateConfigMapYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateConfigMapYaml(name, namespace, yamlContent)
}

func (a *App) GetConfigMapData(name string, namespace string) (map[string]string, error) {
	return bussiness.GetConfigMapData(name, namespace)
}

func (a *App) UpdateConfigMapData(name string, namespace string, data map[string]string) error {
	return bussiness.UpdateConfigMapData(name, namespace, data)
}

// ============================================================================
// Access Control: ServiceAccounts, Roles, RoleBindings
// ============================================================================

func (a *App) GetServiceAccounts() []models.ServiceAccountInfo {
	return bussiness.GetServiceAccounts()
}

func (a *App) GetServiceAccountYaml(name string, namespace string) (string, error) {
	return bussiness.GetServiceAccountYaml(name, namespace)
}

func (a *App) UpdateServiceAccountYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateServiceAccountYaml(name, namespace, yamlContent)
}

func (a *App) UpdateServiceAccount(name string, namespace string, labels map[string]string, annotations map[string]string) error {
	return bussiness.UpdateServiceAccount(name, namespace, labels, annotations)
}

func (a *App) GetRoles() []models.RoleInfo {
	return bussiness.GetRoles()
}

func (a *App) GetRoleYaml(name string, namespace string) (string, error) {
	return bussiness.GetRoleYaml(name, namespace)
}

func (a *App) UpdateRoleYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateRoleYaml(name, namespace, yamlContent)
}

func (a *App) UpdateRole(name string, namespace string, labels map[string]string, annotations map[string]string, rules []models.PolicyRuleInfo) error {
	return bussiness.UpdateRole(name, namespace, labels, annotations, rules)
}

func (a *App) GetRoleBindings() []models.RoleBindingInfo {
	return bussiness.GetRoleBindings()
}

func (a *App) GetRoleBindingYaml(name string, namespace string) (string, error) {
	return bussiness.GetRoleBindingYaml(name, namespace)
}

func (a *App) UpdateRoleBindingYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateRoleBindingYaml(name, namespace, yamlContent)
}

func (a *App) UpdateRoleBinding(name string, namespace string, labels map[string]string, annotations map[string]string, subjects []models.SubjectInfo) error {
	return bussiness.UpdateRoleBinding(name, namespace, labels, annotations, subjects)
}

// ============================================================================
// Terminal Screen
// ============================================================================

func (a *App) CreateTerminalSession(id string) error {
	return bussiness.CreateTerminalSession(id, func(data string) {
		runtime.EventsEmit(a.ctx, "terminal:output:"+id, data)
	})
}

func (a *App) WriteToTerminalSession(id string, data string) error {
	return bussiness.WriteToTerminalSession(id, data)
}

func (a *App) ResizeTerminalSession(id string, cols int, rows int) error {
	return bussiness.ResizeTerminalSession(id, cols, rows)
}

func (a *App) CloseTerminalSession(id string) error {
	return bussiness.CloseTerminalSession(id)
}

// ============================================================================
// Network Screen: Network Policies
// ============================================================================

func (a *App) GetNetworkPolicies() []models.NetworkPolicyInfo {
	return bussiness.GetNetworkPolicies()
}

func (a *App) DeleteNetworkPolicy(name string, namespace string) error {
	return bussiness.DeleteNetworkPolicy(name, namespace)
}

func (a *App) GetNetworkPolicyYaml(name string, namespace string) (string, error) {
	return bussiness.GetNetworkPolicyYaml(name, namespace)
}

func (a *App) UpdateNetworkPolicyYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateNetworkPolicyYaml(name, namespace, yamlContent)
}

func (a *App) GetNetworkPolicyDetail(name string, namespace string) (*models.NetworkPolicyDetail, error) {
	return bussiness.GetNetworkPolicyDetail(name, namespace)
}

func (a *App) ParseNetworkPolicyYaml(yamlContent string) (*models.NetworkPolicyDetail, error) {
	return bussiness.ParseNetworkPolicyYaml(yamlContent)
}

// ============================================================================
// Network Screen: Services
// ============================================================================

func (a *App) GetServices() []models.ServiceInfo {
	return bussiness.GetServices()
}

func (a *App) DeleteService(name string, namespace string) error {
	return bussiness.DeleteService(name, namespace)
}

func (a *App) GetServiceYaml(name string, namespace string) (string, error) {
	return bussiness.GetServiceYaml(name, namespace)
}

func (a *App) UpdateServiceYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateServiceYaml(name, namespace, yamlContent)
}

// ============================================================================
// Cluster Screen: LimitRanges
// ============================================================================

func (a *App) GetLimitRanges() []models.LimitRangeInfo {
	return bussiness.GetLimitRanges()
}

func (a *App) GetLimitRangeYaml(name string, namespace string) (string, error) {
	return bussiness.GetLimitRangeYaml(name, namespace)
}

func (a *App) UpdateLimitRangeYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateLimitRangeYaml(name, namespace, yamlContent)
}

// ============================================================================
// Cluster Screen: Events
// ============================================================================

func (a *App) GetEvents() []models.EventInfo {
	return bussiness.GetEvents()
}

// ============================================================================
// Network Screen: Ingresses
// ============================================================================

func (a *App) GetIngresses() []models.IngressInfo {
	return bussiness.GetIngresses()
}

func (a *App) DeleteIngress(name string, namespace string) error {
	return bussiness.DeleteIngress(name, namespace)
}

func (a *App) GetIngressYaml(name string, namespace string) (string, error) {
	return bussiness.GetIngressYaml(name, namespace)
}

func (a *App) UpdateIngressYaml(name string, namespace string, yamlContent string) error {
	return bussiness.UpdateIngressYaml(name, namespace, yamlContent)
}

// ============================================================================
// Network Screen: IngressClasses
// ============================================================================

func (a *App) GetIngressClasses() []models.IngressClassInfo {
	return bussiness.GetIngressClasses()
}

func (a *App) GetIngressClassYaml(name string) (string, error) {
	return bussiness.GetIngressClassYaml(name)
}

// ============================================================================
// Network Screen: Endpoints
// ============================================================================

func (a *App) GetEndpoints() []models.EndpointInfo {
	return bussiness.GetEndpoints()
}

func (a *App) GetEndpointYaml(name string, namespace string) (string, error) {
	return bussiness.GetEndpointYaml(name, namespace)
}

// ============================================================================
// Storage Screen: Persistent Volumes
// ============================================================================

func (a *App) GetPersistentVolumes() []models.PersistentVolumeInfo {
	return bussiness.GetPersistentVolumes()
}

func (a *App) GetPersistentVolumeYaml(name string) (string, error) {
	return bussiness.GetPersistentVolumeYaml(name)
}

// ============================================================================
// Storage Screen: Persistent Volume Claims
// ============================================================================

func (a *App) GetPersistentVolumeClaims() []models.PersistentVolumeClaimInfo {
	return bussiness.GetPersistentVolumeClaims()
}

func (a *App) DeletePersistentVolumeClaim(name string, namespace string) error {
	return bussiness.DeletePersistentVolumeClaim(name, namespace)
}

func (a *App) GetPersistentVolumeClaimYaml(name string, namespace string) (string, error) {
	return bussiness.GetPersistentVolumeClaimYaml(name, namespace)
}

// ============================================================================
// Storage Screen: Storage Classes
// ============================================================================

func (a *App) GetStorageClasses() []models.StorageClassInfo {
	return bussiness.GetStorageClasses()
}

func (a *App) GetStorageClassYaml(name string) (string, error) {
	return bussiness.GetStorageClassYaml(name)
}

// ============================================================================
// YAML Editor Screen
// ============================================================================

func (a *App) ApplyYaml(yamlContent string) (string, error) {
	return bussiness.ApplyYaml(yamlContent)
}

// ============================================================================
// Cluster Management
// ============================================================================

func (a *App) ListClusters() ([]string, error) {
	return bussiness.ListClusters()
}

func (a *App) SaveCluster(name string, content string) error {
	return bussiness.SaveCluster(name, content)
}

func (a *App) GetClusterContent(name string) (string, error) {
	return bussiness.GetClusterContent(name)
}

func (a *App) DeleteCluster(name string) error {
	return bussiness.DeleteCluster(name)
}

func (a *App) SetActiveCluster(name string) error {
	return bussiness.SetActiveCluster(name)
}

func (a *App) GetActiveCluster() string {
	return bussiness.GetActiveCluster()
}

func (a *App) CheckClusterConnection() error {
	return bussiness.CheckClusterConnection()
}

func (a *App) GetClusterGraph() (*models.ClusterGraph, error) {
	return bussiness.GetClusterGraph()
}

// ============================================================================
// Utility Functions: Resource Relationships & Navigation
// ============================================================================

func (a *App) GetPodContainers(name string, namespace string) ([]string, error) {
	return bussiness.GetPodContainers(name, namespace)
}

func (a *App) GetDeploymentPods(name string, namespace string) ([]string, error) {
	return bussiness.GetDeploymentPods(name, namespace)
}

func (a *App) GetStatefulSetPods(name string, namespace string) ([]string, error) {
	return bussiness.GetStatefulSetPods(name, namespace)
}

func (a *App) GetReplicaSetPods(name string, namespace string) ([]string, error) {
	return bussiness.GetReplicaSetPods(name, namespace)
}

func (a *App) GetDaemonSetPods(name string, namespace string) ([]string, error) {
	return bussiness.GetDaemonSetPods(name, namespace)
}

func (a *App) GetJobPods(name string, namespace string) ([]string, error) {
	return bussiness.GetJobPods(name, namespace)
}

func (a *App) GetCronJobPods(name string, namespace string) ([]string, error) {
	return bussiness.GetCronJobPods(name, namespace)
}

// ============================================================================
// Logs Screen
// ============================================================================

func (a *App) StartLogStream(sessionId string, podName string, namespace string, container string) error {
	return bussiness.StartLogStream(sessionId, podName, namespace, container, func(data string) {
		runtime.EventsEmit(a.ctx, "log:output:"+sessionId, data)
	})
}

func (a *App) StopLogStream(sessionId string) {
	bussiness.StopLogStream(sessionId)
}
