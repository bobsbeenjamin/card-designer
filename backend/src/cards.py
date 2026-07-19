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
from urllib.parse import parse_qs, quote, unquote_plus, urlparse
from urllib.request import Request, urlopen
import uuid

import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError


TABLE_NAME = os.environ["TABLE_NAME"]
CARD_HISTORY_TABLE_NAME = os.environ["CARD_HISTORY_TABLE_NAME"]
SETS_TABLE_NAME = os.environ["SETS_TABLE_NAME"]
USER_SETTINGS_TABLE_NAME = os.environ["USER_SETTINGS_TABLE_NAME"]
USER_BUCKET_PREFIX = os.environ["USER_BUCKET_PREFIX"]
ART_BUCKET_NAME = os.environ["ART_BUCKET_NAME"]
USER_SETTINGS_KEY_ID = os.environ["USER_SETTINGS_KEY_ID"]
USER_POOL_ID = os.environ["USER_POOL_ID"]
DYNAMODB = boto3.resource("dynamodb")
DYNAMODB_CLIENT = boto3.client("dynamodb")
DYNAMODB_SERIALIZER = TypeSerializer()
TABLE = DYNAMODB.Table(TABLE_NAME)
CARD_HISTORY_TABLE = DYNAMODB.Table(CARD_HISTORY_TABLE_NAME)
SETS_TABLE = DYNAMODB.Table(SETS_TABLE_NAME)
USER_SETTINGS_TABLE = DYNAMODB.Table(USER_SETTINGS_TABLE_NAME)
S3 = boto3.client("s3")
KMS = boto3.client("kms")
BEDROCK = boto3.client("bedrock-runtime")
COGNITO = boto3.client("cognito-idp")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CARD_IMAGE_BYTES = 7 * 1024 * 1024
MAX_ART_IMAGE_BYTES = 7 * 1024 * 1024
SET_SHARE_EXPIRATION_SECONDS = 90 * 24 * 60 * 60
SHARE_REQUEST_RECORD = "shareRequest"
SHARE_EXPIRATION_NOTICE_RECORD = "shareExpirationNotice"
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
CARD_HISTORY_FIELD_LABELS = {
    "name": "name",
    "artUrl": "art",
    "cost": "cost",
    "type": "type",
    "sub_type": "subtype",
    "statMode": "stat mode",
    "attack": "attack",
    "health": "health",
    "loyalty": "loyalty",
    "abilities": "rules",
    "flavorText": "flavor text",
    "artistName": "artist",
    "collectorNumber": "collector number",
    "rarity": "rarity",
    "colors": "colors",
    "setCode": "set",
}
CARD_IMAGE_FIELD = "cardImagePng"
ART_IMAGE_FIELD = "artImage"
OPENAI_KEY_SETTING = "openAiApiKey"
IMAGE_PROVIDER_SETTING = "imageGenerationProvider"
MIDJOURNEY_SETTING = "midjourneySettings"
PROVIDER_SETTINGS_PREFIX = "imageProviderSettings#"
PROVIDER_LABELS = {
    "openai": "OpenAI",
    "gemini": "Google Gemini",
    "aws": "AWS Bedrock",
    "midjourney": "Midjourney-compatible",
    "claude": "Claude-compatible",
    "morphic": "Morphic-compatible",
    "leonardo": "Leonardo.ai-compatible",
    "fal": "Fal.ai-compatible",
    "ace": "ace.ai-compatible",
    "runware": "Runware-compatible",
    "firefly": "Adobe Firefly-compatible",
    "stability": "Stability AI",
}
IMAGE_PROVIDERS = set(PROVIDER_LABELS)
PROVIDER_DEFAULT_ENDPOINTS = {
    "stability": "https://api.stability.ai/v2beta/stable-image/generate/core",
}
PROVIDER_DEFAULT_MODELS = {
    "openai": "gpt-image-2",
    "gemini": "gemini-3.1-flash-image",
    "aws": "amazon.titan-image-generator-v2:0",
}
DIRECT_IMAGE_PROVIDERS = {"openai", "gemini", "aws", "stability"}


def handler(event, _context):
    """Handle Lambda events for the card designer backend."""
    try:
        method = event["requestContext"]["http"]["method"]
        route_key = event["routeKey"]

        if method == "GET" and route_key == "GET /public/sets":
            return ok(get_public_set(event))

        user_id = get_user_id(event)
        user_email = get_user_email(event)
        api_base_url = get_api_base_url(event)

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

        if method == "GET" and route_key == "GET /settings/image-generation":
            return ok(get_image_generation_settings_status(user_id))

        if method == "PUT" and route_key == "PUT /settings/image-generation":
            return ok(save_image_generation_settings(user_id, read_body(event)))

        if method == "GET" and route_key == "GET /sets":
            return ok(list_sets(user_id))

        if method == "GET" and route_key == "GET /set-shares":
            return ok(list_pending_set_shares(user_id))

        if method == "GET" and route_key == "GET /set-share-responses":
            return ok(list_set_share_responses(user_id))

        if method == "POST" and route_key == "POST /sets":
            return ok(save_set(user_id, read_body(event)), status=201)

        if method == "PUT" and route_key == "PUT /sets/{setCode}":
            set_code = event["pathParameters"]["setCode"]
            return ok(rename_set(user_id, set_code, read_body(event)))

        if method == "DELETE" and route_key == "DELETE /sets/{setCode}":
            set_code = event["pathParameters"]["setCode"]
            return ok(delete_set(user_id, set_code))

        if method == "PUT" and route_key == "PUT /sets/{setCode}/public":
            set_code = event["pathParameters"]["setCode"]
            return ok(make_set_public(user_id, set_code))

        if method == "POST" and route_key == "POST /sets/{setCode}/share":
            set_code = event["pathParameters"]["setCode"]
            return ok(share_set_with_user(user_id, user_email, api_base_url, set_code, read_body(event)), status=201)

        if method == "POST" and route_key == "POST /set-shares/{shareId}/accept":
            share_id = event["pathParameters"]["shareId"]
            return ok(accept_set_share(user_id, share_id, read_body(event), user_email, api_base_url))

        if method == "DELETE" and route_key == "DELETE /set-shares/{shareId}":
            share_id = event["pathParameters"]["shareId"]
            return ok(reject_set_share(user_id, share_id, user_email))

        if method == "POST" and route_key == "POST /sets/{setCode}/cards/reorder":
            set_code = event["pathParameters"]["setCode"]
            return ok(reorder_set_cards(user_id, set_code, read_body(event), user_email))

        if method == "GET" and route_key == "GET /cards":
            return ok(list_cards(user_id))

        if method == "GET" and route_key == "GET /cards/{cardId}/history":
            query = event.get("queryStringParameters") or {}
            limit = int(query["limit"]) if query.get("limit") else None
            return ok(list_card_history(user_id, event["pathParameters"]["cardId"], limit))

        if method == "GET" and route_key == "GET /cards/{cardId}":
            return ok(get_card(user_id, event["pathParameters"]["cardId"]))

        if method == "POST" and route_key == "POST /cards":
            return ok(save_card(user_id, read_body(event)), status=201)

        if method == "PUT" and route_key == "PUT /cards/{cardId}":
            return ok(save_card(user_id, read_body(event), event["pathParameters"]["cardId"], user_email))

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


def normalize_image_provider(provider):
    """Return a supported image provider id."""
    normalized_provider = str(provider or "openai").strip().lower()
    if normalized_provider not in IMAGE_PROVIDERS:
        raise ValueError("Image provider is not supported.")
    return normalized_provider


def get_setting_item(user_id, setting_key):
    """Return one stored user setting item."""
    response = USER_SETTINGS_TABLE.get_item(Key={"userId": user_id, "settingKey": setting_key})
    return response.get("Item")


def get_setting_encryption_context(user_id, setting_key):
    """Build the KMS encryption context for a user setting."""
    return {"userId": user_id, "settingKey": setting_key}


def encrypt_setting_secret(user_id, setting_key, secret):
    """Encrypt a user setting secret before storing it."""
    response = KMS.encrypt(
        KeyId=USER_SETTINGS_KEY_ID,
        Plaintext=secret.encode("utf-8"),
        EncryptionContext=get_setting_encryption_context(user_id, setting_key),
    )
    return base64.b64encode(response["CiphertextBlob"]).decode("ascii")


