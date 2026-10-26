import { http, HttpResponse } from 'msw';
import mapSmall from '../fixtures/map.small.json';
import lessonFixture from '../fixtures/lesson.json';

export const handlers = [
  // 1. OpenAI / OpenAI 相容端點
  http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
    const scenario = request.headers.get('x-mock-scenario');

    if (scenario === '401') {
      return HttpResponse.json(
        {
          error: {
            message: 'Incorrect API key provided: sk-invalid1234567890123456',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        },
        { status: 401 }
      );
    }

    if (scenario === '429') {
      return HttpResponse.json(
        {
          error: {
            message: 'You have exceeded your rate limit. Please try again later.',
            type: 'insufficient_quota',
            code: 'rate_limit_exceeded',
          },
        },
        { status: 429 }
      );
    }

    if (scenario === '500') {
      return HttpResponse.json(
        { error: { message: 'Internal Server Error' } },
        { status: 500 }
      );
    }

    if (scenario === 'bad-json') {
      return HttpResponse.json({
        choices: [
          {
            message: {
              content: '```json\n{\n  "title": "破損未閉合地圖",\n  "nodes": [',
            },
          },
        ],
      });
    }

    // 預設成功
    return HttpResponse.json({
      choices: [
        {
          message: {
            content: JSON.stringify(mapSmall),
          },
        },
      ],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 350,
        total_tokens: 500,
      },
    });
  }),

  // 2. Anthropic 端點 (/messages)
  http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
    const scenario = request.headers.get('x-mock-scenario');

    if (scenario === '401') {
      return HttpResponse.json(
        {
          type: 'error',
          error: {
            type: 'authentication_error',
            message: 'Invalid x-api-key provided',
          },
        },
        { status: 401 }
      );
    }

    if (scenario === '500') {
      return HttpResponse.json(
        {
          type: 'error',
          error: { type: 'api_error', message: 'Anthropic server error' },
        },
        { status: 500 }
      );
    }

    return HttpResponse.json({
      id: 'msg_123',
      content: [
        {
          type: 'tool_use',
          name: 'lessonSchema',
          input: lessonFixture,
        },
      ],
      usage: {
        input_tokens: 200,
        output_tokens: 400,
      },
    });
  }),

  // 3. Google Gemini 端點
  http.post(
    'https://generativelanguage.googleapis.com/v1beta/models/:model',
    async ({ request }) => {
      const scenario = request.headers.get('x-mock-scenario');

      if (scenario === '401' || scenario === '403') {
        return HttpResponse.json(
          {
            error: {
              code: 403,
              message: 'API key not valid. Please pass a valid API key.',
              status: 'PERMISSION_DENIED',
            },
          },
          { status: 403 }
        );
      }

      return HttpResponse.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mapSmall) }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 180,
          candidatesTokenCount: 320,
          totalTokenCount: 500,
        },
      });
    }
  ),
];
