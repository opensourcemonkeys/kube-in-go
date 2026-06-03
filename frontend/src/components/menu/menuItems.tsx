import React from 'react';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import CopyAllOutlined from '@mui/icons-material/CopyAllOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DesktopWindowsOutlined from '@mui/icons-material/DesktopWindowsOutlined';
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import KeyOutlined from '@mui/icons-material/KeyOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import WorkOutlined from '@mui/icons-material/WorkOutlined';
import DnsOutlined from '@mui/icons-material/DnsOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';

const S = { fontSize: '0.875rem' };

export type NavItem = { label: string; view: string; icon: React.ReactNode };
export type NavGroup = { key: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
    { key: 'workloads', label: 'WORKLOADS', items: [
        { label: 'Pods',         view: 'pods',         icon: <RadioButtonUnchecked style={S} /> },
        { label: 'Deployments',  view: 'deployments',  icon: <CopyAllOutlined style={S} /> },
        { label: 'StatefulSets', view: 'statefulsets', icon: <StorageOutlined style={S} /> },
        { label: 'ReplicaSets',  view: 'replicasets',  icon: <ContentCopyOutlined style={S} /> },
        { label: 'DaemonSets',   view: 'daemonsets',   icon: <DesktopWindowsOutlined style={S} /> },
        { label: 'Jobs',         view: 'jobs',         icon: <PlayCircleOutlined style={S} /> },
        { label: 'CronJobs',     view: 'cronjobs',     icon: <ScheduleOutlined style={S} /> },
    ]},
    { key: 'networking', label: 'NETWORKING', items: [
        { label: 'Services',         view: 'services',        icon: <SwapHorizOutlined style={S} /> },
        { label: 'Ingresses',        view: 'ingresses',       icon: <PublicOutlined style={S} /> },
        { label: 'Ingress Classes',  view: 'ingressclasses',  icon: <AccountTreeOutlined style={S} /> },
        { label: 'Endpoints',        view: 'endpoints',       icon: <ShareOutlined style={S} /> },
        { label: 'Network Policies', view: 'networkpolicies', icon: <ShieldOutlined style={S} /> },
    ]},
    { key: 'config', label: 'CONFIG & SECURITY', items: [
        { label: 'ConfigMaps',       view: 'configmaps',          icon: <EditNoteOutlined style={S} /> },
        { label: 'Secrets',          view: 'secrets',             icon: <KeyOutlined style={S} /> },
        { label: 'Service Accounts', view: 'serviceaccounts',     icon: <BadgeOutlined style={S} /> },
        { label: 'Roles',            view: 'roles',               icon: <LockOutlined style={S} /> },
        { label: 'Role Bindings',    view: 'rolebindings',        icon: <LinkOutlined style={S} /> },
    ]},
    { key: 'storage', label: 'STORAGE', items: [
        { label: 'Persistent Volumes', view: 'persistentvolumes',      icon: <FolderOutlined style={S} /> },
        { label: 'Volume Claims',      view: 'persistentvolumeclaims', icon: <InboxOutlined style={S} /> },
        { label: 'Storage Classes',    view: 'storageclasses',         icon: <WorkOutlined style={S} /> },
    ]},
    { key: 'cluster', label: 'CLUSTER', items: [
        { label: 'Nodes',           view: 'nodes',          icon: <DnsOutlined style={S} /> },
        { label: 'Namespaces',      view: 'namespaces',     icon: <AccountTreeOutlined style={S} /> },
        { label: 'Events',          view: 'events',         icon: <NotificationsOutlined style={S} /> },
        { label: 'Resource Quotas', view: 'resourcequotas', icon: <BarChartOutlined style={S} /> },
        { label: 'Limit Ranges',    view: 'limitranges',    icon: <TuneOutlined style={S} /> },
    ]},
];

export const VIEW_GROUP: Record<string, string> = Object.fromEntries(
    NAV_GROUPS.flatMap(g => g.items.map(item => [item.view, g.key]))
);
