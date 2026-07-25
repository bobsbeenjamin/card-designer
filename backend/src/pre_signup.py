"""Reserve a case-insensitive username before Cognito creates an account."""

import os
import time

import boto3


USERS_TABLE = boto3.resource("dynamodb").Table(os.environ["USERS_TABLE_NAME"])
COGNITO = boto3.client("cognito-idp")
LEGACY_USER_POOL_ID = os.environ.get("LEGACY_USER_POOL_ID", "")
RESERVATION_SECONDS = 24 * 60 * 60


def handler(event, _context):
    # Cognito can invoke this trigger while creating a user through another
    # workflow, including first-login migration. The checks below are signup
    # validation and must not reject a legacy account that migration has just
    # authenticated.
    if event.get("triggerSource") != "PreSignUp_SignUp":
        return event

    attributes = event.get("request", {}).get("userAttributes", {})
    email = str(attributes.get("email") or "").strip()
    username = str(event.get("userName") or "").strip()
    if not email or not username:
        raise ValueError("Email and username are required.")
    if len(username) < 3:
        raise ValueError("Username must be at least 3 characters.")
    escaped_email = email.lower().replace("\\", "\\\\").replace('"', '\\"')
    pool_ids = {
        pool_id
        for pool_id in (event.get("userPoolId"), LEGACY_USER_POOL_ID)
        if pool_id
    }
    for pool_id in pool_ids:
        existing_users = COGNITO.list_users(
            UserPoolId=pool_id,
            Filter=f'email = "{escaped_email}"',
            Limit=1,
        ).get("Users", [])
        if existing_users:
            raise ValueError("An account with this email already exists. Sign in instead.")

    now = int(time.time())
    try:
        USERS_TABLE.put_item(
            Item={
                "normalizedUsername": username.casefold(),
                "username": username,
                "email": email,
                "reservationExpiresAt": now + RESERVATION_SECONDS,
            },
            ConditionExpression=(
                "attribute_not_exists(normalizedUsername) "
                "OR reservationExpiresAt < :now "
                "OR email = :email"
            ),
            ExpressionAttributeValues={":now": now, ":email": email},
        )
    except USERS_TABLE.meta.client.exceptions.ConditionalCheckFailedException as exc:
        raise ValueError("This username is unavailable.") from exc

    return event