def decrypt_setting_secret(user_id, setting_key, ciphertext, label):
    """Decrypt a stored user setting secret."""
    try:
        encrypted_secret = base64.b64decode(str(ciphertext or ""), validate=True)
    except binascii.Error:
        raise ValueError(f"Saved {label} could not be decoded.")
    response = KMS.decrypt(
        CiphertextBlob=encrypted_secret,
        EncryptionContext=get_setting_encryption_context(user_id, setting_key),
    )
    return response["Plaintext"].decode("utf-8").strip()


def get_saved_image_provider(user_id):
    """Return the user's selected image generation provider."""
    item = get_setting_item(user_id, IMAGE_PROVIDER_SETTING) or {}
    return normalize_image_provider(item.get("provider") or "openai")


def save_image_provider(user_id, provider):
    """Persist the user's selected image generation provider."""
    normalized_provider = normalize_image_provider(provider)
    now = int(time.time())
    USER_SETTINGS_TABLE.put_item(Item={
        "userId": user_id,
        "settingKey": IMAGE_PROVIDER_SETTING,
        "provider": normalized_provider,
        "updatedAt": now,
    })
    return normalized_provider


def get_provider_label(provider):
    """Return the display label for an image provider."""
    return PROVIDER_LABELS[normalize_image_provider(provider)]


def get_provider_settings_key(provider):
    """Return the settings table key for provider-specific settings."""
    return f"{PROVIDER_SETTINGS_PREFIX}{normalize_image_provider(provider)}"


def get_provider_default_endpoint(provider):
    """Return the default provider endpoint when one exists."""
    return PROVIDER_DEFAULT_ENDPOINTS.get(normalize_image_provider(provider), "")


def get_provider_default_model(provider):
    """Return the default provider model when one exists."""
    return PROVIDER_DEFAULT_MODELS.get(normalize_image_provider(provider), "")


def provider_requires_api_key(provider):
    """Return whether a provider needs a stored user API key."""
    return normalize_image_provider(provider) != "aws"


def provider_requires_endpoint(provider):
    """Return whether a provider must have a user-supplied endpoint."""
    normalized_provider = normalize_image_provider(provider)
    return normalized_provider not in DIRECT_IMAGE_PROVIDERS and not get_provider_default_endpoint(normalized_provider)


def get_provider_settings_item(user_id, provider):
    """Return stored settings for one image provider."""
    normalized_provider = normalize_image_provider(provider)
    item = get_setting_item(user_id, get_provider_settings_key(normalized_provider))
    if item:
        return item
    if normalized_provider == "midjourney":
        return get_setting_item(user_id, MIDJOURNEY_SETTING)
    return None


def provider_item_has_api_key(item):
    """Return whether a settings item includes an API key secret."""
    return bool(item and (item.get("apiKeyCiphertext") or item.get("apiKey")))


def get_provider_api_key(user_id, provider):
    """Return a decrypted API key for one image provider."""
    normalized_provider = normalize_image_provider(provider)
    item = get_provider_settings_item(user_id, normalized_provider) or {}
    setting_key = item.get("settingKey") or get_provider_settings_key(normalized_provider)
    if item.get("apiKeyCiphertext"):
        return decrypt_setting_secret(
            user_id,
            setting_key,
            item["apiKeyCiphertext"],
            f"{get_provider_label(normalized_provider)} API key",
        )
    return str(item.get("apiKey") or "").strip()


def get_provider_settings(user_id, provider):
    """Return decrypted settings for one image provider."""
    normalized_provider = normalize_image_provider(provider)
    item = get_provider_settings_item(user_id, normalized_provider) or {}
    return {
        "endpointUrl": str(item.get("endpointUrl") or get_provider_default_endpoint(normalized_provider)).strip(),
        "apiKey": get_provider_api_key(user_id, normalized_provider),
        "modelId": str(item.get("modelId") or get_provider_default_model(normalized_provider)).strip(),
    }


def get_provider_settings_status(user_id, provider):
    """Return saved configuration status for one image provider."""
    normalized_provider = normalize_image_provider(provider)
    item = get_provider_settings_item(user_id, normalized_provider) or {}
    if normalized_provider == "openai":
        api_key_configured = get_openai_key_status(user_id)["configured"]
    else:
        api_key_configured = provider_item_has_api_key(item)

    requires_key = provider_requires_api_key(normalized_provider)
    requires_endpoint = provider_requires_endpoint(normalized_provider)
    saved_endpoint = str(item.get("endpointUrl") or "").strip()
    configured = (not requires_key or api_key_configured) and (not requires_endpoint or bool(saved_endpoint))
    return {
        "label": get_provider_label(normalized_provider),
        "configured": configured,
        "apiKeyConfigured": api_key_configured,
        "endpointUrl": saved_endpoint,
        "defaultEndpointUrl": get_provider_default_endpoint(normalized_provider),
        "modelId": str(item.get("modelId") or get_provider_default_model(normalized_provider)).strip(),
        "requiresApiKey": requires_key,
        "requiresEndpoint": requires_endpoint,
    }


def get_image_generation_settings_status(user_id):
    """Return image generation provider status for the signed-in user."""
    provider = get_saved_image_provider(user_id)
    providers = {
        provider_id: get_provider_settings_status(user_id, provider_id)
        for provider_id in PROVIDER_LABELS
    }
    selected = providers[provider]
    return {
        "provider": provider,
        "providerLabel": selected["label"],
        "providerConfigured": selected["configured"],
        "providerEndpointUrl": selected["endpointUrl"],
        "providerDefaultEndpointUrl": selected["defaultEndpointUrl"],
        "providerModelId": selected["modelId"],
        "providers": providers,
        "openAiConfigured": providers["openai"]["configured"],
        "midjourneyConfigured": providers["midjourney"]["configured"],
        "midjourneyEndpointUrl": providers["midjourney"]["endpointUrl"],
    }


def save_provider_settings(user_id, provider, body):
    """Store endpoint, model, and API key settings for one provider."""
    normalized_provider = normalize_image_provider(provider)
    setting_key = get_provider_settings_key(normalized_provider)
    existing_item = get_provider_settings_item(user_id, normalized_provider) or {}
    endpoint_url = str(body.get("providerEndpointUrl") or "").strip()
    api_key = str(body.get("providerApiKey") or "").strip()
    model_id = str(body.get("providerModelId") or "").strip()

    if normalized_provider == "midjourney":
        endpoint_url = endpoint_url or str(body.get("midjourneyEndpointUrl") or "").strip()
        api_key = api_key or str(body.get("midjourneyApiKey") or "").strip()
    if not endpoint_url:
        endpoint_url = str(existing_item.get("endpointUrl") or "").strip()
    if not model_id:
        model_id = str(existing_item.get("modelId") or get_provider_default_model(normalized_provider)).strip()
    if endpoint_url:
        validate_public_url(endpoint_url, f"{get_provider_label(normalized_provider)} endpoint URL")

    item = {
        "userId": user_id,
        "settingKey": setting_key,
        "provider": normalized_provider,
        "endpointUrl": endpoint_url,
        "modelId": model_id,
        "updatedAt": int(time.time()),
    }
    if api_key:
        item["apiKeyCiphertext"] = encrypt_setting_secret(user_id, setting_key, api_key)
    elif provider_item_has_api_key(existing_item):
        existing_api_key = get_provider_api_key(user_id, normalized_provider)
        if existing_api_key:
            item["apiKeyCiphertext"] = encrypt_setting_secret(user_id, setting_key, existing_api_key)
    USER_SETTINGS_TABLE.put_item(Item=item)
    return item


def ensure_provider_configured(user_id, provider):
    """Raise an error when the selected provider is missing required settings."""
    normalized_provider = normalize_image_provider(provider)
    status = get_provider_settings_status(user_id, normalized_provider)
    label = status["label"]
    if status["configured"]:
        return
    if status["requiresEndpoint"] and status["requiresApiKey"]:
        raise ValueError(f"Save a {label} endpoint and API key before selecting {label}.")
    if status["requiresEndpoint"]:
        raise ValueError(f"Save a {label} endpoint before selecting {label}.")
    if status["requiresApiKey"]:
        raise ValueError(f"Save a {label} API key before selecting {label}.")


def save_image_generation_settings(user_id, body):
    """Store image generation provider and API settings."""
    provider = normalize_image_provider(body.get("provider") or get_saved_image_provider(user_id))
    openai_key = str(body.get("openAiApiKey") or "").strip()
    provider_key = str(body.get("providerApiKey") or "").strip()
    if openai_key or (provider == "openai" and provider_key):
        save_openai_key(user_id, {"apiKey": openai_key or provider_key})
    if provider != "openai":
        save_provider_settings(user_id, provider, body)
    ensure_provider_configured(user_id, provider)
    save_image_provider(user_id, provider)
    return get_image_generation_settings_status(user_id)

