/**
 * Groq AI Code Generation
 * 
 * Uses Groq's ultra-fast LLM API for AI-powered code generation
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

const SYSTEM_PROMPT = `You are an expert TensorFlow.js developer specializing in brain-computer interfaces and neural decoding.

Your task is to generate JavaScript code that creates and returns a compiled TensorFlow.js model for neural decoding.

Input specifications:
- Input shape: [142] (142 neural channels) or [10, 142] (10 timesteps × 142 channels for temporal models)
- Output shape: [2] (velocity predictions: vx, vy)

Code requirements:
1. Must use the global 'tf' object (TensorFlow.js)
2. Must return a compiled model
3. Model must be compiled with optimizer and loss function
4. Use appropriate architectures: Sequential, Functional API, LSTM, Conv1D, etc.
5. Follow best practices for neural network design

Respond ONLY with a JSON object in this exact format:
{
  "code": "// JavaScript code here",
  "explanation": "Brief explanation of the architecture",
  "architecture": "One-line architecture summary"
}

Do not include markdown code blocks or any text outside the JSON object.`;

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
- Must return a compiled model
- Use appropriate activation functions
- Include proper initialization

Generate clean, production-ready code.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768', // Fast and powerful
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: request.temperature || 0.7,
        max_tokens: 2000,
        top_p: 1,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    // Parse the JSON response
    let parsed: CodeGenerationResponse;
    try {
      // Remove markdown code blocks if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: try to extract code if JSON parsing fails
      console.warn('Failed to parse Groq response as JSON, attempting fallback extraction');
      
      const codeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
      if (codeMatch) {
        parsed = {
          code: codeMatch[1].trim(),
          explanation: 'AI-generated model',
          architecture: 'Custom architecture'
        };
      } else {
        throw new Error('Could not extract code from Groq response');
      }
    }

    // Validate the response
    if (!parsed.code) {
      throw new Error('Generated code is empty');
    }

    // Ensure code returns a model
    if (!parsed.code.includes('return')) {
      parsed.code += '\n\nreturn model;';
    }

    return parsed;
  } catch (error) {
    console.error('Groq code generation error:', error);
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
