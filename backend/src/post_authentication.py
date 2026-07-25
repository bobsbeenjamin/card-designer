"""Connect a native Cognito identity to its persistent application user id."""

import os

import boto3


USERS_TABLE = boto3.resource("dynamodb").Table(os.environ["USERS_TABLE_NAME"])


def handler(event, _context):
    attributes = event.get("request", {}).get("userAttributes", {})
    username = str(event.get("userName") or "").strip()
    user_id = str(attributes.get("sub") or "").strip()
    email = str(attributes.get("email") or "").strip()
    if not username or not user_id:
        return event

    USERS_TABLE.update_item(
        Key={"normalizedUsername": username.casefold()},
        UpdateExpression=(
            "SET cognitoUserId = :cognito_user_id, "
            "userId = if_not_exists(userId, :user_id), "
            "username = if_not_exists(username, :username), "
            "email = if_not_exists(email, :email)"
        ),
        ExpressionAttributeValues={
            ":cognito_user_id": user_id,
            ":user_id": user_id,
            ":username": username,
            ":email": email,
        },
    )
    return event
