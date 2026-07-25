"""Backfill the user table from an existing Card Designer Cognito user pool."""

import argparse

import boto3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-pool-id", required=True)
    parser.add_argument("--table-name", required=True)
    args = parser.parse_args()

    cognito = boto3.client("cognito-idp")
    table = boto3.resource("dynamodb").Table(args.table_name)
    paginator = cognito.get_paginator("list_users")

    count = 0
    for page in paginator.paginate(UserPoolId=args.user_pool_id):
        for user in page.get("Users", []):
            if user.get("UserStatus") != "CONFIRMED":
                continue
            attributes = {
                attribute["Name"]: attribute["Value"]
                for attribute in user.get("Attributes", [])
            }
            email = str(attributes.get("email") or "").strip()
            username = email
            user_id = str(attributes.get("sub") or user.get("Username") or "")
            if not email or not username or not user_id:
                continue
            table.put_item(
                Item={
                    "normalizedUsername": username.casefold(),
                    "username": username,
                    "email": email,
                    "userId": user_id,
                },
                ConditionExpression=(
                    "attribute_not_exists(normalizedUsername) OR userId = :user_id"
                ),
                ExpressionAttributeValues={":user_id": user_id},
            )
            count += 1
    print(f"Backfilled {count} user records.")


if __name__ == "__main__":
    main()
