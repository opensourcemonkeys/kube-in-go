import { useEffect, useState } from 'react';
import { VscCloud } from 'react-icons/vsc';
import { Dialog } from 'primereact/dialog';
import { GetAppInfo } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { useT } from '../../i18n/useT';

interface Props {
    visible: boolean;
    onHide: () => void;
    /** Opens the Diagnostics panel. Omitted, the button is not rendered. */
    onDiagnostics?: () => void;
}

const DEP_LABELS: Record<string, string> = {
    'github.com/wailsapp/wails/v2': 'Wails',
    'k8s.io/client-go': 'client-go',
    'k8s.io/api': 'k8s API',
    'k8s.io/apimachinery': 'k8s Apimachinery',
    'github.com/creack/pty': 'PTY',
    'sigs.k8s.io/yaml': 'YAML',
};

export default function AboutModal({ visible, onHide, onDiagnostics }: Props) {
    const t = useT();
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
                <p className="about-modal__desc">{t('panels:about.description')}</p>

                <div className="about-modal__meta">
                    <div className="about-modal__meta-row">
                        <span className="about-modal__meta-label">{t('panels:about.author')}</span>
                        {/* eslint-disable-next-line i18next/no-literal-string -- a person's name */}
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
                        <div className="about-modal__section-title">{t('panels:about.dependencies')}</div>
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

                <div className="about-modal__actions">
                    {onDiagnostics && (
                        <button
                            className="about-modal__close-btn about-modal__close-btn--ghost"
                            onClick={() => { onHide(); onDiagnostics(); }}
                        >
                            {t('panels:about.diagnostics')}
                        </button>
                    )}
                    <button className="about-modal__close-btn" onClick={onHide}>
                        {t('panels:about.close')}
                    </button>
                </div>
            </div>
        </Dialog>
    );
}
