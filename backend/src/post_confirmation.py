import hashlib
import os
import time

import boto3
from botocore.exceptions import ClientError


SETS_TABLE_NAME = os.environ["SETS_TABLE_NAME"]
USERS_TABLE_NAME = os.environ["USERS_TABLE_NAME"]
USER_BUCKET_PREFIX = os.environ["USER_BUCKET_PREFIX"]
SETS_TABLE = boto3.resource("dynamodb").Table(SETS_TABLE_NAME)
USERS_TABLE = boto3.resource("dynamodb").Table(USERS_TABLE_NAME)
S3 = boto3.client("s3")
DEFAULT_SET = {
    "code": "DEFAULT",
    "name": "Default",
    "symbol": "",
    "copyrightInfo": "",
}


def get_user_bucket_name(user_id):
    digest = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]
    return f"{USER_BUCKET_PREFIX}-{digest}".lower()


def ensure_user_bucket(user_id):
    """Create or verify the user's private S3 bucket and security settings."""
    bucket_name = get_user_bucket_name(user_id)
    create_args = {"Bucket": bucket_name}
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
    if region and region != "us-east-1":
        create_args["CreateBucketConfiguration"] = {"LocationConstraint": region}

    try:
        S3.create_bucket(**create_args)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") not in {"BucketAlreadyOwnedByYou", "OperationAborted"}:
            raise

    S3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    S3.put_bucket_encryption(
        Bucket=bucket_name,
        ServerSideEncryptionConfiguration={
            "Rules": [
                {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}
            ]
        },
    )
    return bucket_name


def provision_user(event, username):
    """Create the app records and private bucket for a confirmed user."""
    attributes = event.get("request", {}).get("userAttributes", {})
    user_id = attributes.get("sub")
    if not user_id:
        return event

    ensure_user_bucket(user_id)

    email = str(attributes.get("email") or "").strip()
    username = str(username or email).strip()
    if email and username:
        USERS_TABLE.put_item(
            Item={
                "normalizedUsername": username.casefold(),
                "username": username,
                "email": email,
                "userId": user_id,
                "createdAt": int(time.time()),
            },
            ConditionExpression=(
                "attribute_not_exists(normalizedUsername) OR email = :email"
            ),
            ExpressionAttributeValues={":email": email},
        )

    try:
        SETS_TABLE.put_item(
            Item={"userId": user_id, **DEFAULT_SET},
            ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(code)",
        )
    except SETS_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        pass

    return event


def handler(event, _context):
    """Provision users confirmed in the legacy email-username pool."""
    attributes = event.get("request", {}).get("userAttributes", {})
    return provision_user(event, attributes.get("email"))
