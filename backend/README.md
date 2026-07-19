# Card Designer Backend

This backend keeps AWS credentials out of the public web app.

Browser -> API Gateway HTTP API -> Lambda -> DynamoDB

Authentication is handled by Cognito. The browser sends a Cognito JWT in the
`Authorization` header; Lambda reads the authenticated user's `sub` claim and
uses it as the DynamoDB partition key. That means one user's card ids cannot be
used to read another user's cards unless your authorizer is bypassed.

## Deploy

Install and configure the AWS SAM CLI, then run:

```bash
sam build --template-file backend/template.yaml
```

Deploy the development stack for `http://localhost:3000`:

```bash
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name card-designer-backend-dev \
  --region us-west-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides AppEnvironment=dev \
  --resolve-s3
```

Deploy the production stack for GitHub Pages:

```bash
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name card-designer-backend-prod \
  --region us-west-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides AppEnvironment=prod \
  --resolve-s3
```

The GitHub Pages app URL is `https://bobsbeenjamin.github.io/card-designer`, but
the CORS origin is only `https://bobsbeenjamin.github.io`.

Dev and prod should be deployed as separate CloudFormation stacks. Each stack
creates separate DynamoDB tables for current cards and card history:

```text
Dev cards:    card-designer-dev-card-designs
Dev history:  card-designer-dev-card-history
Prod cards:   card-designer-prod-card-designs
Prod history: card-designer-prod-card-history
```

## Current Stack Outputs

These values are not secrets. They are safe for frontend configuration, but AWS
access keys should never be committed.

```text
DevStackName:     card-designer-backend-dev
DevOrigin:        http://localhost:3000
DevApiUrl:        https://ij9i8u1wvg.execute-api.us-west-2.amazonaws.com
DevUserPoolId:    us-west-2_lTDVLzK6E
DevClientId:      7tlba3kd4kv5p4e1h5363s7a29
DevTableName:     card-designer-dev-card-designs

ProdStackName:    card-designer-backend-prod
ProdOrigin:       https://bobsbeenjamin.github.io
ProdApiUrl:       https://55g413zjq2.execute-api.us-west-2.amazonaws.com
ProdUserPoolId:   us-west-2_6BjuamntD
ProdClientId:     3jucb7dgsgteq2v98ae3uoacmq
ProdTableName:    card-designer-prod-card-designs

Region:           us-west-2
```
## API

All routes require `Authorization: Bearer <cognito-jwt>`.

- `GET /cards`
- `POST /cards`
- `GET /cards/{cardId}`
- `GET /cards/{cardId}/history`
- `PUT /cards/{cardId}`
- `DELETE /cards/{cardId}`

## Card History

Every update to an existing card stores its complete prior DynamoDB item in the
card history table. The snapshot and replacement card are written in one
DynamoDB transaction, so the current record remains the source of truth without
losing the previous state. Drag-and-drop reordering also records snapshots for
cards whose collector number changes. Creating a new card does not create a
history record because there is no prior state.

History records use `cardKey` (`<userId>#<cardId>`) as the partition key and a
chronological `versionId` as the sort key. Each record also contains `userId`,
`cardId`, `recordedAt`, `changedBy`, `changeType`, `changedFields`,
`description`, `oldValues`, `newValues`, and `snapshot`. The authenticated
history route returns the
newest entries first. History starts after the updated backend stack is
deployed; existing cards are not backfilled.

Card JSON accepts:

```json
{
  "name": "Test Card",
  "artUrl": "",
  "cost": "4",
  "type": "Person",
  "sub_type": "World Leader",
  "statMode": "combat",
  "attack": "1",
  "health": "4",
  "loyalty": "5",
  "abilities": "On enter or attack: Create a Production token for each Organization you control.",
  "flavorText": "",
  "artistName": "None",
  "collectorNumber": "",
  "rarity": "common",
  "colors": {
    "frame": "#263a31",
    "accent": "#d69d42",
    "text": "#f8f4e8",
    "panel": "#fff7df"
  }
}
```

## Security Notes

- Do not put AWS access keys in `index.html`, `app.js`, or any public frontend
  file.
- The frontend should only know the API URL, Cognito user pool id, and Cognito
  app client id. Those are not secrets.
- Keep CORS restricted to your real frontend origin. Avoid `*` for production.
- Use separate dev and production stacks.
- Store uploaded art in S3 later using short-lived presigned upload URLs from
  Lambda, not direct public write access.
- Review the generated Lambda role before production. It should only need
  access to the stack-managed DynamoDB tables and CloudWatch Logs.