def build_art_prompt(body):
    """Build the image prompt from the current card fields."""
    card_name = str(body.get("cardName") or "Untitled Card").strip() or "Untitled Card"
    flavor_text = str(body.get("flavorText") or "").strip()
    return f"{card_name}. If it were on a website, the caption would be \"{flavor_text}\". Don't put any text on the image itself."


def read_image_generation_error(exc):
    """Return the API error message from an image generation failure."""
    message = "Image generation failed."
    try:
        error_body = json.loads(exc.read().decode("utf-8"))
        error = error_body.get("error")
        errors = error_body.get("errors")
        if isinstance(error, dict):
            return error.get("message") or message
        if isinstance(error, str):
            return error
        if isinstance(errors, list) and errors:
            return "; ".join(str(item) for item in errors)
        return error_body.get("message") or message
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
        "size": "1536x1024",
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


def find_generated_image_value(value):
    """Find an image URL or base64 payload in a provider response."""
    if isinstance(value, str):
        value = value.strip()
        if value.startswith("http") or value.startswith("data:image/"):
            return value
        return ""
    if isinstance(value, list):
        for item in value:
            found = find_generated_image_value(item)
            if found:
                return found
    if isinstance(value, dict):
        base64_keys = {"b64_json", "base64", "imageBase64", "image_base64"}
        for key in ("imageUrl", "image_url", "url", "uri", "output", "images", "image", *base64_keys):
            raw_value = value.get(key)
            if key in base64_keys and isinstance(raw_value, str) and raw_value.strip():
                return raw_value.strip()
            found = find_generated_image_value(raw_value)
            if found:
                return found
        for item in value.values():
            found = find_generated_image_value(item)
            if found:
                return found
    return ""


def find_gemini_image_value(value):
    """Find Gemini Interactions image output data."""
    if isinstance(value, list):
        for item in value:
            found = find_gemini_image_value(item)
            if found:
                return found
    if isinstance(value, dict):
        for key in ("output_image", "outputImage", "inlineData", "inline_data"):
            raw_value = value.get(key)
            if isinstance(raw_value, dict):
                image_data = raw_value.get("data")
                if isinstance(image_data, str) and image_data.strip():
                    return image_data.strip()
            found = find_gemini_image_value(raw_value)
            if found:
                return found
        for item in value.values():
            found = find_gemini_image_value(item)
            if found:
                return found
    return ""


def decode_generated_image_value(image_value):
    """Decode or download an image value returned by an image provider."""
    if image_value.startswith("data:image/") and ";base64," in image_value:
        return decode_generated_image(image_value.split(",", 1)[1])
    if image_value.startswith("http"):
        return fetch_generated_image(image_value)
    return decode_generated_image(image_value)


def generate_gemini_image(prompt, settings):
    """Generate an image with the Google Gemini Interactions API."""
    api_key = settings.get("apiKey") or ""
    model_id = settings.get("modelId") or PROVIDER_DEFAULT_MODELS["gemini"]
    if not api_key:
        raise ValueError("Save a Google Gemini API key before generating images.")

    payload = json.dumps({
        "model": model_id,
        "input": [{"type": "text", "text": prompt}],
    }).encode("utf-8")
    request = Request(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        data=payload,
        headers={
            "x-goog-api-key": api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=50) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise ValueError(read_image_generation_error(exc))
    except (URLError, TimeoutError):
        raise ValueError("Google Gemini image service could not be reached.")
    image_value = find_gemini_image_value(data) or find_generated_image_value(data)
    if not image_value:
        raise ValueError("Google Gemini did not return image data.")
    return decode_generated_image_value(image_value)


def generate_aws_bedrock_image(prompt, settings):
    """Generate an image with AWS Bedrock Titan Image Generator."""
    model_id = settings.get("modelId") or PROVIDER_DEFAULT_MODELS["aws"]
    payload = json.dumps({
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {"text": prompt},
        "imageGenerationConfig": {
            "numberOfImages": 1,
            "height": 1024,
            "width": 1024,
            "cfgScale": 8.0,
            "seed": int(time.time()) % 2147483647,
        },
    })
    try:
        response = BEDROCK.invoke_model(
            body=payload,
            modelId=model_id,
            accept="application/json",
            contentType="application/json",
        )
    except ClientError as exc:
        message = exc.response.get("Error", {}).get("Message") or "AWS Bedrock image generation failed."
        raise ValueError(message)
    data = json.loads(response.get("body").read().decode("utf-8"))
    if data.get("error"):
        raise ValueError(f"AWS Bedrock image generation failed: {data['error']}")
    image_value = find_generated_image_value(data)
    if not image_value:
        raise ValueError("AWS Bedrock did not return image data.")
    return decode_generated_image_value(image_value)


def build_multipart_form_data(fields):
    """Build a small multipart form body for image provider uploads."""
    boundary = f"----carddesigner{uuid.uuid4().hex}"
    chunks = []
    for name, value in fields.items():
        chunks.append(
            (
                f"--{boundary}\\r\\n"
                f"Content-Disposition: form-data; name=\"{name}\"\\r\\n\\r\\n"
                f"{value}\\r\\n"
            ).encode("utf-8")
        )
    chunks.append(f"--{boundary}--\\r\\n".encode("utf-8"))
    return b"".join(chunks), boundary


def generate_stability_image(prompt, settings):
    """Generate an image with Stability AI's image API."""
    endpoint_url = settings.get("endpointUrl") or PROVIDER_DEFAULT_ENDPOINTS["stability"]
    api_key = settings.get("apiKey") or ""
    if not api_key:
        raise ValueError("Save a Stability AI API key before generating images.")
    validate_public_url(endpoint_url, "Stability AI endpoint URL")

    body, boundary = build_multipart_form_data({
        "prompt": prompt,
        "aspect_ratio": "3:2",
        "output_format": "png",
    })
    request = Request(
        endpoint_url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "image/*",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=50) as response:
            content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
            data = response.read(MAX_ART_IMAGE_BYTES + 1)
    except HTTPError as exc:
        raise ValueError(read_image_generation_error(exc))
    except (URLError, TimeoutError):
        raise ValueError("Stability AI image service could not be reached.")
    if content_type.startswith("image/"):
        if len(data) > MAX_ART_IMAGE_BYTES:
            raise ValueError("Generated image is larger than 7 MB.")
        return data
    image_value = find_generated_image_value(json.loads(data.decode("utf-8")))
    if not image_value:
        raise ValueError("Stability AI did not return image data.")
    return decode_generated_image_value(image_value)


def generate_external_provider_image(provider, prompt, settings):
    """Generate an image through a provider-compatible JSON endpoint."""
    label = get_provider_label(provider)
    endpoint_url = settings.get("endpointUrl") or ""
    api_key = settings.get("apiKey") or ""
    if not endpoint_url or not api_key:
        raise ValueError(f"Save a {label} endpoint and API key before generating images.")
    validate_public_url(endpoint_url, f"{label} endpoint URL")

    payload = {"prompt": prompt, "aspectRatio": "3:2"}
    if settings.get("modelId"):
        payload["model"] = settings["modelId"]
        payload["modelId"] = settings["modelId"]
    request = Request(
        endpoint_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=50) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise ValueError(read_image_generation_error(exc))
    except (URLError, TimeoutError):
        raise ValueError(f"{label} image service could not be reached.")
    image_value = find_generated_image_value(data)
    if not image_value:
        raise ValueError(f"{label} endpoint did not return an image URL or base64 image.")
    return decode_generated_image_value(image_value)


def generate_provider_image(user_id, body, prompt):
    """Generate image bytes with the selected provider."""
    provider = normalize_image_provider(body.get("provider") or get_saved_image_provider(user_id))
    if provider == "openai":
        return generate_openai_image(prompt, get_openai_api_key(user_id)), provider

    settings = get_provider_settings(user_id, provider)
    if provider == "gemini":
        return generate_gemini_image(prompt, settings), provider
    if provider == "aws":
        return generate_aws_bedrock_image(prompt, settings), provider
    if provider == "stability":
        return generate_stability_image(prompt, settings), provider
    return generate_external_provider_image(provider, prompt, settings), provider


def generate_art(user_id, body):
    """Generate card art, save it in S3, and return an authenticated app URL."""
    set_code = normalize_set_code(body.get("setCode"))
    validate_card_set(user_id, set_code)
    prompt = build_art_prompt(body)
    image_bytes, provider = generate_provider_image(user_id, body, prompt)
    art_key = get_art_key(user_id, set_code, body.get("cardName"), "image/png")
    S3.put_object(
        Bucket=ART_BUCKET_NAME,
        Key=art_key,
        Body=image_bytes,
        ContentType="image/png",
        ServerSideEncryption="AES256",
    )
    return {"artKey": art_key, "artUrl": f"/art?key={quote(art_key, safe='')}", "prompt": prompt, "provider": provider}


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


def validate_public_url(raw_url, label="URL"):
    """Validate that a URL is public HTTP(S) and not private-network hosted."""
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"Enter a valid {label}.")

    for result in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ValueError(f"{label.title()} host is not allowed.")


