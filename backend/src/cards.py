import base64
import binascii
from decimal import Decimal
import hashlib
import ipaddress
import json
import os
import socket
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote_plus, urlparse
from urllib.request import Request, urlopen
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


TABLE_NAME = os.environ["TABLE_NAME"]
SETS_TABLE_NAME = os.environ["SETS_TABLE_NAME"]
USER_SETTINGS_TABLE_NAME = os.environ["USER_SETTINGS_TABLE_NAME"]
USER_BUCKET_PREFIX = os.environ["USER_BUCKET_PREFIX"]
ART_BUCKET_NAME = os.environ["ART_BUCKET_NAME"]
USER_SETTINGS_KEY_ID = os.environ["USER_SETTINGS_KEY_ID"]
DYNAMODB = boto3.resource("dynamodb")
TABLE = DYNAMODB.Table(TABLE_NAME)
SETS_TABLE = DYNAMODB.Table(SETS_TABLE_NAME)
USER_SETTINGS_TABLE = DYNAMODB.Table(USER_SETTINGS_TABLE_NAME)
S3 = boto3.client("s3")
KMS = boto3.client("kms")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CARD_IMAGE_BYTES = 7 * 1024 * 1024
MAX_ART_IMAGE_BYTES = 7 * 1024 * 1024
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
ART_IMAGE_FIELD = "artImage"
OPENAI_KEY_SETTING = "openAiApiKey"


def handler(event, _context):
    """Handle Lambda events for the card designer backend."""
    try:
        user_id = get_user_id(event)
        method = event["requestContext"]["http"]["method"]
        route_key = event["routeKey"]

        if method == "GET" and route_key == "GET /image-proxy":
            return proxy_image(event)

        if method == "GET" and route_key == "GET /art":
            return get_saved_art(user_id, event)

        if method == "POST" and route_key == "POST /art":
            return ok(save_art(user_id, read_body(event)), status=201)

        if method == "POST" and route_key == "POST /art/generate":
            return ok(generate_art(user_id, read_body(event)), status=201)

        if method == "GET" and route_key == "GET /settings/openai-key":
            return ok(get_openai_key_status(user_id))

        if method == "PUT" and route_key == "PUT /settings/openai-key":
            return ok(save_openai_key(user_id, read_body(event)))

        if method == "GET" and route_key == "GET /sets":
            return ok(list_sets(user_id))

        if method == "POST" and route_key == "POST /sets":
            return ok(save_set(user_id, read_body(event)), status=201)

        if method == "DELETE" and route_key == "DELETE /sets/{setCode}":
            set_code = event["pathParameters"]["setCode"]
            return ok(delete_set(user_id, set_code))

        if method == "POST" and route_key == "POST /sets/{setCode}/cards/reorder":
            set_code = event["pathParameters"]["setCode"]
            return ok(reorder_set_cards(user_id, set_code, read_body(event)))

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


def get_art_user_prefix(user_id):
    """Return the S3 key prefix reserved for a user's saved art."""
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]


def get_art_key(user_id, set_code, card_name, content_type):
    """Build the S3 key for saved card art.

    Args:
        user_id: Authenticated Cognito user id.
        set_code: Card set code for the art path.
        card_name: Card name for the art path.
        content_type: Uploaded image MIME type.
    """
    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
    }.get(content_type, "png")
    user_prefix = get_art_user_prefix(user_id)
    set_part = safe_s3_key_part(normalize_set_code(set_code), DEFAULT_SET["code"])
    name_part = safe_s3_key_part(card_name, "Untitled Card")
    return f"{user_prefix}/{set_part}/{name_part}.{extension}"


def decode_art_image(body):
    """Decode the uploaded artwork data URL."""
    art_image = str(body.get(ART_IMAGE_FIELD) or "")
    if not art_image.startswith("data:image/") or ";base64," not in art_image:
        raise ValueError("Art image must be an image data URL.")
    metadata, encoded_image = art_image.split(",", 1)
    content_type = metadata[5:].split(";", 1)[0].lower()
    if content_type not in {"image/jpeg", "image/png", "image/gif", "image/webp"}:
        raise ValueError("Art image type is not supported.")
    try:
        image_bytes = base64.b64decode(encoded_image, validate=True)
    except binascii.Error:
        raise ValueError("Art image could not be decoded.")
    if len(image_bytes) > MAX_ART_IMAGE_BYTES:
        raise ValueError("Art image is larger than 7 MB.")
    return image_bytes, content_type


