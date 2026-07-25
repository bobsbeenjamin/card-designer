"""Provision a user confirmed in the native-username Cognito pool."""

from post_confirmation import provision_user


def handler(event, _context):
    return provision_user(event, event.get("userName"))