def validate_image_url(image_url):
    """Validate that an image URL is public HTTP(S) and not private-network hosted."""
    validate_public_url(image_url, "image URL")


def get_jwt_claims(event):
    """Extract authenticated Cognito claims from an API Gateway event."""
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )


def get_user_id(event):
    """Extract the authenticated Cognito user id from API Gateway claims."""
    user_id = get_jwt_claims(event).get("sub")
    if not user_id:
        raise PermissionError()
    return user_id


def get_user_email(event):
    """Extract the authenticated user's email from API Gateway claims."""
    return str(get_jwt_claims(event).get("email") or "").strip()


def get_api_base_url(event):
    """Build the API base URL from API Gateway request context."""
    request_context = event.get("requestContext", {})
    headers = {str(k).lower(): str(v) for k, v in (event.get("headers") or {}).items()}
    domain_name = str(request_context.get("domainName") or headers.get("host") or "").strip()
    if not domain_name:
        return ""

    forwarded_proto = str(headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    scheme = forwarded_proto or "https"
    if not forwarded_proto and (domain_name.startswith("localhost") or domain_name.startswith("127.0.0.1")):
        scheme = "http"
    if scheme not in {"http", "https"}:
        scheme = "https"

    stage = str(request_context.get("stage") or "").strip().strip("/")
    stage_path = "" if not stage or stage == "$default" else f"/{stage}"
    return f"{scheme}://{domain_name}{stage_path}"


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


def serialize_dynamodb_item(item):
    """Convert a Python mapping to DynamoDB's low-level item format."""
    return {key: DYNAMODB_SERIALIZER.serialize(value) for key, value in item.items()}


def format_change_labels(labels):
    """Join card field labels into a readable sentence fragment."""
    if len(labels) == 1:
        return labels[0]
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return f"{', '.join(labels[:-1])}, and {labels[-1]}"


def summarize_card_change(existing_card, updated_card, change_type):
    """Return changed field names and a human-readable update description.

    Args:
        existing_card: Card state immediately before the update.
        updated_card: New source-of-truth card state.
        change_type: Kind of update being recorded.
    """
    changed_fields = [
        field
        for field in CARD_HISTORY_FIELD_LABELS
        if existing_card.get(field) != updated_card.get(field)
    ]
    if change_type == "reorder":
        old_number = normalize_collector_number(existing_card.get("collectorNumber"))
        new_number = normalize_collector_number(updated_card.get("collectorNumber"))
        return changed_fields, f"Moved from collector number {old_number} to {new_number}."
    if not changed_fields:
        return changed_fields, "Saved card without field changes."

    labels = [CARD_HISTORY_FIELD_LABELS[field] for field in changed_fields]
    return changed_fields, f"Changed {format_change_labels(labels)}."


def build_card_history_item(user_id, existing_card, updated_card, change_type, changed_by):
    """Build a chronological snapshot record for a card update.

    Args:
        user_id: Authenticated owner of the card.
        existing_card: Card state immediately before the update.
        updated_card: New source-of-truth card state.
        change_type: Kind of update that produced the history record.
        changed_by: Email or identifier for the user making the change.
    """
    recorded_at_ns = time.time_ns()
    changed_fields, description = summarize_card_change(existing_card, updated_card, change_type)
    return {
        "cardKey": f"{user_id}#{existing_card['cardId']}",
        "versionId": f"{recorded_at_ns:020d}#{uuid.uuid4()}",
        "userId": user_id,
        "cardId": existing_card["cardId"],
        "recordedAt": recorded_at_ns // 1_000_000,
        "changedBy": str(changed_by or user_id),
        "changeType": change_type,
        "changedFields": changed_fields,
        "description": description,
        "snapshot": existing_card,
    }


def put_card_update_with_history(user_id, existing_card, updated_card, change_type, changed_by):
    """Atomically save a card update and its previous state.

    Args:
        user_id: Authenticated owner of the card.
        existing_card: Card state immediately before the update.
        updated_card: New source-of-truth card state.
        change_type: Kind of update being recorded.
        changed_by: Email or identifier for the user making the change.
    """
    history_item = build_card_history_item(
        user_id,
        existing_card,
        updated_card,
        change_type,
        changed_by,
    )
    DYNAMODB_CLIENT.transact_write_items(TransactItems=[
        {
            "Put": {
                "TableName": CARD_HISTORY_TABLE_NAME,
                "Item": serialize_dynamodb_item(history_item),
            },
        },
        {
            "Put": {
                "TableName": TABLE_NAME,
                "Item": serialize_dynamodb_item(updated_card),
            },
        },
    ])


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
    """Return all accepted sets owned by the user."""
    ensure_default_set_if_missing(user_id)
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    sets = [item for item in response.get("Items", []) if not item.get("pendingShare") and item.get("recordType") not in {"shareResponse", SHARE_REQUEST_RECORD, SHARE_EXPIRATION_NOTICE_RECORD}]
    sets.sort(key=lambda item: item.get("code", ""))
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
        "isPublic": bool(body.get("isPublic")),
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


def clear_set_cards_and_assets(user_id, set_code):
    """Delete every card and saved asset that belongs to a set."""
    deleted_cards = 0
    for card in get_cards_for_set(user_id, set_code):
        delete_card_art(card)
        delete_card_image(card)
        TABLE.delete_item(Key={"userId": user_id, "cardId": card["cardId"]})
        deleted_cards += 1
    return deleted_cards


def delete_set(user_id, set_code):
    """Delete a non-default set and every card/image in that set."""
    normalized_set_code = normalize_set_code(set_code)
    if normalized_set_code == DEFAULT_SET["code"]:
        raise ValueError("The default set cannot be deleted.")
    if not get_set(user_id, normalized_set_code):
        raise ValueError("Card set does not exist.")

    deleted_cards = clear_set_cards_and_assets(user_id, normalized_set_code)

    SETS_TABLE.delete_item(Key={"userId": user_id, "code": normalized_set_code})
    sync_user_bucket_public_policy(user_id)
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
    if item.get("isPublic"):
        sync_user_bucket_public_policy(user_id)
    return {"set": item}


def rename_set(user_id, set_code, body):
    """Change a set's display name without changing its code.

    Args:
        user_id: Authenticated Cognito user id.
        set_code: Stable code of the set to rename.
        body: Request body containing the new name.
    """
    normalized_set_code = normalize_set_code(set_code)
    name = str(body.get("name") or "").strip()
    if not name:
        raise ValueError("Set name is required.")

    try:
        response = SETS_TABLE.update_item(
            Key={"userId": user_id, "code": normalized_set_code},
            UpdateExpression="SET #name = :name",
            ExpressionAttributeNames={"#name": "name"},
            ExpressionAttributeValues={":name": name},
            ConditionExpression="attribute_exists(userId) AND attribute_exists(code)",
            ReturnValues="ALL_NEW",
        )
    except SETS_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        raise ValueError("Card set does not exist.")
    return {"set": response["Attributes"]}


def get_cognito_user_by_email(email):
    """Find a confirmed Cognito user by email address."""
    wanted_email = str(email or "").strip().lower()
    if not wanted_email or "@" not in wanted_email:
        raise ValueError("Enter the recipient user's email address.")

    response = COGNITO.list_users(
        UserPoolId=USER_POOL_ID,
        Filter=f'email = "{wanted_email}"',
        Limit=1,
    )
    users = response.get("Users", [])
    if not users:
        raise ValueError("No user with that email address was found.")

    attributes = {
        attribute["Name"]: attribute.get("Value", "")
        for attribute in users[0].get("Attributes", [])
    }
    recipient_user_id = attributes.get("sub")
    if not recipient_user_id:
        raise ValueError("That user account is missing an id.")
    return {"userId": recipient_user_id, "email": attributes.get("email", wanted_email)}


def get_shared_suffix(value, separator):
    """Return a base value and the next numeric suffix for a duplicate."""
    base_value, marker, suffix = str(value or "").rpartition(separator)
    if marker and base_value and suffix.isdigit():
        return base_value, int(suffix) + 1
    return str(value or ""), 2


def get_unique_shared_set_code(user_id, requested_code):
    """Return an unused recipient set code with an underscore-number suffix."""
    base_code = normalize_set_code(requested_code)
    response = SETS_TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="#code, pendingShare, recordType",
        ExpressionAttributeNames={"#code": "code"},
    )
    existing_codes = {
        normalize_set_code(item.get("code"))
        for item in response.get("Items", [])
        if not item.get("pendingShare") and item.get("recordType") not in {"shareResponse", SHARE_REQUEST_RECORD, SHARE_EXPIRATION_NOTICE_RECORD}
    }
    if base_code not in existing_codes:
        return base_code

    code_stem, start_index = get_shared_suffix(base_code, "_")
    for index in range(start_index, 1000):
        candidate = normalize_set_code(f"{code_stem}_{index}")
        if candidate not in existing_codes:
            return candidate
    raise ValueError("The recipient has too many sets with this code.")


