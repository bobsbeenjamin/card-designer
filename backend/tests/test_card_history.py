import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

import boto3


ENVIRONMENT = {
    "TABLE_NAME": "cards",
    "CARD_HISTORY_TABLE_NAME": "history",
    "SETS_TABLE_NAME": "sets",
    "TEMPLATES_TABLE_NAME": "templates",
    "USER_SETTINGS_TABLE_NAME": "settings",
    "USERS_TABLE_NAME": "users",
    "USER_BUCKET_PREFIX": "users",
    "FRIENDS_TABLE_NAME": "friends",
    "ART_BUCKET_NAME": "art",
    "USER_SETTINGS_KEY_ID": "key",
    "USER_POOL_ID": "pool",
}


class BootstrapDynamoResource:
    def Table(self, _name):
        return MagicMock()


def load_cards_module():
    module_path = Path(__file__).parents[1] / "src" / "cards.py"
    spec = importlib.util.spec_from_file_location("cards_under_test", module_path)
    module = importlib.util.module_from_spec(spec)
    with (
        patch.dict(os.environ, ENVIRONMENT, clear=False),
        patch.object(boto3, "resource", return_value=BootstrapDynamoResource()),
        patch.object(boto3, "client", return_value=MagicMock()),
    ):
        spec.loader.exec_module(module)
    return module


cards = load_cards_module()


def card(name, updated_at):
    return {
        "userId": "user-1",
        "cardId": "card-1",
        "name": name,
        "setCode": "DEFAULT",
        "collectorNumber": 1,
        "artFit": "cover",
        "frameFit": "fill",
        "createdAt": 10,
        "updatedAt": updated_at,
        "imageBucket": "preview-bucket",
        "imageKey": f"DEFAULT/{name}.png",
    }


class CardHistoryTests(unittest.TestCase):
    def test_full_history_identifies_current_and_original_versions(self):
        history_items = [
            {
                "versionId": "0002#newer",
                "recordedAt": 30_000,
                "snapshot": card("Previous", 20),
                "changedBy": "user@example.com",
                "description": "Changed name.",
                "changedFields": ["name"],
                "changes": [],
                "oldValues": {"name": "Previous"},
                "newValues": {"name": "Current"},
            },
            {
                "versionId": "0001#original",
                "recordedAt": 20_000,
                "snapshot": card("Original", 10),
                "changedBy": "user@example.com",
                "description": "Changed name.",
                "changedFields": ["name"],
                "changes": [],
                "oldValues": {"name": "Original"},
                "newValues": {"name": "Previous"},
            },
        ]
        history_table = MagicMock()
        history_table.query.return_value = {"Items": history_items}
        current_table = MagicMock()
        current_table.get_item.return_value = {"Item": card("Current", 30)}

        with patch.multiple(cards, CARD_HISTORY_TABLE=history_table, TABLE=current_table):
            result = cards.list_card_history("user-1", "card-1")

        versions = result["history"]
        self.assertEqual(len(versions), 3)
        self.assertTrue(versions[0]["isCurrent"])
        self.assertEqual(versions[0]["restoreVersionId"], "")
        self.assertEqual(versions[1]["restoreVersionId"], "0002#newer")
        self.assertEqual(versions[2]["description"], "Original saved version.")
        self.assertEqual(versions[2]["restoreVersionId"], "0001#original")

    def test_full_history_exposes_restore_source_metadata(self):
        restore_item = {
            "versionId": "0003#restore",
            "recordedAt": 40_000,
            "snapshot": card("Before restore", 30),
            "changedBy": "user@example.com",
            "changeType": "restore",
            "description": "Restored card from a previous version.",
            "restoredFromVersionId": "0001#original",
            "restoredFromRecordedAt": 10_000,
            "changedFields": ["name"],
            "changes": [],
            "oldValues": {"name": "Before restore"},
            "newValues": {"name": "Original"},
        }
        history_table = MagicMock()
        history_table.query.return_value = {"Items": [restore_item]}
        current_table = MagicMock()
        current_table.get_item.return_value = {"Item": card("Original", 40)}

        with patch.multiple(cards, CARD_HISTORY_TABLE=history_table, TABLE=current_table):
            result = cards.list_card_history("user-1", "card-1")

        current_version = result["history"][0]
        self.assertEqual(current_version["changeType"], "restore")
        self.assertEqual(current_version["restoredFromVersionId"], "0001#original")
        self.assertEqual(current_version["restoredFromRecordedAt"], 10_000)

    def test_restore_replaces_card_and_preserves_history_as_new_revision(self):
        current_card = {**card("Current", 30), "abilities": "Current text"}
        target_history = {
            "versionId": "0002#target",
            "recordedAt": 20_000,
            "snapshot": {**card("Previous", 20), "abilities": ""},
        }
        current_table = MagicMock()
        current_table.get_item.return_value = {"Item": current_card}
        history_table = MagicMock()
        history_table.get_item.return_value = {"Item": target_history}
        dynamodb_client = MagicMock()

        with (
            patch.multiple(
                cards,
                CARD_HISTORY_TABLE=history_table,
                TABLE=current_table,
                DYNAMODB_CLIENT=dynamodb_client,
            ),
            patch.object(cards, "validate_card_set"),
            patch.object(cards, "get_cards_for_set", return_value=[current_card]),
            patch.object(cards, "delete_card_image") as delete_card_image,
        ):
            result = cards.restore_card_history_version(
                "user-1",
                "card-1",
                "0002#target",
                "user@example.com",
            )

        self.assertEqual(result["card"]["name"], "Previous")
        self.assertEqual(result["card"]["abilities"], "")
        self.assertNotIn("imageBucket", result["card"])
        self.assertNotIn("imageKey", result["card"])
        self.assertTrue(result["historyPreserved"])
        transaction = dynamodb_client.transact_write_items.call_args.kwargs["TransactItems"]
        self.assertEqual(len(transaction), 2)
        self.assertTrue(all("Put" in item for item in transaction))
        self.assertEqual(sum("Delete" in item for item in transaction), 0)
        history_item = transaction[0]["Put"]["Item"]
        self.assertEqual(history_item["changeType"]["S"], "restore")
        self.assertEqual(history_item["restoredFromVersionId"]["S"], "0002#target")
        self.assertEqual(history_item["restoredFromRecordedAt"]["N"], "20000")
        self.assertEqual(
            history_item["snapshot"]["M"]["abilities"]["S"],
            "Current text",
        )
        delete_card_image.assert_called_once_with(current_card)


if __name__ == "__main__":
    unittest.main()
