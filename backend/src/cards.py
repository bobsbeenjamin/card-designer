import base64
import binascii
from decimal import Decimal
import hashlib
import ipaddress
import json
import os
import socket
import time
from urllib.parse import unquote_plus, urlparse
from urllib.request import Request, urlopen
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


TABLE_NAME = os.environ["TABLE_NAME"]
SETS_TABLE_NAME = os.environ["SETS_TABLE_NAME"]
USER_BUCKET_PREFIX = os.environ["USER_BUCKET_PREFIX"]
DYNAMODB = boto3.resource("dynamodb")
TABLE = DYNAMODB.Table(TABLE_NAME)
SETS_TABLE = DYNAMODB.Table(SETS_TABLE_NAME)
S3 = boto3.client("s3")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CARD_IMAGE_BYTES = 7 * 1024 * 1024
DEFAULT_SET = {
    "code": "DEFAULT",
    "name": "Default",
    "symbol": "",
    "copyrightInfo": "",
}

ALLOWED_FIELDS = {
    "name",
    "artUrl",
    "cost",
    "type",
    "sub_type",
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
    "setCode",
}
CARD_IMAGE_FIELD = "cardImagePng"


def handler(event, _context):
    try:
        user_id = get_user_id(event)
        method = event["requestContext"]["http"]["method"]
        route_key = event["routeKey"]

        if method == "GET" and route_key == "GET /image-proxy":
            return proxy_image(event)

        if method == "GET" and route_key == "GET /sets":
            return ok(list_sets(user_id))

        if method == "POST" and route_key == "POST /sets":
            return ok(save_set(user_id, read_body(event)), status=201)

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



def proxy_image(event):
    raw_url = (event.get("queryStringParameters") or {}).get("url", "")
    image_url = unquote_plus(raw_url).strip()
    validate_image_url(image_url)

    request = Request(image_url, headers={"User-Agent": "card-designer-image-proxy/1.0"})
    with urlopen(request, timeout=8) as response:
        content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
        if not content_type.startswith("image/"):
            raise ValueError("Image URL did not return an image.")

        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_IMAGE_BYTES:
            raise ValueError("Image is larger than 5 MB.")

        image_bytes = response.read(MAX_IMAGE_BYTES + 1)
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("Image is larger than 5 MB.")

    return {
        "statusCode": 200,
        "headers": {
            "cache-control": "public, max-age=86400",
            "content-type": content_type,
        },
        "isBase64Encoded": True,
        "body": base64.b64encode(image_bytes).decode("ascii"),
    }


def validate_image_url(image_url):
    parsed = urlparse(image_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid image URL.")

    for result in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ValueError("Image URL host is not allowed.")


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
    card["setCode"] = normalize_set_code(card.get("setCode"))
    return card


def normalize_set_code(value):
    code = str(value or DEFAULT_SET["code"]).strip().upper()
    return code or DEFAULT_SET["code"]


def ensure_default_set_if_missing(user_id):
    item = {"userId": user_id, **DEFAULT_SET}
    try:
        SETS_TABLE.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(code)",
        )
    except SETS_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        pass


def get_set(user_id, code):
    response = SETS_TABLE.get_item(Key={"userId": user_id, "code": normalize_set_code(code)})
    return response.get("Item")


def validate_card_set(user_id, set_code):
    ensure_default_set_if_missing(user_id)
    if not get_set(user_id, set_code):
        raise ValueError("Card set does not exist.")


def list_sets(user_id):
    ensure_default_set_if_missing(user_id)
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    sets = sorted(response.get("Items", []), key=lambda item: item.get("code", ""))
    return {"sets": sets}


def clean_set(body):
    code = normalize_set_code(body.get("code"))
    if code == DEFAULT_SET["code"]:
        raise ValueError("DEFAULT is reserved for the built-in set.")

    name = str(body.get("name") or "").strip()
    if not name:
        raise ValueError("Set name is required.")

    symbol = str(body.get("symbol") or "").strip()
    if symbol:
        validate_image_url(symbol)

    return {
        "code": code,
        "name": name,
        "symbol": symbol,
        "copyrightInfo": str(body.get("copyrightInfo") or "").strip(),
    }


def save_set(user_id, body):
    card_set = clean_set(body)
    item = {"userId": user_id, **card_set}
    try:
        SETS_TABLE.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(code)",
        )
    except SETS_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValueError("A set with this code already exists.")
    return {"set": item}


def backfill_card_set_codes(user_id):
    response = TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="userId, cardId, setCode",
    )
    for item in response.get("Items", []):
        if not item.get("setCode"):
            TABLE.update_item(
                Key={"userId": user_id, "cardId": item["cardId"]},
                UpdateExpression="SET setCode = :setCode",
                ExpressionAttributeValues={":setCode": DEFAULT_SET["code"]},
            )


def add_card_image_urls(cards):
    for card in cards:
        bucket_name = card.get("imageBucket")
        image_key = card.get("imageKey")
        if not bucket_name or not image_key:
            continue
        card["imageUrl"] = S3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": image_key},
            ExpiresIn=900,
        )
    return cards