def get_unique_shared_set_name(user_id, requested_name):
    """Return an unused recipient set name with a hyphen-number suffix."""
    base_name = str(requested_name or "Untitled Set").strip() or "Untitled Set"
    response = SETS_TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="#name, pendingShare, recordType",
        ExpressionAttributeNames={"#name": "name"},
    )
    existing_names = {
        str(item.get("name") or "").strip().casefold()
        for item in response.get("Items", [])
        if not item.get("pendingShare") and item.get("recordType") not in {"shareResponse", SHARE_REQUEST_RECORD, SHARE_EXPIRATION_NOTICE_RECORD}
    }
    if base_name.casefold() not in existing_names:
        return base_name

    name_stem, start_index = get_shared_suffix(base_name, "-")
    for index in range(start_index, 1000):
        candidate = f"{name_stem}-{index}"
        if candidate.casefold() not in existing_names:
            return candidate
    raise ValueError("The recipient has too many sets with this name.")


def get_set_share_conflicts(user_id, set_code, set_name):
    """Identify accepted recipient sets that collide with a shared set.

    Args:
        user_id: Recipient account to inspect.
        set_code: Requested source set code.
        set_name: Requested source set name.
    """
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    accepted_sets = [
        item
        for item in response.get("Items", [])
        if not item.get("pendingShare") and item.get("recordType") not in {"shareResponse", SHARE_REQUEST_RECORD, SHARE_EXPIRATION_NOTICE_RECORD}
    ]
    requested_code = normalize_set_code(set_code)
    requested_name = str(set_name or "").strip().casefold()
    return {
        "code": any(normalize_set_code(item.get("code")) == requested_code for item in accepted_sets),
        "name": bool(requested_name) and any(
            str(item.get("name") or "").strip().casefold() == requested_name
            for item in accepted_sets
        ),
    }


def get_pending_share_code(share_id):
    """Return the temporary set code used while a copied set awaits a decision."""
    return f"__PENDING_SHARE__{str(share_id).upper()}"


def get_share_request_code(share_id):
    """Return the sender-side key for an outgoing share request."""
    return f"__SHARE_REQUEST__{str(share_id).upper()}"


def get_share_expiration_notice_code(share_id):
    """Return the receiver-side key for an expiration notice."""
    return f"__SHARE_EXPIRATION__{str(share_id).upper()}"


def get_saved_art_key_from_url(art_url):
    """Return the private art bucket key from a saved /art URL when present."""
    parsed = urlparse(str(art_url or ""))
    if not parsed.path.rstrip("/").endswith("/art"):
        return ""
    query = parse_qs(parsed.query)
    return (query.get("key") or [""])[0].strip()


def get_shared_art_key(target_user_id, target_card, source_art_key):
    """Build a recipient-owned S3 art key while preserving the source extension."""
    extension = os.path.splitext(source_art_key)[1].lstrip(".").lower() or "png"
    if extension not in {"jpg", "jpeg", "png", "gif", "webp"}:
        extension = "png"
    content_type = "image/jpeg" if extension in {"jpg", "jpeg"} else f"image/{extension}"
    return get_art_key(target_user_id, target_card.get("setCode"), target_card.get("name"), content_type)


def get_shared_art_url(api_base_url, target_art_key):
    """Build the recipient art URL from the card designer API base URL."""
    encoded_key = quote(target_art_key, safe="")
    parsed = urlparse(str(api_base_url or "").strip())
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        base_path = parsed.path.rstrip("/")
        return f"{parsed.scheme}://{parsed.netloc}{base_path}/art?key={encoded_key}"
    return f"/art?key={encoded_key}"


def copy_shared_card_art(source_card, target_user_id, target_card, api_base_url=""):
    """Copy saved editable artwork into the recipient's private art prefix."""
    source_art_key = get_saved_art_key_from_url(source_card.get("artUrl"))
    if not source_art_key:
        return
    if not source_art_key.startswith(f"{get_art_user_prefix(source_card.get('userId', ''))}/"):
        return

    target_art_key = get_shared_art_key(target_user_id, target_card, source_art_key)
    S3.copy_object(
        Bucket=ART_BUCKET_NAME,
        Key=target_art_key,
        CopySource={"Bucket": ART_BUCKET_NAME, "Key": source_art_key},
        MetadataDirective="COPY",
        ServerSideEncryption="AES256",
    )
    target_card["artUrl"] = get_shared_art_url(api_base_url, target_art_key)


def relocate_shared_card_art(user_id, card, final_set_code, api_base_url):
    """Move pending shared artwork into the accepted set's final art path.

    Args:
        user_id: Recipient account that owns the copied artwork.
        card: Pending copied card whose artwork may need relocation.
        final_set_code: Final selected code for the accepted set.
        api_base_url: Public API base used to build the recipient art URL.
    """
    source_art_key = get_saved_art_key_from_url(card.get("artUrl"))
    if not source_art_key or not source_art_key.startswith(f"{get_art_user_prefix(user_id)}/"):
        return

    target_card = {**card, "setCode": final_set_code}
    target_art_key = get_shared_art_key(user_id, target_card, source_art_key)
    if source_art_key == target_art_key:
        return
    S3.copy_object(
        Bucket=ART_BUCKET_NAME,
        Key=target_art_key,
        CopySource={"Bucket": ART_BUCKET_NAME, "Key": source_art_key},
        MetadataDirective="COPY",
        ServerSideEncryption="AES256",
    )
    S3.delete_object(Bucket=ART_BUCKET_NAME, Key=source_art_key)
    card["artUrl"] = get_shared_art_url(api_base_url, target_art_key)


def delete_card_art(card):
    """Delete saved editable artwork for a card when it belongs to that user."""
    art_key = get_saved_art_key_from_url(card.get("artUrl"))
    if not art_key:
        return
    if not art_key.startswith(f"{get_art_user_prefix(card.get('userId', ''))}/"):
        return
    S3.delete_object(Bucket=ART_BUCKET_NAME, Key=art_key)


def delete_replaced_card_art(existing_card, updated_card):
    """Delete old saved artwork when a card no longer points at it."""
    old_art_key = get_saved_art_key_from_url(existing_card.get("artUrl"))
    new_art_key = get_saved_art_key_from_url(updated_card.get("artUrl"))
    if old_art_key and old_art_key != new_art_key:
        delete_card_art(existing_card)


def copy_shared_card_image(source_card, target_user_id, target_card):
    """Copy a rendered card PNG into the recipient user's bucket when present."""
    source_bucket = source_card.get("imageBucket")
    source_key = source_card.get("imageKey")
    if not source_bucket or not source_key:
        return

    target_bucket = ensure_user_bucket(target_user_id)
    target_key = get_card_image_key(target_card)
    S3.copy_object(
        Bucket=target_bucket,
        Key=target_key,
        CopySource={"Bucket": source_bucket, "Key": source_key},
        MetadataDirective="COPY",
        ServerSideEncryption="AES256",
    )
    target_card["imageBucket"] = target_bucket
    target_card["imageKey"] = target_key


def relocate_shared_card_image(card, final_set_code):
    """Move a pending copied card PNG into its accepted set image path."""
    source_bucket = card.get("imageBucket")
    source_key = card.get("imageKey")
    if not source_bucket or not source_key:
        return

    target_card = {**card, "setCode": final_set_code}
    target_key = get_card_image_key(target_card)
    if source_key == target_key:
        return
    S3.copy_object(
        Bucket=source_bucket,
        Key=target_key,
        CopySource={"Bucket": source_bucket, "Key": source_key},
        MetadataDirective="COPY",
        ServerSideEncryption="AES256",
    )
    S3.delete_object(Bucket=source_bucket, Key=source_key)
    card["imageKey"] = target_key


