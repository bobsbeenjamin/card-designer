import json
import os
import time
import uuid

import boto3
from boto3.dynamodb.conditions import Key


TABLE_NAME = os.environ["TABLE_NAME"]
TABLE = boto3.resource("dynamodb").Table(TABLE_NAME)

ALLOWED_FIELDS = {
    "name",
    "artUrl",
    "cost",
    "type",
    "subtype",
    "statMode",
    "attack",
    "health",
    "loyalty",
    "abilities",
    "flavorText",
    "artistName",
    "collectorNumber",
    "rarity",
    "colors",
}


def handler(event, _context):
    try:
        user_id = get_user_id(event)
        method = event["requestContext"]["http"]["method"]
        route_key = event["routeKey"]

        if method == "GET" and route_key == "GET /cards":
            return ok(list_cards(user_id))

        if method == "GET" and route_key == "GET /cards/{cardId}":
            return ok(get_card(user_id, event["pathParameters"]["cardId"]))

        if method == "POST" and route_key == "POST /cards":
            return ok(save_card(user_id, read_body(event)), status=201)

        if method == "PUT" and route_key == "PUT /cards/{cardId}":
            return ok(save_card(user_id, read_body(event), event["pathParameters"]["cardId"]))

        if method == "DELETE" and route_key == "DELETE /cards/{cardId}":
            delete_card(user_id, event["pathParameters"]["cardId"])
            return ok({"deleted": True})

        return error("Route not found", 404)
    except ValueError as exc:
        return error(str(exc), 400)
    except PermissionError:
        return error("Unauthorized", 401)


def get_user_id(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    user_id = claims.get("sub")
    if not user_id:
        raise PermissionError()
    return user_id


def read_body(event):
    if not event.get("body"):
        return {}

    body = json.loads(event["body"])
    if not isinstance(body, dict):
        raise ValueError("Request body must be a JSON object.")
    return body


def clean_card(body):
    card = {key: body[key] for key in ALLOWED_FIELDS if key in body}
    if not card.get("name"):
        raise ValueError("Card name is required.")
    return card


def list_cards(user_id):
    response = TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="userId, cardId, #name, #type, subtype, rarity, updatedAt",
        ExpressionAttributeNames={"#name": "name", "#type": "type"},
        ScanIndexForward=False,
    )
    return {"cards": response.get("Items", [])}


def get_card(user_id, card_id):
    response = TABLE.get_item(Key={"userId": user_id, "cardId": card_id})
    item = response.get("Item")
    if not item:
        raise ValueError("Card not found.")
    return {"card": item}


def save_card(user_id, body, card_id=None):
    now = int(time.time())
    card = clean_card(body)
    item = {
        **card,
        "userId": user_id,
        "cardId": card_id or str(uuid.uuid4()),
        "updatedAt": now,
    }

    if not card_id:
        item["createdAt"] = now

    TABLE.put_item(Item=item)
    return {"card": item}


def delete_card(user_id, card_id):
    TABLE.delete_item(Key={"userId": user_id, "cardId": card_id})


def ok(body, status=200):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }


def error(message, status):
    return ok({"error": message}, status)