def save_art(user_id, body):
    """Store uploaded artwork and return an authenticated app URL."""
    image_bytes, content_type = decode_art_image(body)
    set_code = normalize_set_code(body.get("setCode"))
    validate_card_set(user_id, set_code)
    art_key = get_art_key(user_id, set_code, body.get("cardName"), content_type)
    S3.put_object(
        Bucket=ART_BUCKET_NAME,
        Key=art_key,
        Body=image_bytes,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )
    return {"artKey": art_key, "artUrl": f"/art?key={quote(art_key, safe='')}"}


def get_openai_key_item(user_id):
    """Return the stored OpenAI key settings item for a user."""
    response = USER_SETTINGS_TABLE.get_item(Key={"userId": user_id, "settingKey": OPENAI_KEY_SETTING})
    return response.get("Item")


def get_openai_key_status(user_id):
    """Return whether the signed-in user has an OpenAI key stored."""
    item = get_openai_key_item(user_id)
    configured = bool(item and (item.get("apiKeyCiphertext") or item.get("apiKey")))
    return {"configured": configured, "updatedAt": item.get("updatedAt") if item else None}


def get_openai_key_encryption_context(user_id):
    """Build the KMS encryption context for a user's OpenAI key."""
    return {"userId": user_id, "settingKey": OPENAI_KEY_SETTING}


def encrypt_openai_key(user_id, api_key):
    """Encrypt a user's OpenAI key before storing it in DynamoDB."""
    response = KMS.encrypt(
        KeyId=USER_SETTINGS_KEY_ID,
        Plaintext=api_key.encode("utf-8"),
        EncryptionContext=get_openai_key_encryption_context(user_id),
    )
    return base64.b64encode(response["CiphertextBlob"]).decode("ascii")


def decrypt_openai_key(user_id, ciphertext):
    """Decrypt a user's stored OpenAI key for image generation."""
    try:
        encrypted_key = base64.b64decode(str(ciphertext or ""), validate=True)
    except binascii.Error:
        raise ValueError("Saved OpenAI API key could not be decoded.")
    response = KMS.decrypt(
        CiphertextBlob=encrypted_key,
        EncryptionContext=get_openai_key_encryption_context(user_id),
    )
    return response["Plaintext"].decode("utf-8").strip()


def save_openai_key(user_id, body):
    """Store the signed-in user's OpenAI API key."""
    api_key = str(body.get("apiKey") or "").strip()
    if not api_key:
        raise ValueError("OpenAI API key is required.")
    now = int(time.time())
    USER_SETTINGS_TABLE.put_item(Item={
        "userId": user_id,
        "settingKey": OPENAI_KEY_SETTING,
        "apiKeyCiphertext": encrypt_openai_key(user_id, api_key),
        "updatedAt": now,
    })
    return {"configured": True, "updatedAt": now}


def get_openai_api_key(user_id):
    """Return the signed-in user's stored OpenAI API key."""
    item = get_openai_key_item(user_id) or {}
    if item.get("apiKeyCiphertext"):
        return decrypt_openai_key(user_id, item["apiKeyCiphertext"])
    return str(item.get("apiKey") or "").strip()


def build_art_prompt(body):
    """Build the image prompt from the current card fields."""
    card_name = str(body.get("cardName") or "Untitled Card").strip() or "Untitled Card"
    flavor_text = str(body.get("flavorText") or "").strip()
    return f"image name is {card_name} and image caption would be {flavor_text}"


def read_image_generation_error(exc):
    """Return the API error message from an image generation failure."""
    message = "Image generation failed."
    try:
        error_body = json.loads(exc.read().decode("utf-8"))
        return error_body.get("error", {}).get("message") or message
    except (json.JSONDecodeError, UnicodeDecodeError):
        return message


def fetch_generated_image(image_url):
    """Download a generated image URL and return image bytes."""
    validate_image_url(image_url)
    request = Request(image_url, headers={"User-Agent": "card-designer-image-generator/1.0"})
    try:
        with urlopen(request, timeout=30) as response:
            content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
            if not content_type.startswith("image/"):
                raise ValueError("Generated image URL did not return an image.")
            image_bytes = response.read(MAX_ART_IMAGE_BYTES + 1)
    except URLError:
        raise ValueError("Generated image could not be downloaded.")
    if len(image_bytes) > MAX_ART_IMAGE_BYTES:
        raise ValueError("Generated image is larger than 7 MB.")
    return image_bytes


def decode_generated_image(encoded_image):
    """Decode a generated image from base64 when the API returns one."""
    try:
        image_bytes = base64.b64decode(encoded_image, validate=True)
    except binascii.Error:
        raise ValueError("Generated image could not be decoded.")
    if len(image_bytes) > MAX_ART_IMAGE_BYTES:
        raise ValueError("Generated image is larger than 7 MB.")
    return image_bytes


