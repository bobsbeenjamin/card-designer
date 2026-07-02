import os

import boto3


SETS_TABLE_NAME = os.environ["SETS_TABLE_NAME"]
SETS_TABLE = boto3.resource("dynamodb").Table(SETS_TABLE_NAME)
DEFAULT_SET = {
    "code": "DEFAULT",
    "name": "Default",
    "symbol": "",
    "copyrightInfo": "",
}


def handler(event, _context):
    user_id = (
        event.get("request", {})
        .get("userAttributes", {})
        .get("sub")
    )
    if not user_id:
        return event

    try:
        SETS_TABLE.put_item(
            Item={"userId": user_id, **DEFAULT_SET},
            ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(code)",
        )
    except SETS_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        pass

    return event
