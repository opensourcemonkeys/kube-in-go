package services_k8sclient

import (
	"context"
	"fmt"
	"net"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"

	"kube-ins/internal/models"
)

// Everything in this file answers "which pod, and which port on it?" — the two
// questions that stand between a user's click and a tunnel. It is kept apart
// from the session machinery in portForwardServices.go because it is the part
// that is worth unit-testing: pure enough to run without a cluster once the API
// objects are in hand.

// Kinds a port forward can be started from. Only Pod can actually be forwarded
// to; the rest are resolved to one.
const (
	pfKindPod         = "pod"
	pfKindDeployment  = "deployment"
	pfKindStatefulSet = "statefulset"
	pfKindReplicaSet  = "replicaset"
	pfKindDaemonSet   = "daemonset"
	pfKindService     = "service"
)

// forwardTarget is a resolved (pod, port-on-that-pod) pair.
type forwardTarget struct {
	podName    string
	targetPort int
}

// resolveForwardTarget turns whatever the user selected into a concrete pod and
// the port to open on it. It runs again on every reconnect, which is how a
// tunnel to a Deployment survives a rolling restart: the second call simply
// picks whichever pod is ready now.
func resolveForwardTarget(ctx context.Context, kind, namespace, name string, remotePort int, client *kubernetes.Clientset) (forwardTarget, error) {
	switch strings.ToLower(kind) {
	case pfKindPod:
		return forwardTarget{podName: name, targetPort: remotePort}, nil

	case pfKindDeployment, pfKindStatefulSet, pfKindReplicaSet, pfKindDaemonSet:
		selector, _, err := workloadPodTemplate(ctx, kind, namespace, name, client)
		if err != nil {
			return forwardTarget{}, err
		}
		pod, err := pickReadyPod(ctx, namespace, selector, client)
		if err != nil {
			return forwardTarget{}, err
		}
		return forwardTarget{podName: pod.Name, targetPort: remotePort}, nil

	case pfKindService:
		svc, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return forwardTarget{}, err
		}
		if len(svc.Spec.Selector) == 0 {
			return forwardTarget{}, fmt.Errorf("service %s/%s has no selector, so it has no pods to forward to", namespace, name)
		}
		sp, err := servicePortByNumber(svc, remotePort)
		if err != nil {
			return forwardTarget{}, err
		}
		pod, err := pickReadyPod(ctx, namespace, svc.Spec.Selector, client)
		if err != nil {
			return forwardTarget{}, err
		}
		target, err := resolveServiceTargetPort(sp, pod)
		if err != nil {
			return forwardTarget{}, err
		}
		return forwardTarget{podName: pod.Name, targetPort: target}, nil
	}
	return forwardTarget{}, fmt.Errorf("port forwarding is not supported for %s", kind)
}

func servicePortByNumber(svc *corev1.Service, port int) (*corev1.ServicePort, error) {
	for i := range svc.Spec.Ports {
		if int(svc.Spec.Ports[i].Port) == port {
			return &svc.Spec.Ports[i], nil
		}
	}
	return nil, fmt.Errorf("service %s/%s has no port %d", svc.Namespace, svc.Name, port)
}

// resolveServiceTargetPort maps a service port onto the port actually open on
// the pod. A named targetPort is the case that matters: it only has meaning
// relative to a specific pod's container ports, which is why this takes the pod
// rather than resolving from the Service alone.
func resolveServiceTargetPort(sp *corev1.ServicePort, pod *corev1.Pod) (int, error) {
	switch sp.TargetPort.Type {
	case intstr.Int:
		if sp.TargetPort.IntValue() == 0 {
			// An unset targetPort defaults to the service port.
			return int(sp.Port), nil
		}
		return sp.TargetPort.IntValue(), nil
	case intstr.String:
		wanted := sp.TargetPort.StrVal
		for _, c := range pod.Spec.Containers {
			for _, p := range c.Ports {
				if p.Name == wanted {
					return int(p.ContainerPort), nil
				}
			}
		}
		return 0, fmt.Errorf("pod %s has no container port named %q (targetPort of service port %d)", pod.Name, wanted, sp.Port)
	}
	return 0, fmt.Errorf("service port %d has an unrecognised targetPort", sp.Port)
}

// pickReadyPod returns the first pod matching selector that is Running with
// every container ready. Anything less would produce a tunnel that connects and
// then refuses every request, which reads as "the app is broken".
func pickReadyPod(ctx context.Context, namespace string, selector map[string]string, client *kubernetes.Clientset) (*corev1.Pod, error) {
	pods, err := client.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: labelSelectorString(selector),
	})
	if err != nil {
		return nil, err
	}
	if len(pods.Items) == 0 {
		return nil, fmt.Errorf("no pods match the selector in namespace %s", namespace)
	}
	for i := range pods.Items {
		if podIsReady(&pods.Items[i]) {
			return &pods.Items[i], nil
		}
	}
	return nil, fmt.Errorf("none of the %d matching pods in namespace %s is running and ready", len(pods.Items), namespace)
}