def list_cards(user_id):
    ensure_default_set_if_missing(user_id)
    backfill_card_set_codes(user_id)
    response = TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="userId, cardId, #name, #type, sub_type, rarity, setCode, imageBucket, imageKey, updatedAt",
        ExpressionAttributeNames={"#name": "name", "#type": "type"},
        ScanIndexForward=False,
    )
    return {"cards": add_card_image_urls(response.get("Items", []))}


def get_card(user_id, card_id):
    response = TABLE.get_item(Key={"userId": user_id, "cardId": card_id})
    item = response.get("Item")
    if not item:
        raise ValueError("Card not found.")
    if not item.get("setCode"):
        item["setCode"] = DEFAULT_SET["code"]
        TABLE.update_item(
            Key={"userId": user_id, "cardId": card_id},
            UpdateExpression="SET setCode = :setCode",
            ExpressionAttributeValues={":setCode": DEFAULT_SET["code"]},
        )
    ensure_default_set_if_missing(user_id)
    return {"card": item}


def get_user_bucket_name(user_id):
    digest = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]
    return f"{USER_BUCKET_PREFIX}-{digest}".lower()


def ensure_user_bucket(user_id):
    bucket_name = get_user_bucket_name(user_id)
    try:
        S3.head_bucket(Bucket=bucket_name)
        return bucket_name
    except ClientError as exc:
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        if status not in {403, 404}:
            raise

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


def safe_s3_key_part(value, fallback):
    cleaned = str(value or fallback).strip().replace("\\", "-").replace("/", "-")
    cleaned = " ".join(cleaned.split())
    return cleaned or fallback


def get_card_image_key(card):
    set_code = safe_s3_key_part(normalize_set_code(card.get("setCode")), DEFAULT_SET["code"])
    card_name = safe_s3_key_part(card.get("name"), "Untitled Card")
    return f"{set_code}/{card_name}.png"


def decode_card_image(body):
    card_image = str(body.get(CARD_IMAGE_FIELD) or "")
    if not card_image:
        return None
    prefix = "data:image/png;base64,"
    if not card_image.startswith(prefix):
        raise ValueError("Card image must be a PNG data URL.")
    try:
        image_bytes = base64.b64decode(card_image[len(prefix):], validate=True)
    except binascii.Error:
        raise ValueError("Card image could not be decoded.")
    if len(image_bytes) > MAX_CARD_IMAGE_BYTES:
        raise ValueError("Card image is larger than 7 MB.")
    return image_bytes


def put_card_image(user_id, card, image_bytes, bucket_name=None):
    bucket_name = bucket_name or ensure_user_bucket(user_id)
    image_key = get_card_image_key(card)
    S3.put_object(
        Bucket=bucket_name,
        Key=image_key,
        Body=image_bytes,
        ContentType="image/png",
        ServerSideEncryption="AES256",
    )
    card["imageBucket"] = bucket_name
    card["imageKey"] = image_key


def delete_card_image(card):
    bucket_name = card.get("imageBucket")
    image_key = card.get("imageKey") or get_card_image_key(card)
    if not bucket_name or not image_key:
        return
    S3.delete_object(Bucket=bucket_name, Key=image_key)


def save_card(user_id, body, card_id=None):
    now = int(time.time())
    card = clean_card(body)
    image_bytes = decode_card_image(body)
    validate_card_set(user_id, card["setCode"])
    user_bucket_name = ensure_user_bucket(user_id)
    existing_item = None
    if card_id:
        existing_item = TABLE.get_item(Key={"userId": user_id, "cardId": card_id}).get("Item")

    item = {
        **card,
        "userId": user_id,
        "cardId": card_id or str(uuid.uuid4()),
        "updatedAt": now,
    }

    if existing_item and existing_item.get("createdAt"):
        item["createdAt"] = existing_item["createdAt"]
    elif not card_id:
        item["createdAt"] = now

    if image_bytes:
        put_card_image(user_id, item, image_bytes, user_bucket_name)
    elif existing_item:
        item["imageBucket"] = existing_item.get("imageBucket", "")
        item["imageKey"] = existing_item.get("imageKey", "")

    TABLE.put_item(Item=item)

    if existing_item and image_bytes:
        old_key = existing_item.get("imageKey") or get_card_image_key(existing_item)
        if existing_item.get("imageBucket") == item.get("imageBucket") and old_key != item.get("imageKey"):
            delete_card_image(existing_item)

    return {"card": item}


def delete_card(user_id, card_id):
    response = TABLE.get_item(Key={"userId": user_id, "cardId": card_id})
    item = response.get("Item")
    if item:
        delete_card_image(item)
    TABLE.delete_item(Key={"userId": user_id, "cardId": card_id})


def to_json_safe(value):
    if isinstance(value, list):
        return [to_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: to_json_safe(item) for key, item in value.items()}
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    return value


def ok(body, status=200):
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(to_json_safe(body)),
    }


def error(message, status):
    return ok({"error": message}, status)
