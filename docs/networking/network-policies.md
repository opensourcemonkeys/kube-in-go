---
description: Visualize Kubernetes NetworkPolicy ingress and egress rules as clear diagrams in Kube Inspector, alongside the raw YAML.
---

# Network Policies

The Network Policies screen lists all `NetworkPolicy` resources across namespaces. For each policy you can inspect its rules and visualize traffic flow.

![Network policy diagram](../assets/screenshots/network-policies.png){ .doc-shot }

## Columns

| Column | Description |
|---|---|
| Name | NetworkPolicy name |
| Namespace | Namespace |
| Pod Selector | Label selector that the policy applies to |
| Policy Types | `Ingress`, `Egress`, or both |
| Age | Time since creation |

## Actions

### View YAML

Double-click a row to open the full `NetworkPolicy` manifest. Network policies are view-only in this panel; use the Apply YAML workspace tool to create or modify policies.

### Visual Policy Diagram

Click the **Diagram** button on a row to open a visual representation of the policy's ingress and egress rules. The diagram shows:

- The selected pod group (center)
- Ingress rules — sources that are allowed to reach the pods
- Egress rules — destinations the pods are allowed to reach
- Port and protocol annotations on each connection

This is useful for auditing complex policies without reading raw YAML.

## Tips

- Filter by **Namespace** to audit all policies in a specific namespace.
- An empty pod selector (`{}`) means the policy applies to all pods in the namespace — look for this in the **Pod Selector** column.
- A missing policy type means no restriction on that direction: a policy with only `Ingress` does not restrict egress at all.