func podIsReady(pod *corev1.Pod) bool {
	if pod.Status.Phase != corev1.PodRunning || pod.DeletionTimestamp != nil {
		return false
	}
	if len(pod.Status.ContainerStatuses) == 0 {
		return false
	}
	for _, cs := range pod.Status.ContainerStatuses {
		if !cs.Ready {
			return false
		}
	}
	return true
}

// workloadPodTemplate returns a workload's selector and pod template. Both are
// needed: the selector finds a live pod, the template lists the ports to offer
// even when no pod is running yet.
func workloadPodTemplate(ctx context.Context, kind, namespace, name string, client *kubernetes.Clientset) (map[string]string, *corev1.PodSpec, error) {
	switch strings.ToLower(kind) {
	case pfKindDeployment:
		o, err := client.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, nil, err
		}
		return selectorLabels(o.Spec.Selector), &o.Spec.Template.Spec, nil
	case pfKindStatefulSet:
		o, err := client.AppsV1().StatefulSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, nil, err
		}
		return selectorLabels(o.Spec.Selector), &o.Spec.Template.Spec, nil
	case pfKindReplicaSet:
		o, err := client.AppsV1().ReplicaSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, nil, err
		}
		return selectorLabels(o.Spec.Selector), &o.Spec.Template.Spec, nil
	case pfKindDaemonSet:
		o, err := client.AppsV1().DaemonSets(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, nil, err
		}
		return selectorLabels(o.Spec.Selector), &o.Spec.Template.Spec, nil
	}
	return nil, nil, fmt.Errorf("port forwarding is not supported for %s", kind)
}

func selectorLabels(s *metav1.LabelSelector) map[string]string {
	if s == nil {
		return nil
	}
	return s.MatchLabels
}

// ResolveForwardablePorts lists the ports the dialog offers for a target. This
// is the difference between "type the port from memory" and "pick it from a
// list", and it is why the feature does not send people back to kubectl to look
// a port up.
func ResolveForwardablePorts(kind, namespace, name string, client *kubernetes.Clientset) ([]models.PortOption, error) {
	if namespace == "" || name == "" {
		return nil, errNamespaceNameRequired
	}
	ctx := context.Background()
	switch strings.ToLower(kind) {
	case pfKindPod:
		pod, err := client.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		return containerPortOptions(&pod.Spec), nil

	case pfKindDeployment, pfKindStatefulSet, pfKindReplicaSet, pfKindDaemonSet:
		_, spec, err := workloadPodTemplate(ctx, kind, namespace, name, client)
		if err != nil {
			return nil, err
		}
		return containerPortOptions(spec), nil

	case pfKindService:
		svc, err := client.CoreV1().Services(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			return nil, err
		}
		opts := make([]models.PortOption, 0, len(svc.Spec.Ports))
		for _, p := range svc.Spec.Ports {
			opts = append(opts, models.PortOption{
				Name:     p.Name,
				Port:     int(p.Port),
				Protocol: protocolOrTCP(p.Protocol),
				Hint:     portHint(p.Name, int(p.Port)),
			})
		}
		return opts, nil
	}
	return nil, fmt.Errorf("port forwarding is not supported for %s", kind)
}

func containerPortOptions(spec *corev1.PodSpec) []models.PortOption {
	var opts []models.PortOption
	for _, c := range spec.Containers {
		for _, p := range c.Ports {
			opts = append(opts, models.PortOption{
				Name:          p.Name,
				Port:          int(p.ContainerPort),
				Protocol:      protocolOrTCP(p.Protocol),
				ContainerName: c.Name,
				Hint:          portHint(p.Name, int(p.ContainerPort)),
			})
		}
	}
	return opts
}

func protocolOrTCP(p corev1.Protocol) string {
	if p == "" {
		return string(corev1.ProtocolTCP)
	}
	return string(p)
}

// portHint guesses whether a forwarded port is worth opening in a browser. It
// is only a hint: guessing wrong costs a hidden button, never a broken tunnel.
func portHint(name string, port int) string {
	n := strings.ToLower(name)
	switch {
	case n == "https" || strings.HasSuffix(n, "-https") || port == 443 || port == 8443:
		return "https"
	case strings.Contains(n, "http") || n == "web" || n == "ui" || n == "metrics":
		return "http"
	}
	switch port {
	case 80, 3000, 5000, 8000, 8080, 8081, 9090, 9100:
		return "http"
	}
	return ""
}

// SuggestLocalPort picks a local port that is free right now, preferring the
// remote port so the address the user ends up with reads the way they expect
// (127.0.0.1:8080 for a service on 8080). Returning 0 hands the choice to the
// kernel.
func SuggestLocalPort(preferred int) int {
	if preferred <= 0 || preferred > 65535 {
		return 0
	}
	for p := preferred; p < preferred+50 && p <= 65535; p++ {
		if localPortFree(p) {
			return p
		}
	}
	return 0
}

// localPortFree reports whether 127.0.0.1:port can be bound. There is an
// unavoidable race between this check and the forwarder's own bind; it exists
// so the common case fails with "local port 8080 is already in use" instead of
// a stream-setup error nobody can act on.
func localPortFree(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}
