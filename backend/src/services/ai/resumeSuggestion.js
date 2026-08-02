import { aiCallsCounter } from '../../middleware/metrics.js';

const MAX_INPUT_CHARS = 600; // matches the resume description field cap

/**
 * Generate a short inline continuation for a resume field (Copilot-style
 * ghost text). Returns only the text to append after what the user has typed,
 * or '' when nothing useful can be added.
 *
 * @param {{ sectionName?: string, field?: string, text: string }} input
 * @param {object} aiProvider - adapter from extractAIProvider (has generateContent)
 */
export const generateResumeSuggestion = async ({ sectionName, field = 'description', text }, aiProvider) => {
  if (!aiProvider) {
    throw new Error('AI Provider is required. Please provide an API key.');
  }

  const trimmed = (text || '').slice(0, MAX_INPUT_CHARS);
  // Nothing to complete from an empty field — skip the model call entirely.
  if (trimmed.trim().length === 0) return '';

  const sectionHint = sectionName ? ` in the "${sectionName}" section` : '';
  const prompt = `You are an autocomplete engine for a resume editor. The user is writing the "${field}" field of an entry${sectionHint}.

Continue their text with a SHORT, natural completion (at most ~12 words). Rules:
- Return ONLY the continuation to append after their text — do NOT repeat what they already wrote.
- No quotes, no markdown, no preamble, no trailing newline.
- Use concise, professional resume phrasing.
- If their text already reads complete, return an empty string.

Their text so far:
"""${trimmed}"""`;

  try {
    const result = await aiProvider.generateContent(prompt);
    try { aiCallsCounter?.inc?.({ endpoint: 'resume-suggestion' }); } catch { /* metrics optional */ }

    let suggestion = (result?.text || '').trim();
    // Defensively strip anything the model wraps around the raw continuation.
    suggestion = suggestion
      .replace(/^```[a-z]*\n?/i, '')
      .replace(/```$/, '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    return suggestion;
  } catch (error) {
    console.error('Resume suggestion generation error:', error);
    throw new Error('Failed to generate resume suggestion.');
  }
};
