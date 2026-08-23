import { Tour } from 'nextstepjs';
import type { TFn } from '../i18n/useT';

/**
 * The tour is built from `t` rather than declared as a const, because nextstepjs
 * reads the step text once when the tour starts — a module-level constant would
 * pin the first language the app ever rendered in.
 */
export function buildAppTour(t: TFn): Tour[] {
    return [
    {
        tour: 'main',
        steps: [
            {
                icon: '👋',
                title: t('panels:tour.welcome.title'),
                content: t('panels:tour.welcome.content'),
                selector: undefined,
                side: 'bottom',
                showControls: true,
                showSkip: true,
            },
            {
                icon: '🖥️',
                title: t('panels:tour.cluster.title'),
                content: t('panels:tour.cluster.content'),
                selector: '#tour-cluster-area',
                side: 'bottom',
                showControls: true,
                showSkip: true,
                pointerPadding: 6,
            },
            {
                icon: '📂',
                title: t('panels:tour.sidebar.title'),
                content: t('panels:tour.sidebar.content'),
                selector: '#tour-sidebar',
                side: 'right',
                showControls: true,
                showSkip: true,
                pointerPadding: 4,
            },
            {
                icon: '🗂️',
                title: t('panels:tour.workspace.title'),
                content: t('panels:tour.workspace.content'),
                selector: 'tour-workspace',

                showControls: true,
                showSkip: true,
                pointerPadding: 0,
            },
            {
                icon: '📝',
                title: t('panels:tour.yaml.title'),
                content: t('panels:tour.yaml.content'),
                selector: '#tour-yaml-btn',
                side: 'bottom',
                showControls: true,
                showSkip: true,
                pointerPadding: 6,

            },
            {
                icon: '💻',
                title: t('panels:tour.terminal.title'),
                content: t('panels:tour.terminal.content'),
                selector: '#tour-terminal-btn',
                side: 'bottom',
                showControls: true,
                showSkip: true,
                pointerPadding: 6,
            },
            {
                icon: '✅',
                title: t('panels:tour.done.title'),
                content: t('panels:tour.done.content'),
                selector: undefined,
                showControls: true,
                showSkip: false,
            },
        ],
    },
    ];
}