def finalize_pending_share_card(user_id, card, final_set_code, api_base_url):
    """Promote one pending copied card into the accepted recipient set.

    Args:
        user_id: Recipient account that owns the accepted card.
        card: Pending copied card to finalize.
        final_set_code: Final selected code for the accepted set.
        api_base_url: Public API base used to rebuild saved art URLs.
    """
    relocate_shared_card_art(user_id, card, final_set_code, api_base_url)
    relocate_shared_card_image(card, final_set_code)
    card["setCode"] = final_set_code
    for field in {"pendingShare", "shareId", "senderUserId", "senderEmail", "originalCardId", "expiresAt"}:
        card.pop(field, None)
    TABLE.put_item(Item=card)


def build_accepted_set(card_set, user_id, final_set_code, final_set_name):
    """Build the accepted recipient set record from a pending copied set.

    Args:
        card_set: Pending copied set containing source properties and share metadata.
        user_id: Recipient account that will own the accepted set.
        final_set_code: Chosen final code for the accepted set.
        final_set_name: Chosen final name for the accepted set.
    """
    share_fields = {
        "userId",
        "code",
        "isPublic",
        "pendingShare",
        "shareId",
        "senderUserId",
        "senderEmail",
        "recipientEmail",
        "originalSetCode",
        "requestedSetCode",
        "requestedSetName",
        "sharedAt",
        "expiresAt",
    }
    accepted_set = {key: value for key, value in card_set.items() if key not in share_fields}
    accepted_set.update({
        "userId": user_id,
        "code": final_set_code,
        "name": final_set_name,
        "isPublic": False,
    })
    return accepted_set


def share_set_with_user(sender_user_id, sender_email, api_base_url, set_code, body):
    """Preview or copy a set into another user's pending shares.

    Args:
        sender_user_id: Authenticated owner of the source set.
        sender_email: Email address shown to the receiving user.
        api_base_url: API base used for copied private art URLs.
        set_code: Source set code requested for copying.
        body: Recipient email and optional preview flag.
    """
    recipient = get_cognito_user_by_email(body.get("recipientEmail"))
    if recipient["userId"] == sender_user_id:
        raise ValueError("Choose another user to share this set with.")

    source_set_code = normalize_set_code(set_code)
    source_set = get_set(sender_user_id, source_set_code)
    if not source_set or source_set.get("pendingShare"):
        raise ValueError("Card set does not exist.")

    requested_set_name = str(source_set.get("name") or "Untitled Set").strip() or "Untitled Set"
    conflicts = get_set_share_conflicts(recipient["userId"], source_set_code, requested_set_name)
    if body.get("preview"):
        return {"recipientEmail": recipient["email"], "conflicts": conflicts}

    share_id = str(uuid.uuid4())
    pending_set_code = get_pending_share_code(share_id)
    now = int(time.time())
    target_set = {
        key: value
        for key, value in source_set.items()
        if key not in {"userId", "code", "isPublic", "pendingShare", "shareId"}
    }
    target_set.update({
        "userId": recipient["userId"],
        "code": pending_set_code,
        "isPublic": False,
        "pendingShare": True,
        "shareId": share_id,
        "senderUserId": sender_user_id,
        "senderEmail": sender_email or sender_user_id,
        "recipientEmail": recipient["email"],
        "originalSetCode": source_set_code,
        "requestedSetCode": source_set_code,
        "requestedSetName": requested_set_name,
        "sharedAt": now,
        "expiresAt": now + SET_SHARE_EXPIRATION_SECONDS,
    })
    SETS_TABLE.put_item(Item=target_set)

    api_base_url = str(api_base_url or body.get("apiBaseUrl") or "").strip()
    copied_cards = 0
    for source_card in get_cards_for_set(sender_user_id, source_set_code):
        target_card = {
            key: value
            for key, value in source_card.items()
            if key not in {"userId", "cardId", "setCode", "imageBucket", "imageKey", "imageUrl", "publicImageUrl"}
        }
        target_card.update({
            "userId": recipient["userId"],
            "cardId": str(uuid.uuid4()),
            "setCode": pending_set_code,
            "pendingShare": True,
            "shareId": share_id,
            "senderUserId": sender_user_id,
            "senderEmail": sender_email or sender_user_id,
            "originalCardId": source_card.get("cardId", ""),
            "createdAt": now,
            "updatedAt": now,
            "expiresAt": now + SET_SHARE_EXPIRATION_SECONDS,
        })
        copy_shared_card_art(source_card, recipient["userId"], target_card, api_base_url)
        copy_shared_card_image(source_card, recipient["userId"], target_card)
        TABLE.put_item(Item=target_card)
        copied_cards += 1

    expiration = now + SET_SHARE_EXPIRATION_SECONDS
    SETS_TABLE.put_item(Item={
        "userId": sender_user_id,
        "code": get_share_request_code(share_id),
        "recordType": SHARE_REQUEST_RECORD,
        "shareId": share_id,
        "senderUserId": sender_user_id,
        "recipientUserId": recipient["userId"],
        "recipientEmail": recipient["email"],
        "originalSetCode": source_set_code,
        "requestedSetName": requested_set_name,
        "sharedAt": now,
        "shareExpiresAt": expiration,
    })
    SETS_TABLE.put_item(Item={
        "userId": recipient["userId"],
        "code": get_share_expiration_notice_code(share_id),
        "recordType": SHARE_EXPIRATION_NOTICE_RECORD,
        "shareId": share_id,
        "senderUserId": sender_user_id,
        "senderEmail": sender_email or sender_user_id,
        "recipientEmail": recipient["email"],
        "originalSetCode": source_set_code,
        "requestedSetName": requested_set_name,
        "shareExpiresAt": expiration,
    })

    return {"shareId": share_id, "set": target_set, "cardsCopied": copied_cards, "conflicts": conflicts}


def get_set_share_expiration(item):
    """Return the expiration timestamp, including a fallback for older shares."""
    try:
        expires_at = int(item.get("expiresAt") or 0)
        if expires_at:
            return expires_at
        return int(item.get("sharedAt") or 0) + SET_SHARE_EXPIRATION_SECONDS
    except (TypeError, ValueError):
        return 0


def is_expired_set_share(item, now=None):
    """Return true when a pending set copy is no longer actionable."""
    current_time = int(now if now is not None else time.time())
    expiration = get_set_share_expiration(item)
    return bool(expiration and expiration <= current_time)


def is_expired_share_notice(item, now=None):
    """Return whether a receiver-side expiration notice is ready to show."""
    current_time = int(now if now is not None else time.time())
    try:
        expiration = int(item.get("shareExpiresAt") or 0)
        return bool(expiration and expiration <= current_time)
    except (TypeError, ValueError):
        return False


def delete_expired_set_share(user_id, card_set):
    """Delete an expired pending set, its copied cards, and saved assets."""
    record_set_share_response(
        card_set,
        card_set.get("recipientEmail"),
        "expired",
        require_tracking=bool(card_set.get("expiresAt")),
    )
    clear_set_cards_and_assets(user_id, card_set["code"])
    SETS_TABLE.delete_item(Key={"userId": user_id, "code": card_set["code"]})


def list_pending_set_shares(user_id):
    """Return incoming pending set copies and expiration notices."""
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    items = response.get("Items", [])
    shares = []
    expired_shares = []
    expired_share_ids = set()

    # Handle outgoing expiration notices
    for item in items:
        if not item.get("pendingShare") or not item.get("shareId"):
            continue
        requested_set_code = item.get("requestedSetCode") or item.get("originalSetCode") or item.get("code", "")
        requested_set_name = item.get("requestedSetName") or item.get("name", "Untitled Set")
        if is_expired_set_share(item):
            expired_share_ids.add(item["shareId"])
            expired_shares.append({
                "shareId": item["shareId"],
                "setCode": requested_set_code,
                "setName": requested_set_name,
                "senderEmail": item.get("senderEmail", "another user"),
            })
            delete_expired_set_share(user_id, item)
            continue

        shares.append({
            "shareId": item.get("shareId", ""),
            "setCode": requested_set_code,
            "setName": requested_set_name,
            "senderEmail": item.get("senderEmail", "another user"),
            "conflicts": get_set_share_conflicts(user_id, requested_set_code, requested_set_name),
        })

    # Loop again, this time handling incoming expiration notices
    for item in items:
        if item.get("recordType") != SHARE_EXPIRATION_NOTICE_RECORD or not item.get("shareId"):
            continue
        if item["shareId"] in expired_share_ids or not is_expired_share_notice(item):
            continue
        expired_share_ids.add(item["shareId"])
        expired_shares.append({
            "shareId": item["shareId"],
            "setCode": item.get("originalSetCode", "DEFAULT"),
            "setName": item.get("requestedSetName", "Untitled Set"),
            "senderEmail": item.get("senderEmail", "another user"),
        })
        record_set_share_response(item, item.get("recipientEmail"), "expired", require_tracking=True)
        SETS_TABLE.delete_item(Key={"userId": user_id, "code": item["code"]})

    shares.sort(key=lambda item: (item.get("setName", ""), item.get("senderEmail", "")))
    return {"shares": shares, "expiredShares": expired_shares}


