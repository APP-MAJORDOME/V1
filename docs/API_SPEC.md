# API Spec

## Health
- `GET /health`

## Households
- `GET /api/v1/households`
- `POST /api/v1/households`
- `GET /api/v1/households/{household_id}`
- `POST /api/v1/households/{household_id}/members`

## Connected accounts
- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `POST /api/v1/accounts/{account_id}/sync`

## Events
- `GET /api/v1/events`
- `POST /api/v1/events`
- `GET /api/v1/events/conflicts`

## Tasks
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `POST /api/v1/tasks/{task_id}/complete`

## Routines
- `GET /api/v1/routines`
- `POST /api/v1/routines`

## Opportunities
- `GET /api/v1/opportunities`
- `POST /api/v1/opportunities`

## Briefings
- `GET /api/v1/briefings/today`

## Agent
- `POST /api/v1/agent/interpret`
- `POST /api/v1/agent/act`

## Home
- `GET /api/v1/home/status`
- `POST /api/v1/home/scenes/{scene_id}/execute`

## Example command

Request:
```json
{
  "command": "Prépare un mail pour relancer Jardin Loisir au sujet de la tondeuse"
}
```

Response:
```json
{
  "intent": "email_draft",
  "mode": "confirm",
  "proposal": {
    "subject": "Suivi réparation tondeuse",
    "body": "Bonjour..."
  }
}
```
