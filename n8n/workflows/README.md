# n8n Workflows

Store workflow export JSON files for automations used by `apps/api`.

## Initial conventions

- Prefix names with tenant and domain (`maa_ticket_create.json`).
- Use webhook triggers for async actions.
- Keep input/output keys aligned with `packages/schemas` contracts.
