import io
import json
import time
import unittest
from unittest.mock import patch

from tools import assistant
from tools.tests.test_assistant import request_payload, tool_call


def chunk(delta, finish=None):
    return 'data: ' + json.dumps({'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish}]}) + '\r\n\r\n'


class StreamingTests(unittest.TestCase):
    def test_provider_streams_text_and_accumulates_split_tool_arguments(self):
        chunks = [chunk({'content': '你好。'}), chunk({'tool_calls': [
            {'index': 0, 'id': 'call_1', 'type': 'function', 'function': {'name': 'get_customs_policy', 'arguments': '{"destination":'}}]}),
            chunk({'tool_calls': [{'index': 0, 'function': {'arguments': '"JP"}'}}]}, 'tool_calls'), 'data: [DONE]\r\n\r\n']
        events = []
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-secret'}), patch.object(assistant, 'build_opener') as opener:
            opener.return_value.open.return_value.__enter__.return_value = io.BytesIO(''.join(chunks).encode())
            result = assistant.completion([], True, 2, on_delta=events.append)
            body = json.loads(opener.return_value.open.call_args.args[0].data)
        self.assertTrue(body['stream'])
        self.assertFalse(body['store'])
        self.assertNotIn('test-secret', json.dumps(body))
        self.assertEqual(events, ['你好。'])
        self.assertEqual(json.loads(result['tool_calls'][0]['function']['arguments']), {'destination': 'JP'})

    def test_truncated_refused_and_malformed_streams_never_succeed(self):
        cases = [(chunk({'content': 'Partial'}), 'incomplete_response'),
                 (chunk({}, 'length'), 'incomplete_response'),
                 (chunk({'refusal': 'No'}), 'provider_refusal'),
                 ('data: [DONE]\n\n', 'incomplete_response'),
                 (chunk({'tool_calls': [{'index': 7}]}), 'tool_limit')]
        for raw, code in cases:
            with self.subTest(code=code), self.assertRaises(assistant.AgentError) as caught:
                assistant.read_completion_stream(io.BytesIO(raw.encode()), lambda _: None, time.monotonic() + 2)
            self.assertEqual(caught.exception.code, code)
        with self.assertRaises(assistant.AgentError) as caught:
            assistant.read_completion_stream(io.BytesIO(), lambda _: None, time.monotonic() - 1)
        self.assertEqual(caught.exception.code, 'provider_timeout')

    def test_real_progress_before_completion_and_tool_status_without_arguments(self):
        events, rounds = [], []
        def model(messages, allow_tools, timeout, on_delta):
            rounds.append(1)
            if len(rounds) == 1:
                return {'tool_calls': [tool_call()]}
            on_delta('第一句。')
            self.assertIn({'type': 'delta', 'text': '第一句。'}, events)
            on_delta('第二句。')
            return {'content': '第一句。第二句。'}
        answer = assistant.chat(request_payload(), model, events.append)
        self.assertEqual(answer['reply'], '第一句。第二句。')
        self.assertTrue(any(e.get('tool') == 'get_price_context' for e in events))
        self.assertNotIn('arguments', json.dumps(events))

    def test_policy_guard_holds_split_unsafe_sentences_before_repair(self):
        events, rounds = [], []
        def model(messages, allow_tools, timeout, on_delta):
            rounds.append(1)
            if len(rounds) == 1:
                for part in ('照片清晰。', '容量不超', '过100', ' Wh', '可携带。'):
                    on_delta(part)
                return {'content': '照片清晰。容量不超过100 Wh可携带。'}
            on_delta('请向航空公司确认。')
            return {'content': '请向航空公司确认。'}
        answer = assistant.chat(request_payload(), model, events.append)
        self.assertEqual(answer['reply'], '请向航空公司确认。')
        self.assertEqual(len(rounds), 2)
        self.assertNotIn('100', ''.join(e.get('text', '') for e in events))
        self.assertTrue(any(e.get('stage') == 'checking' for e in events))

    def test_disconnected_client_stops_current_model_without_retry(self):
        def disconnected(event):
            if event['type'] == 'delta':
                raise BrokenPipeError()
        def model(*args, on_delta):
            on_delta('Hello. ')
            self.fail('Must stop when the client disconnects')
        with self.assertRaises(BrokenPipeError):
            assistant.chat(request_payload(), model, disconnected)
