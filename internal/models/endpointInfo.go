package models

type EndpointAddressInfo struct {
	IP       string `json:"ip"`
	NodeName string `json:"node_name"`
}

type EndpointPortInfo struct {
	Name     string `json:"name"`
	Port     int32  `json:"port"`
	Protocol string `json:"protocol"`
}

type EndpointSubsetInfo struct {
	Addresses         []EndpointAddressInfo `json:"addresses"`
	NotReadyAddresses []EndpointAddressInfo `json:"not_ready_addresses"`
	Ports             []EndpointPortInfo    `json:"ports"`
}

type EndpointInfo struct {
	Name      string               `json:"name"`
	Namespace string               `json:"namespace"`
	Subsets   []EndpointSubsetInfo `json:"subsets"`
	Ready     int                  `json:"ready"`
	NotReady  int                  `json:"not_ready"`
	CreatedAt string               `json:"created_at"`
}
