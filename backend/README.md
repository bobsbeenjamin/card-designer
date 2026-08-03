# Card Designer Backend

This backend keeps AWS credentials out of the public web app.

Browser -> API Gateway HTTP API -> Lambda -> DynamoDB

Authentication is handled by Cognito. The browser sends a Cognito JWT in the
`Authorization` header. New accounts use Cognito's native, case-insensitive
username. Lambda resolves the native identity to the persistent `userId` stored
in DynamoDB, which preserves the original partition key for migrated users.

User records are stored in the stack's `card-designer-<environment>-users`
table. `normalizedUsername` is the case-insensitive primary key; each record
also contains `username`, `email`, and `userId`. New records are written by the
Cognito post-confirmation trigger. If signup omits a username, the email address
is passed to Cognito as the native username. A pre-sign-up trigger reserves the
same case-insensitive name in DynamoDB for the application user record.

The original email-as-username pool remains in the stack as a migration source
because Cognito sign-in options can't be changed on an existing pool. On an
existing user's first sign-in, the new pool's user-migration trigger validates
the password against the original pool and creates the native Cognito account.
The original DynamoDB `userId` is retained so cards, sets, history, settings,
and private storage remain associated with the user.

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
creates separate DynamoDB tables for current cards, card history, templates,
and friend relationships:

```text
Dev cards:    card-designer-dev-card-designs
Dev history:  card-designer-dev-card-history
Dev templates: card-designer-dev-card-templates
Dev friends:  card-designer-dev-friends
Prod cards:   card-designer-prod-card-designs
Prod history: card-designer-prod-card-history
Prod templates: card-designer-prod-card-templates
Prod friends: card-designer-prod-friends
```

## Pre-migration stack values

These existing pool values become the legacy migration source after deployment.
Use the new `UserPoolId` and `UserPoolClientId` stack outputs for frontend
configuration. These identifiers are not secrets, but AWS access keys should
never be committed.

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

The username availability route is public. Sign-in goes directly from the
browser to Cognito. All other non-public routes require
`Authorization: Bearer <cognito-jwt>`.

- `GET /usernames/availability?username=<username>`
- `GET /cards`
- `POST /cards`
- `GET /cards/{cardId}`
- `GET /cards/{cardId}/history`
- `PUT /cards/{cardId}`
- `PUT /cards/{cardId}/image`
- `DELETE /cards/{cardId}`
- `GET /templates?set=<setCode>`
- `POST /templates`
- `POST /templates/background/generate`
- `GET /templates/{templateId}`
- `PUT /templates/{templateId}`
- `GET /art`
- `POST /art`
- `POST /art/generate`
- `GET /frame`
- `POST /frame`
- `GET /friends`
- `POST /friends`
- `DELETE /friends/{username}`
- `GET /friends/{username}/sets`

Card templates use a composite user/set partition and a case-folded template
name sort key, so each set can contain multiple templates while enforcing
case-insensitive name uniqueness. A user/template-id secondary index preserves
stable URLs when templates are renamed or moved. Each template stores its
ordered section and field definitions, editable labels, current default values,
the Cost number constraint, Collector number editability, editable Stat mode
and Rarity options, dynamically added number fields, custom field definitions
(type, position, size, color, and dropdown options), built-in field position,
size, and color settings, an Artwork field with a dependent Default Art Fit,
the set-level Set Symbol layout, and S3 preview metadata.
Preview PNGs use
`<setCode>/templates/<templateId>.png` in the same user bucket as card previews.
Generated template backgrounds use
`<userHash>/<setCode>/templates/<templateId>.png` in the existing private
card-art bucket. Regeneration overwrites the stable object and returns a
versioned URL to break browser caches. Deleting a set also deletes all of its
templates, preview images, and app-managed template backgrounds.

Cards created from a template retain the template id and name, a snapshot of
the standard field definitions and values, and the custom-field definitions and
values. This keeps saved cards and regenerated card PNGs consistent even when
the source template is edited later. Card records also persist the selected art
fit. Card names are enforced as case-insensitive unique identifiers within each
set.

## Existing user migration

Before switching the frontend configuration to the new stack outputs, populate
the user table from the legacy pool:

```bash
python backend/scripts/backfill_users.py \
  --user-pool-id <user-pool-id> \
  --table-name card-designer-<environment>-users
```

The backfill is safe to rerun. Existing accounts receive their email address as
their native username. Passwords aren't copied by the script; Cognito migrates
each password securely when the user first signs in to the new pool.

Migration order:

1. Deploy the backend stack, which retains the old pool and creates the native
   username pool.
2. Run the backfill against `LegacyUserPoolId` and `UsersTableName`.
3. Update `config.js` with the new `UserPoolId` and `UserPoolClientId` outputs.
4. Deploy the frontend.

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
  "frameUrl": "",
  "frameFit": "fill",
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
- Uploaded artwork and frame backgrounds are written through authenticated
  Lambda routes to the stack-managed private S3 bucket; the browser never gets
  direct S3 write access.
- Review the generated Lambda role before production. It should only need
  access to the stack-managed DynamoDB tables and CloudWatch Logs.
