import { OpenAISpecService, OpenAIError } from '../openaiSpecService';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('OpenAISpecService', () => {
  let service: OpenAISpecService;
  let mockOpenAI: any;

  beforeEach(() => {
    const OpenAI = require('openai').default;
    mockOpenAI = new OpenAI();
    service = new OpenAISpecService('test-api-key', 'gpt-4o-mini', 60000);
  });

  describe('convertPDFToTestSpec', () => {
    it('should convert PDF text to TestSpec successfully', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                site: 'https://example.com',
                tests: [
                  {
                    section: 'Header Navigation',
                    steps: [
                      {
                        action: 'click',
                        target: {
                          kind: 'text',
                          value: 'Home'
                        }
                      }
                    ]
                  }
                ]
              })
            }
          }
        ],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const pdfText = 'Click on the Home link in the header';
      const targetUrl = 'https://example.com';

      const result = await service.convertPDFToTestSpec(pdfText, targetUrl);

      expect(result).toEqual({
        dsl: {
          site: 'https://example.com',
          tests: [
            {
              section: 'Header Navigation',
              steps: [
                {
                  action: 'click',
                  target: {
                    kind: 'text',
                    value: 'Home'
                  }
                }
              ]
            }
          ]
        },
        meta: {
          model: 'gpt-4o-mini',
          tokens: {
            input: 100,
            output: 50
          }
        }
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: expect.stringContaining('You are a test-spec compiler')
          },
          {
            role: 'user',
            content: expect.stringContaining('TARGET URL:\nhttps://example.com')
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 4000
      });
    });

    it('should throw error for empty PDF text', async () => {
      await expect(service.convertPDFToTestSpec('', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw error for invalid URL', async () => {
      await expect(service.convertPDFToTestSpec('Some text', 'not-a-url'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw error for API timeout', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('timeout'));

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw error for rate limit', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('rate limit exceeded'));

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw error for invalid JSON response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Invalid JSON response'
            }
          }
        ],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw error for empty response', async () => {
      const mockResponse = {
        choices: [],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should throw error for missing content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {}
          }
        ],
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50
        }
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should handle API key error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('Invalid API key'));

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });

    it('should handle quota exceeded error', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('quota exceeded'));

      await expect(service.convertPDFToTestSpec('Some text', 'https://example.com'))
        .rejects.toThrow(OpenAIError);
    });
  });

  describe('constructor', () => {
    it('should throw error for missing API key', () => {
      expect(() => new OpenAISpecService('', 'gpt-4o-mini'))
        .toThrow('OpenAI API key is required');
    });

    it('should create service with valid API key', () => {
      expect(() => new OpenAISpecService('valid-key', 'gpt-4o-mini'))
        .not.toThrow();
    });
  });
});
