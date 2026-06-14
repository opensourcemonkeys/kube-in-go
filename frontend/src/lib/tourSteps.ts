import { Tour } from 'nextstepjs';

export const appTour: Tour[] = [
    {
        tour: 'main',
        steps: [
            {
                icon: '👋',
                title: 'Welcome to Kube Inspector',
                content: 'This quick tour will show you the key features of the app. Use the arrow buttons to navigate between steps, or press Skip to exit at any time.',
                selector: undefined,
                side: 'bottom',
                showControls: true,
                showSkip: true,
            },
            {
                icon: '🖥️',
                title: 'Cluster Configuration',
                content: 'Select or switch between your Kubernetes clusters here. Use the + button to add a new cluster, the pencil to edit the active one, and the graph icon to view the resource graph.',
                selector: '#tour-cluster-area',
                side: 'bottom',
                showControls: true,
                showSkip: true,
                pointerPadding: 6,
            },
            {
                icon: '📂',
                title: 'Resource Explorer',
                content: 'Browse all Kubernetes resources from the sidebar. Resources are grouped into Workloads, Networking, Config & Security, Storage, and Cluster categories. Click any item to open it as a panel.',
                selector: '#tour-sidebar',
                side: 'right',
                showControls: true,
                showSkip: true,
                pointerPadding: 4,
            },
            {
                icon: '🗂️',
                title: 'Main Workspace',
                content: 'Resource panels open here. You can drag tabs to rearrange them, split the workspace horizontally or vertically, and resize panels by dragging the dividers between them.',
                selector: 'tour-workspace',

                showControls: true,
                showSkip: true,
                pointerPadding: 0,
            },
            {
                icon: '📝',
                title: 'YAML Editor',
                content: 'Apply raw YAML directly to your cluster. Paste or write Kubernetes manifests and click Apply. Supports multi-document YAML files (separated by ---).',
                selector: '#tour-yaml-btn',
                side: 'bottom',
                showControls: true,
                showSkip: true,
                pointerPadding: 6,

            },
            {
                icon: '💻',
                title: 'Terminal',
                content: 'Open an interactive terminal session. Run kubectl commands, inspect resources, and interact with your cluster directly from within the app.',
                selector: '#tour-terminal-btn',
                side: 'bottom',
                showControls: true,
                showSkip: true,
                pointerPadding: 6,
            },
            {
                icon: '✅',
                title: "You're all set!",
                content: 'You now know the essentials of Kube Inspector. Double-click any row in a resource list to view its YAML, and use the log button on workload rows to stream live logs.',
                selector: undefined,
                showControls: true,
                showSkip: false,
            },
        ],
    },
];
