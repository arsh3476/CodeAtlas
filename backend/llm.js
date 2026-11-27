// const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// /**
//  * Calls the Gemini Developer API from the backend.
//  * Keep GEMINI_API_KEY on the server; never expose it in the React webview.
//  */
// async function callGemini({ prompt, systemPrompt = '', temperature = 0.2, maxTokens = 8192 }) {
//   const apiKey = process.env.GEMINI_API_KEY;

//   if (!apiKey || !apiKey.trim()) {
//     const error = new Error('Gemini API key is missing. Add GEMINI_API_KEY to backend/.env and restart the backend.');
//     error.status = 503;
//     throw error;
//   }

//   const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
//   const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

//   const contents = [{
//     role: 'user',
//     parts: [{ text: `${systemPrompt ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\n` : ''}${prompt}` }]
//   }];

//   const response = await fetch(url, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'x-goog-api-key': apiKey.trim()
//     },
//     body: JSON.stringify({
//       contents,
//       generationConfig: {
//         temperature,
//         maxOutputTokens: maxTokens
//       }
//     })
//   });

//   const data = await response.json().catch(() => ({}));

//   if (!response.ok) {
//     const message = data?.error?.message || `Gemini request failed with HTTP ${response.status}`;
//     const error = new Error(message);
//     error.status = response.status;
//     throw error;
//   }

//   const text = (data.candidates || [])
//     .flatMap(candidate => candidate.content?.parts || [])
//     .map(part => part.text || '')
//     .join('')
//     .trim();

//   if (!text) {
//     throw new Error('Gemini returned an empty response. Try a shorter prompt or check the model/API quota.');
//   }

//   return text;
// }

// // Keep the old function name available because other CodeAtlas modules use it.
// const callNemotron = callGemini;
// const callNemotronChat = async ({ messages, temperature = 0.2, maxTokens = 8192 }) => {
//   const transcript = (messages || [])
//     .map(message => `${String(message.role || 'user').toUpperCase()}:\n${message.content || ''}`)
//     .join('\n\n');
//   return callGemini({ prompt: transcript, temperature, maxTokens });
// };

// module.exports = { callGemini, callNemotron, callNemotronChat, DEFAULT_MODEL };

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.6-flash';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const REQUEST_TIMEOUT_MS = 35000;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calls Gemini Developer API.
 * Supports temporary-error retries and model fallback.
 * API keys remain on the backend.
 */
async function callGemini({
  prompt,
  systemPrompt = '',
  temperature = 0.2,
  maxTokens = 8192
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    const error = new Error(
      'AI API key is missing in backend/.env.'
    );
    error.status = 503;
    throw error;
  }

  const contents = [{
    role: 'user',
    parts: [{
      text: `${systemPrompt ? `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\n` : ''}${prompt}`
    }]
  }];

  const requestBody = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens
    }
  };

  const models = [...new Set([DEFAULT_MODEL, FALLBACK_MODEL])];

  let lastError;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    const maxAttempts = modelIndex === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `[CodeAtlas AI] Trying ${model} (attempt ${attempt}/${maxAttempts})`
        );

        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/` +
          `${encodeURIComponent(model)}:generateContent`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey.trim()
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const error = new Error(
            data?.error?.message ||
            `AI request failed with HTTP ${response.status}`
          );
          error.status = response.status;
          throw error;
        }

        const generatedText = (data.candidates || [])
          .flatMap(candidate => candidate.content?.parts || [])
          .map(part => part.text || '')
          .join('')
          .trim();

        if (!generatedText) {
          throw new Error(
            'AI model returned an empty response.'
          );
        }

        console.log(`[CodeAtlas AI] Successfully generated using ${model}`);

        return generatedText;

      } catch (error) {
        lastError = error;

        const retryable =
          RETRYABLE_STATUS.has(error.status) ||
          !error.status ||
          error.name === 'TimeoutError';

        console.error(
          `[CodeAtlas AI] ${model} failed:`,
          error.message
        );

        if (!retryable) {
          throw error;
        }

        if (attempt < maxAttempts) {
          console.log('[CodeAtlas AI] Retrying after temporary error...');
          await wait(1000);
          continue;
        }

        if (modelIndex < models.length - 1) {
          console.log(
            `[CodeAtlas AI] Switching to fallback model: ${FALLBACK_MODEL}`
          );
        }
      }
    }
  }

  const error = new Error(
    `AI request failed. Last error: ${lastError?.message || 'Unknown error'}. Please try again later.`
  );

  error.status = lastError?.status || 503;
  throw error;
}

// Maintain compatibility with existing CodeAtlas modules.
const callNemotron = callGemini;

const callNemotronChat = async ({
  messages,
  temperature = 0.2,
  maxTokens = 8192
}) => {
  const transcript = (messages || [])
    .map(message =>
      `${String(message.role || 'user').toUpperCase()}:\n${message.content || ''}`
    )
    .join('\n\n');

  return callGemini({
    prompt: transcript,
    temperature,
    maxTokens
  });
};

module.exports = {
  callGemini,
  callNemotron,
  callNemotronChat,
  DEFAULT_MODEL
};