def generate_openai_image(prompt, api_key):
    """Generate a PNG image with OpenAI and return its bytes."""
    if not api_key:
        raise ValueError("Save an OpenAI API key before generating images.")

    payload = json.dumps({
        "model": "gpt-image-2",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "quality": "low",
    }).encode("utf-8")
    request = Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise ValueError(read_image_generation_error(exc))
    except URLError:
        raise ValueError("Image generation service could not be reached.")

    image = (data.get("data") or [{}])[0]
    if image.get("b64_json"):
        return decode_generated_image(image["b64_json"])
    if image.get("url"):
        return fetch_generated_image(image["url"])
    raise ValueError("Image generation did not return an image.")


def generate_art(user_id, body):
    """Generate card art, save it in S3, and return an authenticated app URL."""
    set_code = normalize_set_code(body.get("setCode"))
    validate_card_set(user_id, set_code)
    prompt = build_art_prompt(body)
    image_bytes = generate_openai_image(prompt, get_openai_api_key(user_id))
    art_key = get_art_key(user_id, set_code, body.get("cardName"), "image/png")
    S3.put_object(
        Bucket=ART_BUCKET_NAME,
        Key=art_key,
        Body=image_bytes,
        ContentType="image/png",
        ServerSideEncryption="AES256",
    )
    return {"artKey": art_key, "artUrl": f"/art?key={quote(art_key, safe='')}", "prompt": prompt}


def get_saved_art(user_id, event):
    """Return saved artwork from the private art bucket."""
    art_key = unquote_plus((event.get("queryStringParameters") or {}).get("key", "")).strip()
    user_prefix = f"{get_art_user_prefix(user_id)}/"
    if not art_key.startswith(user_prefix):
        raise PermissionError()
    try:
        response = S3.get_object(Bucket=ART_BUCKET_NAME, Key=art_key)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
            raise ValueError("Saved art was not found.")
        raise
    image_bytes = response["Body"].read(MAX_ART_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_ART_IMAGE_BYTES:
        raise ValueError("Saved art is larger than 7 MB.")
    return {
        "statusCode": 200,
        "headers": {
            "cache-control": "private, max-age=3600",
            "content-type": response.get("ContentType") or "image/png",
        },
        "isBase64Encoded": True,
        "body": base64.b64encode(image_bytes).decode("ascii"),
    }


def proxy_image(event):
    """Fetch and return a validated remote image for browser-safe rendering."""
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
    """Validate that an image URL is public HTTP(S) and not private-network hosted."""
    parsed = urlparse(image_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid image URL.")

    for result in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ValueError("Image URL host is not allowed.")


def get_user_id(event):
    """Extract the authenticated Cognito user id from API Gateway claims."""
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
    """Parse and validate a JSON request body."""
    if not event.get("body"):
        return {}

    body = json.loads(event["body"])
    if not isinstance(body, dict):
        raise ValueError("Request body must be a JSON object.")
    return body


def clean_card(body):
    """Keep supported card fields and normalize required card values."""
    card = {key: body[key] for key in ALLOWED_FIELDS if key in body}
    if not card.get("name"):
        raise ValueError("Card name is required.")
    card["setCode"] = normalize_set_code(card.get("setCode"))
    card["collectorNumber"] = normalize_collector_number(card.get("collectorNumber"))
    return card


def normalize_set_code(value):
    code = str(value or DEFAULT_SET["code"]).strip().upper()
    return code or DEFAULT_SET["code"]


def normalize_collector_number(value):
    """Convert stored collector values to a positive integer."""
    raw_value = str(value or "").strip()
    if not raw_value:
        return 1
    card_number = raw_value.split("/", 1)[0].strip()
    try:
        number = int(card_number)
    except ValueError:
        return 1
    return max(1, number)


def ensure_default_set_if_missing(user_id):
    """Create the built-in default set for a user when absent."""
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
    """Return all sets owned by the user."""
    ensure_default_set_if_missing(user_id)
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    sets = sorted(response.get("Items", []), key=lambda item: item.get("code", ""))
    return {"sets": sets}


def clean_set(body):
    """Validate and normalize a card-set request body."""
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


def get_cards_for_set(user_id, set_code):
    """Return all cards in a set for cascading operations."""
    normalized_set_code = normalize_set_code(set_code)
    response = TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    return [
        item
        for item in response.get("Items", [])
        if (item.get("setCode") or DEFAULT_SET["code"]) == normalized_set_code
    ]


def delete_set(user_id, set_code):
    """Delete a non-default set and every card/image in that set."""
    normalized_set_code = normalize_set_code(set_code)
    if normalized_set_code == DEFAULT_SET["code"]:
        raise ValueError("The default set cannot be deleted.")
    if not get_set(user_id, normalized_set_code):
        raise ValueError("Card set does not exist.")

    deleted_cards = 0
    for card in get_cards_for_set(user_id, normalized_set_code):
        delete_card_image(card)
        TABLE.delete_item(Key={"userId": user_id, "cardId": card["cardId"]})
        deleted_cards += 1

    SETS_TABLE.delete_item(Key={"userId": user_id, "code": normalized_set_code})
    return {"deleted": True, "setCode": normalized_set_code, "deletedCards": deleted_cards}


def save_set(user_id, body):
    """Create a new card set for a user."""
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
    """Update older card records that predate set codes."""
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
    """Attach short-lived signed S3 URLs to card summaries with saved PNGs."""
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
    """Return saved card summaries ordered by set and collector number."""
    ensure_default_set_if_missing(user_id)
    backfill_card_set_codes(user_id)
    response = TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="userId, cardId, #name, #type, sub_type, rarity, setCode, collectorNumber, imageBucket, imageKey, updatedAt",
        ExpressionAttributeNames={"#name": "name", "#type": "type"},
    )
    cards = response.get("Items", [])
    cards.sort(key=lambda card: (card.get("setCode") or DEFAULT_SET["code"], normalize_collector_number(card.get("collectorNumber")), card.get("name", "")))
    return {"cards": add_card_image_urls(cards)}


def get_card(user_id, card_id):
    """Return a full card record after applying legacy set backfill."""
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


def reorder_set_cards(user_id, set_code, body):
    """Persist drag/drop ordering and collector numbers for every card in a set.

    Args:
        user_id: Authenticated Cognito user id.
        set_code: Set whose cards are being reordered.
        body: Request body containing the complete ordered card id list.
    """
    normalized_set_code = normalize_set_code(set_code)
    validate_card_set(user_id, normalized_set_code)
    card_ids = body.get("cardIds")
    if not isinstance(card_ids, list) or not card_ids:
        raise ValueError("Card ids are required.")
    if len(set(card_ids)) != len(card_ids):
        raise ValueError("Card ids must be unique.")

    response = TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    cards_in_set = {
        item["cardId"]: item
        for item in response.get("Items", [])
        if (item.get("setCode") or DEFAULT_SET["code"]) == normalized_set_code
    }
    if set(card_ids) != set(cards_in_set):
        raise ValueError("Reorder list must include every card in the set.")

    now = int(time.time())
    for index, card_id in enumerate(card_ids, start=1):
        TABLE.update_item(
            Key={"userId": user_id, "cardId": card_id},
            UpdateExpression="SET collectorNumber = :collectorNumber, updatedAt = :updatedAt",
            ExpressionAttributeValues={":collectorNumber": index, ":updatedAt": now},
        )
        cards_in_set[card_id]["collectorNumber"] = index
        cards_in_set[card_id]["updatedAt"] = now

    reordered_cards = [cards_in_set[card_id] for card_id in card_ids]
    return {"cards": add_card_image_urls(reordered_cards)}


def get_user_bucket_name(user_id):
    digest = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]
    return f"{USER_BUCKET_PREFIX}-{digest}".lower()


