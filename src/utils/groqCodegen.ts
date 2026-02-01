/**
 * Groq AI Code Generation
 * 
 * Uses Groq's ultra-fast LLM API for AI-powered code generation
 * with robust structured output parsing
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface CodeGenerationRequest {
  prompt: string;
  modelType?: 'sequential' | 'lstm' | 'functional' | 'custom';
  temperature?: number;
}

export interface CodeGenerationResponse {
  code: string;
  explanation: string;
  architecture: string;
}

// Use delimiter-based format instead of JSON to avoid newline escaping issues
const SYSTEM_PROMPT = `You are an expert TensorFlow.js developer specializing in brain-computer interfaces and neural decoding.

Your task is to generate JavaScript code that creates and returns a TensorFlow.js model for neural decoding.

Input specifications:
- Input shape: [142] (142 neural channels) or [10, 142] (10 timesteps × 142 channels for temporal models)
- Output shape: [2] (velocity predictions: vx, vy)

Code requirements:
1. The 'tf' object (TensorFlow.js) is passed as a parameter - use it directly
2. Must return a COMPILED model
3. Call model.compile() with optimizer: 'adam' and loss: 'meanSquaredError'
4. DO NOT use custom initializers - use default initialization
5. DO NOT use kernelInitializer, biasInitializer, or any initializer config
6. Use simple layer configs: just units, activation, inputShape
7. Use appropriate architectures: Sequential, Functional API, etc.
8. For LSTM/RNN models, reshape input inside the model using tf.layers.reshape

CRITICAL: 
- Use optimizer: 'adam' as a STRING, not tf.train.adam()
- NO custom initializers - they cause errors
- Keep layer configs minimal

IMPORTANT: Respond using this EXACT format with delimiters:

---CODE_START---
// Your JavaScript code here
const model = tf.sequential();
model.add(tf.layers.dense({inputShape: [142], units: 64, activation: 'relu'}));
model.add(tf.layers.dense({units: 2}));
model.compile({optimizer: 'adam', loss: 'meanSquaredError'});
return model;
---CODE_END---

---EXPLANATION---
Brief explanation of the architecture

---ARCHITECTURE---
One-line architecture summary

Do NOT wrap the code in markdown code blocks. Just use the delimiters above.`;

/**
 * Parse the structured response using delimiters
 */
function parseDelimitedResponse(content: string): CodeGenerationResponse | null {
  const codeMatch = content.match(/---CODE_START---\s*([\s\S]*?)\s*---CODE_END---/);
  const explanationMatch = content.match(/---EXPLANATION---\s*([\s\S]*?)(?:---|$)/);
  const architectureMatch = content.match(/---ARCHITECTURE---\s*([\s\S]*?)(?:---|$)/);

  if (codeMatch) {
    return {
      code: codeMatch[1].trim(),
      explanation: explanationMatch?.[1]?.trim() || 'AI-generated neural decoder',
      architecture: architectureMatch?.[1]?.trim() || 'Custom TensorFlow.js model'
    };
  }
  return null;
}

/**
 * Parse JSON with newline-in-string repair
 */
