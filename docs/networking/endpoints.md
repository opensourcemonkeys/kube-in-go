# Endpoints

The Endpoints screen lists `Endpoints` resources — the actual pod addresses backing each service.

## Columns

| Column | Description |
|---|---|
| Name | Endpoints name (matches the service) |
| Namespace | Namespace |
| Ready | Count of ready backend addresses |
| Not Ready | Count of not-ready addresses |
| Ports | Ports exposed by the backends |
| Age | Time since creation |

## Actions

### View YAML

Double-click a row to open the manifest (read-only). Use this to confirm a service has healthy backends — an empty or all-not-ready Endpoints object usually explains why a service isn't reachable.
