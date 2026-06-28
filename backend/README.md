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
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name card-designer-backend \
  --region us-west-2 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides AllowedWebOrigin=http://localhost:3000 \
  --resolve-s3
```

For `AllowedWebOrigin`, use the exact origin that will host the frontend, such
as `https://cards.example.com`. For local testing, deploy a separate dev stack
with `http://localhost:3000` or the port you are actually using.

## Current Dev Stack

These values are not secrets. They are safe for frontend configuration, but AWS
access keys should never be committed.

```text
StackName:        card-designer-backend
Region:           us-west-2
AllowedWebOrigin: http://localhost:3000

ApiUrl:           https://1lcxaojzu4.execute-api.us-west-2.amazonaws.com
UserPoolId:       us-west-2_q3vHIdWiG
UserPoolClientId: 7d0mg3skisq5kcl9vqimsaihkl
TableName:        card-designer-backend-CardDesignsTable-B3OBCKYEXGAV
```

## API

All routes require `Authorization: Bearer <cognito-jwt>`.

- `GET /cards`
- `POST /cards`
- `GET /cards/{cardId}`
- `PUT /cards/{cardId}`
- `DELETE /cards/{cardId}`

Card JSON accepts:

```json
{
  "name": "Spanky and Our Gang",
  "artUrl": "https://example.com/art.png",
  "cost": 4,
  "type": "Pop Culture",
  "subtype": "Rock Band",
  "statMode": "combat",
  "attack": 1,
  "health": 6,
  "loyalty": null,
  "abilities": "When this enters play or attacks...",
  "flavorText": "\"Lazy day! Just right for lovin' away!\"",
  "artistName": "Ed Sullivan Show",
  "collectorNumber": "012/180",
  "rarity": "uncommon",
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
  access to this one DynamoDB table and CloudWatch Logs.
