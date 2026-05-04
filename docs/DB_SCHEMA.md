# Schéma de données

## Tables principales

### users
- id
- email
- full_name
- timezone
- locale
- created_at

### households
- id
- name
- owner_user_id
- created_at

### household_members
- id
- household_id
- display_name
- role
- birth_year
- preferences_json

### connected_accounts
- id
- user_id
- provider
- external_account_id
- scopes_json
- status
- last_sync_at

### canonical_events
- id
- household_id
- member_id
- title
- description
- location
- category
- starts_at
- ends_at
- timezone
- importance
- flexibility
- source_provider
- source_event_id
- raw_payload_json
- created_at
- updated_at

### tasks
- id
- household_id
- assigned_member_id
- title
- description
- status
- task_type
- due_at
- recurrence_rule
- context_tags_json
- origin
- created_at
- updated_at

### routines
- id
- household_id
- name
- trigger_type
- rrule
- config_json
- enabled

### opportunities
- id
- household_id
- category
- title
- summary
- score
- source_url
- status
- recommended_action
- created_at

### action_proposals
- id
- household_id
- proposal_type
- mode
- title
- payload_json
- explanation
- status
- created_at

### audit_logs
- id
- household_id
- actor_type
- actor_id
- action
- target_type
- target_id
- details_json
- created_at

## Notes
- Les payloads JSON servent au bootstrap rapide ;
- à terme, certaines structures devront être davantage normalisées ;
- les écritures externes doivent être historisées.
