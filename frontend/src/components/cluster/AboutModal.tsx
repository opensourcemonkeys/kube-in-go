import { useEffect, useState } from 'react';
import { VscCloud } from 'react-icons/vsc';
import { Dialog } from 'primereact/dialog';
import { GetAppInfo } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';

interface Props {
    visible: boolean;
    onHide: () => void;
}

const DEP_LABELS: Record<string, string> = {
    'github.com/wailsapp/wails/v2': 'Wails',
    'k8s.io/client-go': 'client-go',
    'k8s.io/api': 'k8s API',
    'k8s.io/apimachinery': 'k8s Apimachinery',
    'github.com/creack/pty': 'PTY',
    'sigs.k8s.io/yaml': 'YAML',
};

export default function AboutModal({ visible, onHide }: Props) {
    const [info, setInfo] = useState<models.AppInfo | null>(null);

    useEffect(() => {
        if (visible && !info) {
            GetAppInfo().then(setInfo);
        }
    }, [visible]);

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header={null}
            closable={false}
            modal
            className="about-modal"
            style={{ width: '440px' }}
        >
            <div className="about-modal__content">
                <div className="about-modal__logo">
                    <VscCloud className="about-modal__logo-icon" />
                </div>
                <h2 className="about-modal__title">Kube Inspector</h2>
                {info && (
                    <div className="about-modal__version">{info.app_version}</div>
                )}
                <p className="about-modal__desc">
                    A desktop application for managing Kubernetes clusters with a visual interface.
                    Built with Go, Wails and React.
                </p>

                <div className="about-modal__meta">
                    <div className="about-modal__meta-row">
                        <span className="about-modal__meta-label">Author</span>
                        <span className="about-modal__meta-value">Hakan Yorulmaz</span>
                    </div>
                    {info && (
                        <div className="about-modal__meta-row">
                            <span className="about-modal__meta-label">Go</span>
                            <span className="about-modal__meta-value">{info.go_version}</span>
                        </div>
                    )}
                </div>

                {(info?.dependencies?.length ?? 0) > 0 && (
                    <>
                        <div className="about-modal__section-title">Dependencies</div>
                        <div className="about-modal__meta">
                            {info!.dependencies.map(dep => (
                                <div key={dep.name} className="about-modal__meta-row">
                                    <span className="about-modal__meta-label">
                                        {DEP_LABELS[dep.name] ?? dep.name.split('/').pop()}
                                    </span>
                                    <span className="about-modal__meta-value">{dep.version}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <button className="about-modal__close-btn" onClick={onHide}>
                    Close
                </button>
            </div>
        </Dialog>
    );
}
