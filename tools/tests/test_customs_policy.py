import json
import unittest
from datetime import date
from unittest.mock import patch
from tools import assistant, customs_policy
from tools.tests.test_assistant import request_payload, tool_call


class CustomsPolicyTests(unittest.TestCase):
    def test_unsupported_battery_threshold_is_repaired_or_withheld(self):
        bad = "行動電源100Wh以下可以托運。"
        self.assertTrue(assistant.unsupported_battery_limit(bad))
        self.assertTrue(assistant.unsupported_battery_limit("Allowed up to 160 Wh"))
        self.assertFalse(assistant.unsupported_battery_limit("照片標示74Wh，尚不能確認航空攜帶許可。"))
        replies = iter([{"content": bad}, {"content": "照片標示74Wh，尚不能確認航空攜帶許可。"}])
        result = assistant.chat(request_payload(), lambda *args: next(replies))
        self.assertNotIn("100", result["reply"])
        with self.assertRaises(assistant.AgentError) as caught:
            assistant.chat(request_payload(), lambda *args: {"content": bad})
        self.assertEqual(caught.exception.code, "unverified_policy")

    def test_all_five_destinations_have_official_sources_and_scope(self):
        hosts = ("www.gov.uk", "www.hunan.gov.cn", "online.customs.gov.cn", "www.customs.go.jp",
                 "www.mhlw.go.jp", "www.customs.gov.hk", "www.abf.gov.au", "www.agriculture.gov.au")
        from urllib.parse import urlsplit
        for code in customs_policy.DESTINATIONS:
            with self.subTest(code=code):
                result = customs_policy.lookup(code, today=date(2026, 11, 14))
                self.assertEqual(result["status"], "found")
                self.assertFalse(result["live"])
                self.assertFalse(result["review_due"])
                self.assertTrue(result["destination_scope"])
                ids = {source["id"] for source in result["sources"]}
                for rule in result["rules"]:
                    self.assertTrue(rule["source_ids"])
                    self.assertTrue(set(rule["source_ids"]) <= ids)
                for source in result["sources"]:
                    url = urlsplit(source["url"])
                    self.assertEqual(url.scheme, "https")
                    self.assertIn(url.netloc, hosts)

    def test_unknown_missing_and_stale_rules_never_imply_permission(self):
        self.assertEqual(customs_policy.lookup(None)["status"], "destination_required")
        result = customs_policy.lookup("CN", "medicine", today=date(2027, 1, 1))
        self.assertTrue(result["review_due"])
        self.assertEqual(result["status"], "not_covered")
        self.assertEqual(result["sources"], [])
        self.assertEqual(result["rules"], [])
        with self.assertRaises(ValueError):
            customs_policy.lookup("../etc/passwd")
        with self.assertRaises(ValueError):
            customs_policy.lookup("HK", "https://example.com")

    def test_enquiry_takes_precedence_and_mainland_is_separate_from_hong_kong(self):
        context = {"trip": {"flight": {"destination": "LHR T3"}}}
        self.assertEqual(customs_policy.resolve_destination(context), "GB")
        for destination, expected in (("CN", "CN"), ("HKG", "HK"), ("JP", "JP"), ("IN", None), ("Belfast", None)):
            context["trip"]["enquiryDestination"] = destination
            self.assertEqual(customs_policy.resolve_destination(context), expected)
        hk = customs_policy.lookup("HK", "duty_free")
        self.assertTrue(all(r["id"].startswith("hk-") for r in hk["rules"]))

    def test_real_tool_contract_returns_saved_rules_with_citations(self):
        payload = request_payload()
        payload["context"]["trip"]["enquiryDestination"] = "JP"
        calls = []
        def model(messages, *args):
            calls.append(1)
            if len(calls) == 1:
                return {"tool_calls": [tool_call("get_customs_policy", '{"destination":"current","topic":"medicine"}')]}
            result = json.loads(messages[-1]["content"])
            self.assertEqual(result["destination"], "JP")
            self.assertEqual(result["status"], "found")
            self.assertIn("mhlw.go.jp", result["sources"][0]["url"])
            self.assertEqual(json.loads(messages[-2]["tool_calls"][0]["function"]["arguments"])["topic"], "medicine")
            return {"content": "Saved customs guidance; check ingredients."}
        answer = assistant.chat(payload, model)
        self.assertEqual(answer["tools"], ["get_customs_policy"])
        self.assertFalse(answer["liveSources"])

    def test_unavailable_library_and_invalid_arguments(self):
        payload = request_payload()
        for args in ('{}', '{"destination":"US"}', '{"destination":"JP","url":"https://example.com"}', '{"destination":[]}', '[]'):
            with self.subTest(args=args), self.assertRaises(assistant.AgentError):
                assistant.chat(payload, lambda *unused: {"tool_calls": [tool_call("get_customs_policy", args)]})
        calls = []
        def model(messages, *args):
            calls.append(1)
            if len(calls) == 1:
                return {"tool_calls": [tool_call("get_customs_policy", '{"destination":"JP"}')]}
            self.assertEqual(json.loads(messages[-1]["content"])["status"], "unavailable")
            return {"content": "Unable to retrieve saved policy."}
        with patch.object(customs_policy, "load_library", side_effect=OSError):
            assistant.chat(payload, model)
