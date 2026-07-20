import { RESPONSE_FORMAT } from "./caseBriefSchema.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

function extractOutputText(response) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const texts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        texts.push(content.text);
      }
    }
  }
  return texts.join("\n");
}

export async function callOpenAiCaseWriter({ model_id, api_key, messages, fetchImpl = fetch }) {
  if (!api_key) {
    throw new Error("OPENAI_API_KEY is required for model case writing");
  }
  if (!model_id) {
    throw new Error("KLEAR_MODEL_ID is required for model case writing");
  }

  const response = await fetchImpl(RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${api_key}`
    },
    body: JSON.stringify({
      model: model_id,
      input: messages,
      text: {
        format: RESPONSE_FORMAT
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI case writer request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const text = extractOutputText(data).trim();
  if (!text) {
    throw new Error("MODEL_OUTPUT_REJECTED: OpenAI case writer returned no output text");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("MODEL_OUTPUT_REJECTED: OpenAI case writer returned invalid JSON");
  }
}
