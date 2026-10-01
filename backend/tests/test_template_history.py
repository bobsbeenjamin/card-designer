import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

import boto3


ENVIRONMENT = {
    "TABLE_NAME": "cards",
    "CARD_HISTORY_TABLE_NAME": "card-history",
    "TEMPLATE_HISTORY_TABLE_NAME": "template-history",
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
    spec = importlib.util.spec_from_file_location("template_history_cards", module_path)
    module = importlib.util.module_from_spec(spec)
    with (
        patch.dict(os.environ, ENVIRONMENT, clear=False),
        patch.object(boto3, "resource", return_value=BootstrapDynamoResource()),
        patch.object(boto3, "client", return_value=MagicMock()),
    ):
        spec.loader.exec_module(module)
    return module


cards = load_cards_module()


def template(name, updated_at):
    return {
        "ownerSet": "user-1#DEFAULT",
        "normalizedName": name.casefold(),
        "userId": "user-1",
        "templateId": "template-1",
        "setCode": "DEFAULT",
        "name": name,
        "applyToExistingCards": False,
        "sections": [],
        "customFields": [],
        "createdAt": 10,
        "updatedAt": updated_at,
        "imageBucket": "preview-bucket",
        "imageKey": "DEFAULT/templates/template-1.png",
    }


class TemplateHistoryTests(unittest.TestCase):
    def test_new_stat_mode_is_recorded_as_exact_template_history_changes(self):
        existing = template("Original", 10)
        existing["sections"] = [{
            "id": "numbers",
            "label": "Numbers",
            "fields": [{
                "id": "statMode",
                "label": "Stat mode",
                "value": "combat",
                "options": [
                    {"value": "combat", "label": "Attack / Health"},
                    {"value": "loyalty", "label": "Loyalty"},
                ],
            }],
        }]
        updated = template("Original", 20)
        updated["sections"] = [{
            "id": "numbers",
            "label": "Numbers",
            "fields": [
                {
                    "id": "statMode",
                    "label": "Stat mode",
                    "value": "combat",
                    "options": [
                        {"value": "combat", "label": "Attack / Health"},
                        {"value": "loyalty", "label": "Loyalty"},
                        {"value": "shield", "label": "Shield", "fieldId": "stat_shield"},
                    ],
                },
                {
                    "id": "stat_shield",
                    "label": "Shield",
                    "value": "0",
                    "dynamicStat": True,
                },
            ],
        }]

        history_item = cards.build_template_history_item(
            "user-1",
            existing,
            updated,
            "update",
            "user@example.com",
        )

        self.assertIn("sections", history_item["changedFields"])
        labels = [change["label"] for change in history_item["changes"]]
        self.assertTrue(any("Stat mode" in label and "Options" in label for label in labels))
        self.assertTrue(any("Shield" in label for label in labels))

    def test_template_update_and_history_are_written_atomically(self):
        existing = template("Original", 10)
        updated = template("Updated", 20)
        history_item = cards.build_template_history_item(
            "user-1",
            existing,
            updated,
            "update",
            "user@example.com",
        )
        dynamodb_client = MagicMock()

        with patch.object(cards, "DYNAMODB_CLIENT", dynamodb_client):
            cards.put_template_update_with_history(existing, updated, history_item)

        transaction = dynamodb_client.transact_write_items.call_args.kwargs["TransactItems"]
        self.assertEqual(len(transaction), 3)
        self.assertEqual(transaction[0]["Put"]["TableName"], "template-history")
        self.assertIn("Delete", transaction[1])
        self.assertIn("Put", transaction[2])

    def test_full_history_identifies_current_and_original_versions(self):
        history_items = [
            {
                "versionId": "0002#newer",
                "recordedAt": 30_000,
                "snapshot": template("Previous", 20),
                "changedBy": "user@example.com",
                "description": "Changed template name.",
                "changedFields": ["name"],
                "changes": [],
                "oldValues": {"name": "Previous"},
                "newValues": {"name": "Current"},
            },
            {
                "versionId": "0001#original",
                "recordedAt": 20_000,
                "snapshot": template("Original", 10),
                "changedBy": "user@example.com",
                "description": "Changed template name.",
                "changedFields": ["name"],
                "changes": [],
                "oldValues": {"name": "Original"},
                "newValues": {"name": "Previous"},
            },
        ]
        history_table = MagicMock()
        history_table.query.return_value = {"Items": history_items}

        with (
            patch.object(cards, "TEMPLATE_HISTORY_TABLE", history_table),
            patch.object(cards, "get_template_item_by_id", return_value=template("Current", 30)),
        ):
            result = cards.list_template_history("user-1", "template-1")

        versions = result["history"]
        self.assertEqual(len(versions), 3)
        self.assertTrue(versions[0]["isCurrent"])
        self.assertEqual(versions[1]["restoreVersionId"], "0002#newer")
        self.assertEqual(versions[2]["description"], "Original saved version.")

    def test_restore_appends_revision_and_preserves_existing_history(self):
        current = template("Current", 30)
        snapshot = template("Original", 10)
        target_history = {
            "versionId": "0001#original",
            "recordedAt": 20_000,
            "snapshot": snapshot,
        }
        restored = {**snapshot, "createdAt": 10, "updatedAt": 40}
        history_table = MagicMock()
        history_table.get_item.return_value = {"Item": target_history}
        templates_table = MagicMock()
        templates_table.get_item.return_value = {}

        with (
            patch.multiple(
                cards,
                TEMPLATE_HISTORY_TABLE=history_table,
                TEMPLATES_TABLE=templates_table,
            ),
            patch.object(cards, "get_template_item_by_id", return_value=current),
            patch.object(cards, "clean_template_record", return_value=restored),
            patch.object(cards, "put_template_update_with_history") as put_update,
            patch.object(cards, "refactor_cards_for_template") as refactor_cards,
        ):
            result = cards.restore_template_history_version(
                "user-1",
                "template-1",
                "0001#original",
                "user@example.com",
            )

        self.assertTrue(result["historyPreserved"])
        put_update.assert_called_once()
        saved_current, saved_restore, history_item = put_update.call_args.args
        self.assertEqual(saved_current["name"], "Current")
        self.assertEqual(saved_restore["name"], "Original")
        self.assertEqual(history_item["changeType"], "restore")
        self.assertEqual(history_item["restoredFromVersionId"], "0001#original")
        self.assertEqual(history_item["restoredFromRecordedAt"], 10_000)
        refactor_cards.assert_not_called()


if __name__ == "__main__":
    unittest.main()