def ensure_user_bucket(user_id):
    """Create or verify the user's private S3 bucket and security settings."""
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
    """Decode the PNG data URL sent by the frontend."""
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
    """Store a rendered card PNG in the user's private S3 bucket.

    Args:
        user_id: Authenticated Cognito user id.
        card: Card item receiving image metadata.
        image_bytes: PNG image bytes to store.
        bucket_name: Optional already-resolved S3 bucket name.
    """
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
    """Delete a rendered card PNG from S3 when present."""
    bucket_name = card.get("imageBucket")
    image_key = card.get("imageKey") or get_card_image_key(card)
    if not bucket_name or not image_key:
        return
    S3.delete_object(Bucket=bucket_name, Key=image_key)


def save_card(user_id, body, card_id=None):
    """Create or update a card record and its rendered PNG.

    Args:
        user_id: Authenticated Cognito user id.
        body: Card request payload.
        card_id: Existing card id when updating.
    """
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
    """Delete a card record and its rendered PNG."""
    response = TABLE.get_item(Key={"userId": user_id, "cardId": card_id})
    item = response.get("Item")
    if item:
        delete_card_image(item)
    TABLE.delete_item(Key={"userId": user_id, "cardId": card_id})


def to_json_safe(value):
    """Convert DynamoDB values into JSON-serializable values."""
    if isinstance(value, list):
        return [to_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {key: to_json_safe(item) for key, item in value.items()}
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    return value


def ok(body, status=200):
    """Build a JSON API Gateway response."""
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(to_json_safe(body)),
    }


def error(message, status):
    return ok({"error": message}, status)
