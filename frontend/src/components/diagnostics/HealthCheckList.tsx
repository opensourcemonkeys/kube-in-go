import { models } from '../../../wailsjs/go/models';
import { useT } from '../../i18n/useT';

const STATUS_LABEL: Record<string, string> = {
    ok: 'OK',
    warn: 'WARN',
    fail: 'FAIL',
    skip: 'SKIP',
};

/**
 * Renders the preflight rows in the order the backend returned them. That order
 * is fixed on the Go side precisely so rows do not reshuffle between runs — a
 * list that reorders itself is unreadable when half of it is still resolving.
 */
export default function HealthCheckList({
    checks,
    running,
}: {
    checks: models.HealthCheck[];
    running: boolean;
}) {
    const t = useT();
    if (!checks.length) {
        return (
            <div className="diag-empty">
                {t(running ? 'panels:diagnostics.checksRunning' : 'panels:diagnostics.checksNone')}
            </div>
        );
    }

    return (
        <div className="diag-checks">
            {checks.map((c) => (
                <div className="diag-check" key={c.name}>
                    <span className={`diag-pill diag-pill--${c.status}`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                    <div className="diag-check__body">
                        <div className="diag-check__label">{c.label}</div>
                        <div className="diag-check__detail">{c.detail}</div>
                    </div>
                    {c.durationMs > 0 && (
                        <span className="diag-check__ms">{t('panels:diagnostics.durationMs', { ms: c.durationMs })}</span>
                    )}
                </div>
            ))}
        </div>
    );
}
