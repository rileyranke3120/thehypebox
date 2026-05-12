#!/usr/bin/env node
/**
 * update-sarah-prompt.js
 *
 * Patches Sarah's Retell LLM prompt:
 * - Fixes company name references ("Dave's team" → "Ideal Concrete Coatings")
 * - Adds date/time handling instructions
 * - Adds booking failure handling instructions (stops the apology loop)
 *
 * Usage:
 *   RETELL_API_KEY=your_key node scripts/update-sarah-prompt.js
 *
 * Or if you have a .env.local:
 *   node -r dotenv/config scripts/update-sarah-prompt.js dotenv_config_path=.env.local
 */

const RETELL_BASE = 'https://api.retellai.com';
const AGENCY_AGENT_ID = 'agent_e8db2b76cbb022b6cd59d8393f'; // Ideal Concrete Coatings - Inbound

// Instructions to append / ensure are present
const DATE_INSTRUCTION = `When asking for a date, accept whatever format the caller gives you naturally — like "this Thursday", "April 24th", or "next week". Never ask them to use a specific format. Convert whatever they say into the correct date internally before calling the function.`;

const BOOKING_FAILURE_INSTRUCTION = `If a booking attempt fails or returns an error, do NOT apologize repeatedly or loop. Simply say something like "Let me get someone from the team to call you back and lock that in — can I confirm the best number to reach you?" Then end the booking topic gracefully. Never retry a failed booking more than once.`;

// String replacements to fix hardcoded references
const REPLACEMENTS = [
  // Fix "Dave's team" → "Ideal Concrete Coatings"
  { from: /dave'?s? team/gi, to: 'Ideal Concrete Coatings' },
  { from: /dave'?s? crew/gi, to: 'Ideal Concrete Coatings' },
  { from: /dave'?s? company/gi, to: 'Ideal Concrete Coatings' },
];

// Patterns that indicate an old date-format instruction — remove lines matching these
const OLD_FORMAT_PATTERNS = [
  /YYYY-MM-DD/i,
  /date.*format/i,
  /format.*date/i,
  /ask.*caller.*format/i,
  /provide.*date.*format/i,
];

function retellHeaders() {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function retellGet(path) {
  const res = await fetch(`${RETELL_BASE}${path}`, { headers: retellHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(`Retell ${res.status} on ${path}: ${JSON.stringify(data)}`);
  return data;
}

async function retellPatch(path, body) {
  const res = await fetch(`${RETELL_BASE}${path}`, {
    method: 'PATCH',
    headers: retellHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Retell PATCH ${res.status} on ${path}: ${JSON.stringify(data)}`);
  return data;
}

function applyReplacements(prompt) {
  let result = prompt;
  for (const { from, to } of REPLACEMENTS) {
    result = result.replace(from, to);
  }
  return result;
}

function removeOldDateInstructions(prompt) {
  const lines = prompt.split('\n');
  const filtered = lines.filter(line => !OLD_FORMAT_PATTERNS.some(p => p.test(line)));
  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function ensureInstruction(prompt, instruction) {
  // Don't add it if a close version is already there
  const key = instruction.slice(0, 40);
  if (prompt.includes(key)) return prompt;
  return `${prompt}\n\n${instruction}`;
}

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error('Error: RETELL_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log(`Fetching agent ${AGENCY_AGENT_ID}...`);
  const agent = await retellGet(`/get-agent/${AGENCY_AGENT_ID}`);

  const llmId = agent?.response_engine?.llm_id;
  if (!llmId) {
    console.error('Could not find llm_id on agent response_engine.');
    console.error('Agent response_engine:', JSON.stringify(agent?.response_engine, null, 2));
    process.exit(1);
  }

  console.log(`Found LLM ID: ${llmId}`);
  console.log('Fetching current LLM config...');
  const llm = await retellGet(`/get-retell-llm/${llmId}`);

  const currentPrompt = llm?.general_prompt || '';
  console.log('\n--- Current general_prompt (first 400 chars) ---');
  console.log(currentPrompt.slice(0, 400));
  console.log('---\n');

  // Apply all fixes in order
  let updated = applyReplacements(currentPrompt);
  updated = removeOldDateInstructions(updated);
  updated = ensureInstruction(updated, DATE_INSTRUCTION);
  updated = ensureInstruction(updated, BOOKING_FAILURE_INSTRUCTION);

  console.log('--- Updated general_prompt (last 400 chars) ---');
  console.log(updated.slice(-400));
  console.log('---\n');

  console.log(`Patching LLM ${llmId}...`);
  await retellPatch(`/update-retell-llm/${llmId}`, { general_prompt: updated });

  console.log("Done. Sarah's prompt has been updated.");
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
