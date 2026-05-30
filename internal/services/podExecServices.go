package services_k8sclient

import (
	"context"
	"fmt"
	"io"
	"sync"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
)

type podExecSession struct {
	stdinWriter *io.PipeWriter
	sizeQueue   *execSizeQueue
	cancel      context.CancelFunc
}

type execSizeQueue struct {
	ch chan remotecommand.TerminalSize
}

func (q *execSizeQueue) Next() *remotecommand.TerminalSize {
	size, ok := <-q.ch
	if !ok {
		return nil
	}
	return &size
}

var (
	execMu       sync.Mutex
	execSessions = make(map[string]*podExecSession)
)

func CreatePodExecSession(id, namespace, podName, container string, onOutput func(string), client *kubernetes.Clientset, config *rest.Config) error {
	execMu.Lock()
	if existing, ok := execSessions[id]; ok {
		delete(execSessions, id)
		existing.cancel()
		_ = existing.stdinWriter.Close()
		close(existing.sizeQueue.ch)
	}
	execMu.Unlock()

	if container == "" {
		pod, err := client.CoreV1().Pods(namespace).Get(context.TODO(), podName, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("could not get pod: %w", err)
		}
		if len(pod.Spec.Containers) > 0 {
			container = pod.Spec.Containers[0].Name
		}
	}

	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Container: container,
		Command:   []string{"/bin/sh"},
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(config, "POST", req.URL())
	if err != nil {
		return fmt.Errorf("failed to create executor: %w", err)
	}

	stdinReader, stdinWriter := io.Pipe()
	stdoutReader, stdoutWriter := io.Pipe()

	sq := &execSizeQueue{ch: make(chan remotecommand.TerminalSize, 4)}
	ctx, cancel := context.WithCancel(context.Background())

	execMu.Lock()
	execSessions[id] = &podExecSession{
		stdinWriter: stdinWriter,
		sizeQueue:   sq,
		cancel:      cancel,
	}
	execMu.Unlock()

	go func() {
		defer stdoutWriter.Close()
		_ = executor.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:             stdinReader,
			Stdout:            stdoutWriter,
			Stderr:            stdoutWriter,
			Tty:               true,
			TerminalSizeQueue: sq,
		})
	}()

	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := stdoutReader.Read(buf)
			if n > 0 {
				onOutput(string(buf[:n]))
			}
			if err != nil {
				break
			}
		}
	}()

	return nil
}

func WriteToPodExecSession(id, data string) error {
	execMu.Lock()
	session, ok := execSessions[id]
	execMu.Unlock()
	if !ok {
		return fmt.Errorf("exec session %s not found", id)
	}
	_, err := io.WriteString(session.stdinWriter, data)
	return err
}

func ResizePodExecSession(id string, cols, rows uint16) error {
	execMu.Lock()
	session, ok := execSessions[id]
	execMu.Unlock()
	if !ok {
		return fmt.Errorf("exec session %s not found", id)
	}
	select {
	case session.sizeQueue.ch <- remotecommand.TerminalSize{Width: cols, Height: rows}:
	default:
	}
	return nil
}

func ClosePodExecSession(id string) error {
	execMu.Lock()
	session, ok := execSessions[id]
	if ok {
		delete(execSessions, id)
	}
	execMu.Unlock()
	if !ok {
		return nil
	}
	session.cancel()
	_ = session.stdinWriter.Close()
	close(session.sizeQueue.ch)
	return nil
}
