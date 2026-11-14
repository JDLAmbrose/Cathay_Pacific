import unittest
from unittest.mock import patch
from tools import assistant
from tools.tests.test_assistant import request_payload, tool_call

SOURCE = 'https://www.customs.go.jp/english/summary/passenger.htm'
EVIDENCE = {'status': 'found', 'review_due': False, 'reviewed_on': '2026-11-14',
            'rules': [{'summary': 'Test fixture only'}], 'sources': [{'url': SOURCE}]}


class VerdictTests(unittest.TestCase):
    def test_yes_and_no_require_a_fresh_retrieved_link_and_date(self):
        for icon in ('✅', '❌'):
            text = f'## {icon} Test verdict\n\n> [!NOTE] Source\n> [Customs]({SOURCE})\n> 2026-11-14'
            self.assertFalse(assistant.unsupported_entry_verdict(text, [EVIDENCE]))
            for evidence in ([], [{**EVIDENCE, 'review_due': True}], [{**EVIDENCE, 'status': 'not_covered'}], [{**EVIDENCE, 'reviewed_on': None}]):
                self.assertTrue(assistant.unsupported_entry_verdict(text, evidence))
            for changed in (text.replace('2026-11-14', ''), text.replace(SOURCE, 'https://example.org/'), text.replace(SOURCE, 'https://example.org/?url='+SOURCE)):
                self.assertTrue(assistant.unsupported_entry_verdict(changed, [EVIDENCE]))
        self.assertFalse(assistant.unsupported_entry_verdict('## ⚠️ 暫無法確認', []))

    def test_unsourced_yes_is_not_streamed_and_repaired_to_unknown(self):
        events, rounds = [], []
        def model(*args, on_delta):
            rounds.append(1)
            text = '## ✅ 可以入境。\n> [!IMPORTANT] 我猜可以。' if len(rounds) == 1 else '## ⚠️ 暫無法確認\n\n> [!WARNING] 缺少適用來源。'
            for part in text:
                on_delta(part)
            return {'content': text}
        result = assistant.chat(request_payload(), model, events.append)
        self.assertTrue(result['reply'].startswith('## ⚠️'))
        self.assertEqual(len(rounds), 2)
        self.assertNotIn('✅', ''.join(e.get('text', '') for e in events))

    def test_retrieved_verdict_is_streamed_only_after_citation_and_date(self):
        events, rounds = [], []
        def model(*args, on_delta):
            rounds.append(1)
            if len(rounds) == 1:
                return {'tool_calls': [tool_call('get_customs_policy', '{"destination":"JP"}')]}
            prefix = '## ❌ 不可以入境 — 測試條件\n\n> [!IMPORTANT] 條件不符。\n\n'
            on_delta(prefix)
            self.assertFalse(any(e['type'] == 'delta' for e in events))
            suffix = f'> [!NOTE] 官方來源\n> [Customs]({SOURCE})\n> 核查：2026-11-14。'
            on_delta(suffix)
            self.assertTrue(any(e['type'] == 'delta' for e in events))
            return {'content': prefix + suffix}
        with patch.object(assistant.customs_policy, 'lookup', return_value=EVIDENCE):
            result = assistant.chat(request_payload(), model, events.append)
        self.assertTrue(result['reply'].startswith('## ❌'))
        self.assertEqual(result['tools'], ['get_customs_policy'])