function parseJsonWithRepair(content: string): CodeGenerationResponse | null {
  try {
    // First, try direct parse
    return JSON.parse(content);
  } catch {
    // Try to repair JSON with unescaped newlines in strings
    try {
      // Find the "code" field and fix newlines within it
      const repaired = content.replace(
        /"code"\s*:\s*"([\s\S]*?)(?<!\\)"/,
        (_, codeContent) => {
          const escaped = codeContent
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/"/g, '\\"');
          return `"code": "${escaped}"`;
        }
      );
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * Extract code from markdown code blocks
 */
function extractFromCodeBlocks(content: string): CodeGenerationResponse | null {
  const patterns = [
    /```(?:javascript|js|typescript|ts)?\s*\n?([\s\S]*?)\n?```/,
    /```([\s\S]*?)```/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1].includes('tf.')) {
      return {
        code: match[1].trim(),
        explanation: 'AI-generated neural decoder',
        architecture: 'Custom TensorFlow.js model'
      };
    }
  }
  return null;
}

/**
 * Extract code if response appears to be raw code
 */
function extractRawCode(content: string): CodeGenerationResponse | null {
  // Check if content looks like TensorFlow.js code
  if (content.includes('tf.') && 
      (content.includes('sequential') || content.includes('model') || content.includes('layers'))) {
    // Remove any JSON wrapper attempts
    let code = content;
    
    // Try to extract just the code portion if wrapped in partial JSON
    const codeValueMatch = content.match(/"code"\s*:\s*"?([\s\S]*)/);
    if (codeValueMatch) {
      code = codeValueMatch[1]
        .replace(/^"/, '')
        .replace(/"[,\s]*"explanation"[\s\S]*$/, '')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .trim();
    }

    return {
      code: code,
      explanation: 'AI-generated neural decoder',
      architecture: 'Custom TensorFlow.js model'
    };
  }
  return null;
}

/**
 * Generate TensorFlow.js code using Groq AI
 */
export async function generateCodeWithGroq(
  request: CodeGenerationRequest
): Promise<CodeGenerationResponse> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured. Set VITE_GROQ_API_KEY in your .env file.');
  }

  const userPrompt = `Generate a TensorFlow.js model for: ${request.prompt}

Model type preference: ${request.modelType || 'custom'}

Requirements:
- Input: 142 neural channels (or temporal sequence [10, 142])
- Output: 2 velocity values (vx, vy)
- Compile with optimizer: 'adam' (as string), loss: 'meanSquaredError'
- Use default initialization - NO kernelInitializer or biasInitializer
- Keep layer configs simple: just units, activation, inputShape

Remember to use the ---CODE_START--- and ---CODE_END--- delimiters for the code.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fast and stable for structured output
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: request.temperature ?? 0.3, // Low temp for consistent formatting
        max_tokens: 2000,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from Groq API');
    }

    console.log('[Groq] Raw response received, length:', content.length);

    // Try parsing strategies in order of preference
    let parsed: CodeGenerationResponse | null = null;

    // Strategy 1: Delimiter-based format (most reliable)
    parsed = parseDelimitedResponse(content);
    if (parsed) {
      console.log('[Groq] Parsed using delimiter format');
    }

    // Strategy 2: Try JSON parse with repair
    if (!parsed) {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = parseJsonWithRepair(cleaned);
      if (parsed) {
        console.log('[Groq] Parsed using JSON with repair');
      }
    }

    // Strategy 3: Extract from markdown code blocks
    if (!parsed) {
      parsed = extractFromCodeBlocks(content);
      if (parsed) {
        console.log('[Groq] Extracted from code blocks');
      }
    }

    // Strategy 4: Raw code extraction
    if (!parsed) {
      parsed = extractRawCode(content);
      if (parsed) {
        console.log('[Groq] Extracted raw code');
      }
    }

    if (!parsed || !parsed.code) {
      console.error('[Groq] All parsing strategies failed. Raw content:', content);
      throw new Error('Could not extract code from Groq response. Check console for details.');
    }

    // Validate and fix the code
    let { code } = parsed;

    // Ensure code returns a model
    if (!code.includes('return')) {
      code += '\n\nreturn model;';
    }

    // Clean up any escape sequences that might have leaked through
    code = code
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');

    return {
      ...parsed,
      code
    };
  } catch (error) {
    console.error('[Groq] Code generation error:', error);
    throw error;
  }
}

/**
 * Generate code from a natural language prompt
 */
export async function generateFromPrompt(prompt: string): Promise<CodeGenerationResponse> {
  return generateCodeWithGroq({ prompt });
}

/**
 * Improve existing code with AI suggestions
 */
export async function improveCode(existingCode: string, improvement: string): Promise<CodeGenerationResponse> {
  const prompt = `Improve this TensorFlow.js model: ${improvement}\n\nExisting code:\n${existingCode}`;
  return generateCodeWithGroq({ prompt });
}

/**
 * Quick templates with AI enhancement
 */
export async function generateTemplate(
  templateType: 'mlp' | 'lstm' | 'cnn' | 'attention' | 'hybrid'
): Promise<CodeGenerationResponse> {
  const prompts: Record<string, string> = {
    mlp: 'Create a multi-layer perceptron (MLP) with 2 hidden layers for neural decoding',
    lstm: 'Create an LSTM model for temporal neural decoding with sequence input',
    cnn: 'Create a 1D convolutional neural network for spatial feature extraction',
    attention: 'Create a model with attention mechanism for neural decoding',
    hybrid: 'Create a hybrid model combining LSTM and attention for robust decoding'
  };

  return generateCodeWithGroq({
    prompt: prompts[templateType],
    modelType: templateType === 'mlp' ? 'sequential' : 'custom'
  });
}
