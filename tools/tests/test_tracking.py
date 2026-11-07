from unittest import TestCase

from tools.serve import tracking_lookup


class TrackingTests(TestCase):
    def setUp(self):
        self.order = {
            "id": "PL-TEST",
            "legId": "CX257-TEST",
            "createdAt": "2026-11-10T01:30:00Z",
            "status": "paid_demo",
            "carrier": "Parcelforce Worldwide",
            "itemIds": ["bag-1", "bag-2"],
        }

    def event(self, items, **fields):
        return {
            "type": "handover",
            "orderId": self.order["id"],
            "legId": self.order["legId"],
            "itemIds": items,
            "confirmedAt": "2026-11-15T16:00:00Z",
            **fields,
        }

    def lookup(self, *events):
        return tracking_lookup({"order": self.order, "handoverEvents": list(events)})

    def test_partial_duplicate_and_other_leg_do_not_release_tracking(self):
        partial = self.event(["bag-1"])
        wrong_leg = self.event(["bag-2"], legId="other")
        loaded = self.event(["bag-2"], type="loaded")
        other_order = self.event(["bag-2"], orderId="other")
        self.assertEqual(self.lookup(partial, partial, wrong_leg, loaded, other_order), {
            "status": "pending",
        })

    def test_all_bags_release_stable_tracking_and_carrier_url(self):
        first, last = self.event(["bag-1"]), self.event(["bag-2"])
        ready = self.lookup(first, last)
        self.assertEqual(ready, self.lookup(last, first, first))
        self.assertEqual(ready["status"], "ready")
        self.assertTrue(ready["demo"])
        self.assertRegex(ready["trackingNumber"], r"^DEMO-[0-9A-F]{12}$")
        self.assertEqual(ready["trackingUrl"], "https://www.parcelforce.com/track-trace")
        self.order["status"] = "completed"
        self.assertEqual(ready, self.lookup(first, last))

    def test_cancelled_order_and_unconfigured_link(self):
        all_bags = self.event(self.order["itemIds"])
        self.order["carrier"] = "EBC UK"
        self.assertIsNone(self.lookup(all_bags)["trackingUrl"])
        self.order["status"] = "cancelled"
        self.assertEqual(self.lookup(all_bags), {"status": "pending"})
