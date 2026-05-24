package models

type ResourceQuotaEntry struct {
	Resource string `json:"resource"`
	Hard     string `json:"hard"`
	Used     string `json:"used"`
	HardNum  int64  `json:"hard_num"`
	UsedNum  int64  `json:"used_num"`
}

type ResourceQuotaInfo struct {
	Name    string               `json:"name"`
	Entries []ResourceQuotaEntry `json:"entries"`
}

type NamespaceInfo struct {
	Name           string              `json:"name"`
	Status         string              `json:"status"`
	ResourceQuotas []ResourceQuotaInfo `json:"resource_quotas"`
}
