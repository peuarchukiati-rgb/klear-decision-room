import { RESPONSE_FORMAT } from "./caseBriefSchema.js";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

export class OpenAiCaseWriterError extends Error {
  constructor(message, { status = null, code = "", model_id = "" } = {}) {
    super(message);
    this.name = "OpenAiCaseWriterError";
    this.status = status;
    this.code = code;
    this.model_id = model_id;
  }
}

function publicErrorMessage(status, code) {
  if (code === "model_not_found") {
    return "The configured OpenAI model is not available to this API project.";
  }
  if (status === 401) {
    return "The OpenAI API key was rejected.";
  }
  if (status === 429) {
    return "The OpenAI API request reached a rate or quota limit.";
  }
  return `The OpenAI case writer request failed (${status}).`;
}

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
    let code = "";
    try {
      const detail = JSON.parse(await response.text());
      code = detail?.error?.code || "";
    } catch {
      // Provider response bodies are intentionally not exposed to the reviewer UI.
    }
    throw new OpenAiCaseWriterError(publicErrorMessage(response.status, code), {
      status: response.status,
      code,
      model_id
    });
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