def record_set_share_response(
    card_set,
    recipient_email,
    decision,
    remove_recipient_notice=True,
    require_tracking=False,
):
    """Store a recipient's set-share decision for the sending user.

    Args:
        card_set: Share record containing sender and recipient metadata.
        recipient_email: Email address of the user who responded.
        decision: Either accepted, rejected, or expired.
        remove_recipient_notice: Whether to clear the receiver's expiration notice.
        require_tracking: Whether an active sender tracking record is required.
    """
    sender_user_id = str(card_set.get("senderUserId") or "").strip()
    share_id = str(card_set.get("shareId") or "").strip()
    if not sender_user_id or not share_id:
        return

    recipient_user_id = str(
        card_set.get("recipientUserId") or card_set.get("userId") or ""
    ).strip()
    if require_tracking:
        tracking = SETS_TABLE.get_item(
            Key={"userId": sender_user_id, "code": get_share_request_code(share_id)}
        ).get("Item")
        if not tracking:
            if remove_recipient_notice and recipient_user_id:
                SETS_TABLE.delete_item(
                    Key={"userId": recipient_user_id, "code": get_share_expiration_notice_code(share_id)}
                )
            return

    SETS_TABLE.delete_item(Key={"userId": sender_user_id, "code": get_share_request_code(share_id)})
    if remove_recipient_notice and recipient_user_id:
        SETS_TABLE.delete_item(
            Key={"userId": recipient_user_id, "code": get_share_expiration_notice_code(share_id)}
        )

    response_item = {
        "userId": sender_user_id,
        "code": f"__SHARE_RESPONSE__{share_id}",
        "recordType": "shareResponse",
        "shareId": share_id,
        "setCode": card_set.get("originalSetCode") or card_set.get("code") or "DEFAULT",
        "setName": card_set.get("requestedSetName") or card_set.get("name") or "Untitled Set",
        "recipientEmail": recipient_email or card_set.get("recipientEmail") or "another user",
        "response": decision,
        "respondedAt": int(time.time()),
    }
    SETS_TABLE.put_item(Item=response_item)


def list_set_share_responses(user_id):
    """Return and consume unviewed set-share decisions for the signed-in user."""
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    for item in response.get("Items", []):
        if item.get("recordType") == SHARE_REQUEST_RECORD and is_expired_share_notice(item):
            record_set_share_response(
                item,
                item.get("recipientEmail"),
                "expired",
                remove_recipient_notice=False,
            )

    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    response_items = [
        item for item in response.get("Items", []) if item.get("recordType") == "shareResponse"
    ]
    response_items.sort(key=lambda item: item.get("respondedAt", 0))
    responses = [
        {
            "shareId": item.get("shareId", ""),
            "setCode": item.get("setCode", "DEFAULT"),
            "setName": item.get("setName", "Untitled Set"),
            "recipientEmail": item.get("recipientEmail", "another user"),
            "response": item.get("response", "rejected"),
        }
        for item in response_items
    ]
    for item in response_items:
        SETS_TABLE.delete_item(Key={"userId": user_id, "code": item["code"]})
    return {"responses": responses}


def get_pending_share_set(user_id, share_id):
    """Return the pending set record for a share id."""
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    for item in response.get("Items", []):
        if item.get("pendingShare") and item.get("shareId") == share_id:
            if is_expired_set_share(item):
                delete_expired_set_share(user_id, item)
                raise ValueError("This set copy request has expired.")
            return item
    raise ValueError("Shared set was not found.")


def accept_set_share(user_id, share_id, body, recipient_email, api_base_url):
    """Accept a pending copied set using the recipient's conflict choices.

    Args:
        user_id: Authenticated recipient user id.
        share_id: Pending set-share identifier.
        body: Recipient code and name conflict choices.
        recipient_email: Email address of the responding recipient.
        api_base_url: Public API base used to rebuild saved art URLs.
    """
    card_set = get_pending_share_set(user_id, share_id)
    requested_set_code = normalize_set_code(
        card_set.get("requestedSetCode") or card_set.get("originalSetCode") or card_set.get("code")
    )
    requested_set_name = str(
        card_set.get("requestedSetName") or card_set.get("name") or "Untitled Set"
    ).strip() or "Untitled Set"
    conflicts = get_set_share_conflicts(user_id, requested_set_code, requested_set_name)

    code_resolution = str(body.get("codeResolution") or "").strip().lower()
    if conflicts["code"]:
        if code_resolution == "overwrite":
            final_set_code = requested_set_code
        elif code_resolution == "new":
            final_set_code = get_unique_shared_set_code(user_id, requested_set_code)
        else:
            raise ValueError("Choose whether to overwrite or create a new set code.")
    else:
        final_set_code = requested_set_code

    if conflicts["code"] and code_resolution == "overwrite":
        final_set_name = requested_set_name
    else:
        name_resolution = str(body.get("nameResolution") or "").strip().lower()
        if conflicts["name"]:
            if name_resolution == "keep":
                final_set_name = requested_set_name
            elif name_resolution == "new":
                final_set_name = get_unique_shared_set_name(user_id, requested_set_name)
            else:
                raise ValueError("Choose whether to keep or create a new set name.")
        else:
            final_set_name = requested_set_name

    if conflicts["code"] and code_resolution == "overwrite":
        clear_set_cards_and_assets(user_id, final_set_code)

    pending_cards = [
        card for card in get_cards_for_set(user_id, card_set["code"])
        if card.get("shareId") == share_id
    ]
    for card in pending_cards:
        finalize_pending_share_card(user_id, card, final_set_code, api_base_url)

    accepted_set = build_accepted_set(card_set, user_id, final_set_code, final_set_name)
    if conflicts["code"] and code_resolution == "overwrite":
        SETS_TABLE.put_item(Item=accepted_set)
    else:
        try:
            SETS_TABLE.put_item(
                Item=accepted_set,
                ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(code)",
            )
        except SETS_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
            raise ValueError("That set code was claimed while this copy was being accepted.")

    SETS_TABLE.delete_item(Key={"userId": user_id, "code": card_set["code"]})
    sync_user_bucket_public_policy(user_id)
    record_set_share_response(card_set, recipient_email, "accepted")
    return {"accepted": True, "set": accepted_set}


def reject_set_share(user_id, share_id, recipient_email):
    """Delete a pending shared set copy and its copied cards.

    Args:
        user_id: Authenticated recipient user id.
        share_id: Pending set-share identifier.
        recipient_email: Email address of the responding recipient.
    """
    card_set = get_pending_share_set(user_id, share_id)
    deleted_cards = clear_set_cards_and_assets(user_id, card_set["code"])
    SETS_TABLE.delete_item(Key={"userId": user_id, "code": card_set["code"]})
    record_set_share_response(card_set, recipient_email, "rejected")
    return {"rejected": True, "shareId": share_id, "deletedCards": deleted_cards}


def make_set_public(user_id, set_code):
    """Mark a user's set as public and return the updated record."""
    normalized_set_code = normalize_set_code(set_code)
    ensure_default_set_if_missing(user_id)
    if not get_set(user_id, normalized_set_code):
        raise ValueError("Card set does not exist.")

    response = SETS_TABLE.update_item(
        Key={"userId": user_id, "code": normalized_set_code},
        UpdateExpression="SET isPublic = :isPublic",
        ExpressionAttributeValues={":isPublic": True},
        ReturnValues="ALL_NEW",
    )
    sync_user_bucket_public_policy(user_id)
    return {"set": response.get("Attributes", {})}


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


def get_card_public_image_url(card):
    """Return a durable public S3 URL for a card PNG."""
    bucket_name = card.get("imageBucket")
    image_key = card.get("imageKey")
    if not bucket_name or not image_key:
        return ""
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "us-east-1"
    return f"https://{bucket_name}.s3.{region}.amazonaws.com/{quote(image_key, safe='/')}"


