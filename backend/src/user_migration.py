"""Migrate a legacy email-username Cognito user on first native-pool login."""

import os

import boto3
from botocore.exceptions import ClientError


COGNITO = boto3.client("cognito-idp")
USERS_TABLE = boto3.resource("dynamodb").Table(os.environ["USERS_TABLE_NAME"])
LEGACY_USER_POOL_ID = os.environ["LEGACY_USER_POOL_ID"]
LEGACY_USER_POOL_CLIENT_ID = os.environ["LEGACY_USER_POOL_CLIENT_ID"]


def attributes_by_name(attributes):
    return {
        str(attribute.get("Name")): str(attribute.get("Value") or "")
        for attribute in attributes or []
    }


def get_legacy_attributes(event):
    username = str(event.get("userName") or "").strip()
    trigger_source = event.get("triggerSource")
    if trigger_source == "UserMigration_Authentication":
        password = str(event.get("request", {}).get("password") or "")
        if not password:
            raise ValueError("Password is required.")
        authentication = COGNITO.initiate_auth(
            ClientId=LEGACY_USER_POOL_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={"USERNAME": username, "PASSWORD": password},
        )
        access_token = authentication.get("AuthenticationResult", {}).get("AccessToken")
        if not access_token:
            raise ValueError("Incorrect username or password.")
        return attributes_by_name(
            COGNITO.get_user(AccessToken=access_token).get("UserAttributes")
        )

    legacy_user = COGNITO.admin_get_user(
        UserPoolId=LEGACY_USER_POOL_ID,
        Username=username,
    )
    return attributes_by_name(legacy_user.get("UserAttributes"))


def handler(event, _context):
    username = str(event.get("userName") or "").strip()
    try:
        attributes = get_legacy_attributes(event)
    except (ClientError, ValueError) as exc:
        raise ValueError("Incorrect username or password.") from exc

    email = str(attributes.get("email") or username).strip()
    legacy_user_id = str(attributes.get("sub") or "").strip()
    if not email or not legacy_user_id:
        raise ValueError("Legacy account is missing required attributes.")

    USERS_TABLE.put_item(
        Item={
            "normalizedUsername": username.casefold(),
            "username": username,
            "email": email,
            "userId": legacy_user_id,
            "legacyUserId": legacy_user_id,
        },
        ConditionExpression=(
            "attribute_not_exists(normalizedUsername) OR userId = :user_id"
        ),
        ExpressionAttributeValues={":user_id": legacy_user_id},
    )

    response = event.setdefault("response", {})
    response["userAttributes"] = {
        "email": email,
        "email_verified": str(attributes.get("email_verified") or "true"),
    }
    response["finalUserStatus"] = "CONFIRMED"
    response["messageAction"] = "SUPPRESS"
    return event