def get_card_signed_image_url(card):
    """Return a short-lived signed S3 URL for a saved card PNG."""
    bucket_name = card.get("imageBucket")
    image_key = card.get("imageKey")
    if not bucket_name or not image_key:
        return ""
    return S3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket_name, "Key": image_key},
        ExpiresIn=900,
    )


def add_card_image_urls(cards, public_set_codes=None):
    """Attach public or signed S3 URLs to card summaries with saved PNGs."""
    public_set_codes = {normalize_set_code(code) for code in (public_set_codes or set())}
    for card in cards:
        if not card.get("imageBucket") or not card.get("imageKey"):
            continue
        if normalize_set_code(card.get("setCode")) in public_set_codes:
            card["publicImageUrl"] = get_card_public_image_url(card)
            card["imageUrl"] = card["publicImageUrl"]
        else:
            card["imageUrl"] = get_card_signed_image_url(card)
    return cards


def public_set_summary(card_set):
    """Return public-safe display fields for a set."""
    return {
        "code": card_set.get("code", ""),
        "name": card_set.get("name", ""),
        "symbol": card_set.get("symbol", ""),
        "copyrightInfo": card_set.get("copyrightInfo", ""),
        "isPublic": bool(card_set.get("isPublic")),
    }


def public_card_summary(card):
    """Return public-safe display fields for a card."""
    return {
        "cardId": card.get("cardId", ""),
        "name": card.get("name", "Untitled Card"),
        "collectorNumber": normalize_collector_number(card.get("collectorNumber")),
        "imageUrl": get_card_public_image_url(card),
        "publicImageUrl": get_card_public_image_url(card),
    }


def find_public_set(user_id, set_identifier):
    """Find a public set by code or name for a user."""
    response = SETS_TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    wanted = str(set_identifier or "").strip().casefold()
    for card_set in response.get("Items", []):
        set_code = str(card_set.get("code") or "").casefold()
        set_name = str(card_set.get("name") or "").casefold()
        if wanted in {set_code, set_name}:
            return card_set
    return None


def get_public_cards(user_id, set_code):
    """Return public card summaries for one set, ordered by collector number."""
    normalized_set_code = normalize_set_code(set_code)
    response = TABLE.query(KeyConditionExpression=Key("userId").eq(user_id))
    cards = [
        item
        for item in response.get("Items", [])
        if (item.get("setCode") or DEFAULT_SET["code"]) == normalized_set_code
    ]
    cards.sort(key=lambda card: (normalize_collector_number(card.get("collectorNumber")), card.get("name", "")))
    return [public_card_summary(card) for card in cards]


def get_public_set(event):
    """Return one opted-in public set and its public card gallery data."""
    params = event.get("queryStringParameters") or {}
    user_id = str(params.get("user") or "").strip()
    set_identifier = str(params.get("set") or params.get("setName") or "").strip()
    if not user_id or not set_identifier:
        raise ValueError("Public set links require user and set parameters.")

    card_set = find_public_set(user_id, set_identifier)
    if not card_set or not card_set.get("isPublic"):
        raise ValueError("Public set was not found.")

    sync_user_bucket_public_policy(user_id)
    return {
        "set": public_set_summary(card_set),
        "cards": get_public_cards(user_id, card_set["code"]),
    }


def list_cards(user_id):
    """Return saved card summaries ordered by set and collector number."""
    ensure_default_set_if_missing(user_id)
    backfill_card_set_codes(user_id)
    response = TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="userId, cardId, #name, #type, sub_type, rarity, setCode, collectorNumber, imageBucket, imageKey, updatedAt, pendingShare",
        ExpressionAttributeNames={"#name": "name", "#type": "type"},
    )
    cards = [card for card in response.get("Items", []) if not card.get("pendingShare")]
    cards.sort(key=lambda card: (card.get("setCode") or DEFAULT_SET["code"], normalize_collector_number(card.get("collectorNumber")), card.get("name", "")))
    public_set_codes = get_public_set_codes(user_id)
    if public_set_codes:
        sync_user_bucket_public_policy(user_id, public_set_codes)
    return {"cards": add_card_image_urls(cards, public_set_codes)}


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


def list_card_history(user_id, card_id, limit=None):
    """Return stored card changes from newest to oldest.

    Args:
        user_id: Authenticated owner of the card.
        card_id: Card whose history should be returned.
        limit: Optional maximum number of newest records to return.
    """
    query_options = {
        "KeyConditionExpression": Key("cardKey").eq(f"{user_id}#{card_id}"),
        "ScanIndexForward": False,
    }
    if limit is not None:
        if limit <= 0:
            raise ValueError("History limit must be positive.")
        query_options["Limit"] = limit

    history_items = []
    while True:
        response = CARD_HISTORY_TABLE.query(**query_options)
        history_items.extend(response.get("Items", []))
        if limit is not None or not response.get("LastEvaluatedKey"):
            break
        query_options["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return {
        "history": [
            {
                "versionId": item.get("versionId", ""),
                "recordedAt": item.get("recordedAt", 0),
                "changedBy": item.get("changedBy") or item.get("userId") or "Unknown user",
                "description": item.get("description") or "Updated card.",
                "changeType": item.get("changeType", "update"),
            }
            for item in history_items
        ],
    }


def reorder_set_cards(user_id, set_code, body, changed_by):
    """Persist drag/drop ordering and collector numbers for every card in a set.

    Args:
        user_id: Authenticated Cognito user id.
        set_code: Set whose cards are being reordered.
        body: Request body containing the complete ordered card id list.
        changed_by: Email or identifier for the user making the change.
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
        existing_card = cards_in_set[card_id]
        if normalize_collector_number(existing_card.get("collectorNumber")) == index:
            continue
        updated_card = {**existing_card, "collectorNumber": index, "updatedAt": now}
        put_card_update_with_history(user_id, existing_card, updated_card, "reorder", changed_by)
        cards_in_set[card_id] = updated_card

    reordered_cards = [cards_in_set[card_id] for card_id in card_ids]
    return {"cards": add_card_image_urls(reordered_cards, get_public_set_codes(user_id))}


def get_user_bucket_name(user_id):
    digest = hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:24]
    return f"{USER_BUCKET_PREFIX}-{digest}".lower()


def get_public_set_codes(user_id):
    """Return the set codes the user has made public."""
    response = SETS_TABLE.query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ProjectionExpression="#code, isPublic",
        ExpressionAttributeNames={"#code": "code"},
    )
    return {
        normalize_set_code(item.get("code"))
        for item in response.get("Items", [])
        if item.get("isPublic")
    }


def set_user_bucket_public_policy_block(bucket_name, allow_public_policy):
    """Toggle bucket-level public policy support without using public ACLs."""
    S3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": not allow_public_policy,
            "RestrictPublicBuckets": not allow_public_policy,
        },
    )


def build_public_set_bucket_policy(bucket_name, public_set_codes):
    """Build an S3 bucket policy for public card PNG prefixes only."""
    resources = [
        f"arn:aws:s3:::{bucket_name}/{safe_s3_key_part(code, DEFAULT_SET['code'])}/*"
        for code in sorted(public_set_codes)
    ]
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadPublicCardSets",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": resources,
            }
        ],
    }


def sync_user_bucket_public_policy(user_id, public_set_codes=None):
    """Publish only public set image prefixes and keep other card images private."""
    public_set_codes = public_set_codes if public_set_codes is not None else get_public_set_codes(user_id)
    bucket_name = ensure_user_bucket(user_id)
    if not public_set_codes:
        try:
            S3.delete_bucket_policy(Bucket=bucket_name)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "NoSuchBucketPolicy":
                raise
        set_user_bucket_public_policy_block(bucket_name, False)
        return

    set_user_bucket_public_policy_block(bucket_name, True)
    S3.put_bucket_policy(
        Bucket=bucket_name,
        Policy=json.dumps(build_public_set_bucket_policy(bucket_name, public_set_codes)),
    )


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


def save_card(user_id, body, card_id=None, changed_by=""):
    """Create or update a card record and its rendered PNG.

    Args:
        user_id: Authenticated Cognito user id.
        body: Card request payload.
        card_id: Existing card id when updating.
        changed_by: Email or identifier for the user making the change.
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

    if existing_item:
        put_card_update_with_history(user_id, existing_item, item, "update", changed_by)
    else:
        TABLE.put_item(Item=item)

    if existing_item:
        delete_replaced_card_art(existing_item, item)

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
        delete_card_art(item)
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
