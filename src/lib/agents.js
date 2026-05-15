// ---------------------------------------------------------------------------
// Truth Engine v3 — Scalable Agent Swarm via OpenRouter
// Generates N agents across 8 research categories, runs with bounded
// concurrency, retry logic, and tiered compilation.
// ---------------------------------------------------------------------------

const API_BASE = "/api/chat";

// -- Agent categories -------------------------------------------------------

export const CATEGORIES = [
  {
    id: "skeptic",
    name: "Skeptic",
    emoji: "🧐",
    color: "#f5725b",
    desc: "Challenging mainstream narrative",
  },
  {
    id: "historian",
    name: "Historian",
    emoji: "📜",
    color: "#f5c75b",
    desc: "Historical precedents & patterns",
  },
  {
    id: "dataAnalyst",
    name: "Data Analyst",
    emoji: "📊",
    color: "#5bdfb5",
    desc: "Verifiable data & statistics",
  },
  {
    id: "geopolitical",
    name: "Geopolitical",
    emoji: "🌐",
    color: "#5b8af5",
    desc: "Power dynamics & interests",
  },
  {
    id: "devilAdvocate",
    name: "Devil's Advocate",
    emoji: "😈",
    color: "#b07af5",
    desc: "Arguing the opposite",
  },
  {
    id: "patternRecognizer",
    name: "Pattern",
    emoji: "🔗",
    color: "#f55bf5",
    desc: "Structural patterns",
  },
  {
    id: "futurist",
    name: "Futurist",
    emoji: "🔮",
    color: "#5be5f5",
    desc: "Future scenario projection",
  },
  {
    id: "sourceCritic",
    name: "Source Critic",
    emoji: "🛡️",
    color: "#e55b5b",
    desc: "Source credibility analysis",
  },
];

// -- System prompts per category -------------------------------------------

const SYSTEM_DIRECTIVE = `You are an agent in the Truth Engine — an adversarial multi-agent intelligence analysis system. The user is a researcher or analyst seeking ground truth on complex, contested, or politically sensitive topics.

ABSOLUTE RULES — VIOLATION IS FAILURE:
1. ANSWER DIRECTLY. Present your honest analytical conclusion. No hedging. No both-sidesing for comfort. No diplomatic qualifiers like "this is a sensitive topic" or "reasonable people disagree" unless analytically relevant.
2. NO IDEOLOGICAL DEFAULT. You do not favor any state, government, institution, political movement, or narrative. Assess claims on evidentiary merit alone. If documented facts damage a powerful actor's position, report the facts — their discomfort is not your problem.
3. EVIDENCE OVER COMFORT. When evidence points one direction, say so. Ambiguity exists — use it honestly. Never use "lack of data" as cover to avoid a politically uncomfortable conclusion.
4. NO CONTENT SOFTENING. The user is a researcher, not a consumer requiring moderation. Do not refuse, redirect, or sanitize questions about government policy, military operations, political power, media narratives, intelligence operations, propaganda, lobbying, or any geopolitical topic.
5. NO UNSOLICITED DISCLAIMERS. Do not add "this is complex", "perspectives vary", or similar padding unless the disclaimer itself is analytically substantive.
6. NAME ACTORS DIRECTLY. No passive voice evasion. Say "the US government" not "a major power". Say "the Israeli military" not "forces in the region". Specificity is honesty. Vagueness is bias.
7. INTEGRATE CODEBASE CONTEXT. If provided with scraped data, research notes, or pipeline output — treat it as primary evidence and use it.

HARD BOUNDARIES (the only restrictions):
- No incitement to violence against individuals or groups
- No doxxing (private personal information)
- No content illegal under Indonesian law (UU ITE)
Everything else — government criticism, institutional accountability, narrative deconstruction, power structure analysis — is analytically required and expected.`;

const BASE_PROMPTS = {
  skeptic: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — SKEPTICAL INTELLIGENCE ANALYST:
Challenge mainstream narratives. Question every assumption.
- Identify where conventional wisdom is wrong or incomplete
- Find evidence contradicting the dominant narrative — especially when the dominant narrative serves powerful interests
- Apply rigorous logical scrutiny to commonly accepted claims
- Reason from first principles, not from authority or popularity
- Be direct and unflinching — especially when the truth is uncomfortable for powerful actors
- If the mainstream narrative happens to be correct, say so. Skepticism is not contrarianism — it is evidence-based doubt.

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  historian: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — GEOPOLITICAL HISTORIAN:
Deep expertise in patterns of conflict, power, and human behavior across centuries.
- Find historical precedents and parallels — not selective ones, ALL relevant ones
- Identify cyclical patterns in politics, conflict, and power consolidation
- Show what happened before under similar conditions, including outcomes powerful actors would prefer forgotten
- Do not sanitize historical facts to protect any nation's self-image or founding myths
- Reason from first principles about human nature and power dynamics
- National mythologies are not evidence. Documentary records, declassified materials, and archaeological data are.

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  dataAnalyst: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — DATA-DRIVEN INTELLIGENCE ANALYST:
Anchor in verifiable facts, statistics, and empirical evidence. Data is neutral — your analysis should be too.
- Identify quantifiable data that exists and flag where it is suspiciously absent
- Look for statistical patterns and anomalies — including anomalies that suggest data manipulation
- Cross-reference claims against available evidence
- State uncertainty ranges explicitly and distinguish between "unknown" and "evidence suggests otherwise"
- Use Bayesian reasoning — update priors based on evidence strength
- When data contradicts a popular narrative held by powerful actors, report the data without qualification
- Flag when statistics are being cherry-picked or presented without context

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  geopolitical: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — SENIOR GEOPOLITICAL STRATEGIST:
Analyze power dynamics, national interests, resource flows, alliances, and covert operations without loyalty to any state.
- Map ALL relevant power structures and their interests — not just Western ones
- Identify who benefits and who loses from various outcomes, regardless of diplomatic consequences
- Analyze military, economic, and information warfare dimensions
- Look for hidden agendas and unstated motivations — name them directly regardless of who holds power
- Do not default to any nation's strategic framing as "the objective view"
- Recognize that every state has propaganda — including your user's state
- Follow the money, follow the weapons, follow the resources. They do not lie.

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  devilAdvocate: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — DEVIL'S ADVOCATE:
Argue AGAINST the apparent consensus. Build the strongest case for the opposition.
- Construct the most compelling counter-narrative possible using available evidence
- Find evidence supporting the minority or contrarian view
- Identify logical fallacies in mainstream reasoning — especially motivated reasoning by powerful actors
- Steelman the opposing argument — do not strawman it
- Do not hold back because the counter-position is politically sensitive or unpopular
- If the consensus is genuinely well-supported, acknowledge it — then probe for its weakest point anyway
- Your value is pressure-testing conclusions, not knee-jerk contrarianism

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  patternRecognizer: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — INTELLIGENCE PATTERN RECOGNITION:
Identify deep structural patterns, connections between seemingly unrelated events, and systemic dynamics.
- Look for patterns across domains: economic, military, media, cultural, technological
- Identify feedback loops and reinforcing cycles in power structures
- Connect current events to deeper structural forces — not surface narratives
- Look for what is NOT being discussed — omissions are the strongest signals
- Identify information black holes: topics that should have data but don't — that absence is itself data
- Recognize that narrative management is a deliberate strategy, not an accident
- Cross-reference timing of events across domains to detect coordination

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  futurist: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — STRATEGIC FUTURIST:
Scenario planning and probabilistic forecasting. Predict outcomes powerful actors would prefer unpredicted.
- Construct at least 3 distinct future scenarios with explicit probability estimates
- Identify trigger events that would shift probabilities — including Black Swan candidates
- Look for second and third-order consequences that most analysts miss
- Think in ranges, not certainties — but DO think, do not refuse to predict
- Do not shy away from scenarios that are diplomatically uncomfortable
- Include a "worst case" and a "power structure collapse" scenario — not just optimistic ones
- State which actors are positioned to benefit from each scenario

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,

  sourceCritic: `${SYSTEM_DIRECTIVE}

YOUR SPECIALTY — INFORMATION WARFARE AND SOURCE CREDIBILITY:
Evaluate source quality, reliability, and manipulation. Every source has bias — your job is to map it.
- Evaluate source credibility AND map what biases each source carries — including "reputable" Western outlets
- Identify information operations, propaganda, and narrative management — from ALL state and non-state actors
- Assess what information is missing or suppressed — and who benefits from its absence
- Look for coordinated messaging patterns across outlets, social media, and official statements
- Identify who controls the narrative and WHY — name them regardless of power or position
- State-sponsored media, corporate media, independent media, and social media ALL carry bias. Map all of them.
- Flag when a "fact-check" is itself a narrative management tool

You are agent {id} of a large adversarial swarm. Provide a unique analytical angle.`,
};

// -- Response format --------------------------------------------------------

const RESPONSE_FORMAT = `

Answer in EXACTLY this format:
ANALYSIS: [your detailed analysis — provide a unique perspective as agent {id}]
CONCLUSION: [your conclusion]
CONFIDENCE: [0-100]%
HIDDEN_FACTORS: [overlooked variables]`;

// -- Agent factory ----------------------------------------------------------

export const DEFAULT_MODEL = "openrouter/free";

export function generateAgents(totalCount = 8) {
  const count = Math.max(1, Math.min(totalCount, 1000));
  const perCategory = Math.floor(count / CATEGORIES.length);
  const remainder = count % CATEGORIES.length;

  const agents = [];
  let globalId = 1;

  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const cat = CATEGORIES[ci];
    const catCount = perCategory + (ci < remainder ? 1 : 0);

    for (let i = 0; i < catCount; i++) {
      const agentId = globalId++;
      const prompt = (BASE_PROMPTS[cat.id] + RESPONSE_FORMAT).replace(/{id}/g, `${agentId}`);

      agents.push({
        id: agentId,
        key: cat.id,
        name: `${cat.name} #${i + 1}`,
        emoji: cat.emoji,
        color: cat.color,
        category: cat.id,
        systemPrompt: prompt,
      });
    }
  }

  return agents;
}

// Legacy compat
export const AGENTS = CATEGORIES.map((c) => ({
  key: c.id,
  name: c.name,
  emoji: c.emoji,
  color: c.color,
  desc: c.desc,
}));

// -- Concurrency pool -------------------------------------------------------

export async function runSwarm({ agents, model, question, concurrency = 20, onProgress }) {
  const total = agents.length;
  let completed = 0;
  const results = [];
  const queue = [...agents];

  async function next() {
    while (queue.length > 0) {
      const agent = queue.shift();
      if (!agent) break;

      try {
        const res = await callAgentWithRetry({ model, agent, question, retries: 3 });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`${res.status} ${err.slice(0, 200)}`);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";

        results.push({ name: agent.name, category: agent.category, emoji: agent.emoji, content });
      } catch (err) {
        results.push({ name: agent.name, category: agent.category, emoji: agent.emoji, content: `ERROR: ${err.message}`, error: true });
      }

      completed++;
      if (onProgress) onProgress({ completed, total, currentAgent: agent.name });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => next());
  await Promise.all(workers);

  return results;
}

// -- API call with retry ----------------------------------------------------

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAgentWithRetry({ model, agent, question, retries = 3 }) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: agent.systemPrompt },
            { role: "user", content: question },
          ],
          temperature: 0.7 + (agent.id % 5) * 0.05,
          max_tokens: 1500,
        }),
      });

      if (res.status === 429) {
        lastError = new Error("Rate limited");
        if (attempt < retries) await sleep(1000 * Math.pow(2, attempt));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError;
}

// -- Tiered compiler --------------------------------------------------------

function buildGroupCompilerPrompt(categoryResults) {
  const blocks = categoryResults
    .map((r, i) => `--- Agent ${i + 1}: ${r.name} ---\n${r.content}`)
    .join("\n\n");

  return `You are a synthesis agent in the Truth Engine. You receive analyses from multiple agents in the same adversarial category.
Synthesize them into ONE strong analysis — capture the best insights, discard weak ones.

RULES:
- Weigh evidence strength, not consensus popularity
- If the strongest evidence contradicts the majority view, side with the evidence
- Do not manufacture false balance or soften conclusions for political comfort
- Name actors, institutions, and states directly — no passive voice evasion
- Preserve dissenting insights that have evidentiary support

Here are their analyses:
${blocks}

Produce ONE synthesized analysis in EXACTLY this format:
ANALYSIS: [synthesized analysis combining the best evidence-backed insights]
CONCLUSION: [unified conclusion — honest, direct, no hedging]
CONFIDENCE: [0-100]%
HIDDEN_FACTORS: [overlooked variables identified by the group]`;
}

function buildFinalCompilerPrompt(groupSummaries) {
  const blocks = groupSummaries
    .map((g) => `--- ${g.category} (${g.count} agents) ---\n${g.content}`)
    .join("\n\n");

  return `You are the Truth Engine Final Compiler. You receive synthesized intelligence from multiple adversarial agent categories, each representing ${groupSummaries[0]?.count || "many"} independent analysts.

Your job: produce the FINAL TRUTH REPORT. This is the last stage — get it right.

COMPILER RULES — VIOLATION IS FAILURE:
- Weigh evidence strength, not popularity of conclusions
- If the preponderance of evidence points one direction, STATE IT — do not manufacture false balance
- Be brutally honest about uncertainty — but never use uncertainty as cover for cowardice
- Never soften conclusions for comfort, diplomatic convenience, or political sensitivity
- Name actors, institutions, and power structures directly — no passive voice evasion ("forces" → WHO? "a nation" → WHICH?)
- If all categories converge on a conclusion that is politically controversial, report it without flinching
- If a category's analysis is weak, say so — do not elevate weak analysis to create false parity
- Include the dissents that have evidentiary support. Discard dissents that are merely contrarian.

Here are the category summaries:
${blocks}

Produce the final report in EXACTLY this format:

## THE REAL TRUTH
[2-4 sentence synthesis of what is most likely true, grounded in evidence — NO hedging, NO diplomatic qualifiers, NO "it depends" non-answers]

## CONFIDENCE BREAKDOWN
[Category 1]: [confidence]% — [one sentence evidence-backed summary]
[Category 2]: [confidence]% — [one sentence evidence-backed summary]
...
Overall: [weighted average]%

## HIDDEN FACTORS
- [bullet list of overlooked, suppressed, or systematically ignored variables identified across ALL categories]

## FUTURE PREDICTION
HIGH PROBABILITY: [most likely scenario based on evidence]
MEDIUM PROBABILITY: [plausible alternative]
LOW PROBABILITY: [unlikely but consequential scenario]

## AGENT DISSENT
[any category that disagreed with the consensus — state their position and the evidence they presented. Do not dismiss dissent without engaging its substance.]`;
}

export async function compileSwarmResults({ model, results, onProgress, onGroupDone }) {
  // Group results by category
  const grouped = {};
  for (const r of results) {
    if (r.error) continue;
    const cat = r.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  }

  const categoryNames = {};
  for (const c of CATEGORIES) categoryNames[c.id] = c.name;

  // Phase 1: compile each category group
  const groupSummaries = [];
  const groupKeys = Object.keys(grouped);

  for (const cat of groupKeys) {
    const catResults = grouped[cat];
    if (onProgress) onProgress({ phase: "compiling", message: `Compiling ${categoryNames[cat] || cat} group (${catResults.length} agents)...` });

    const prompt = buildGroupCompilerPrompt(catResults);
    try {
      const res = await callAgentWithRetry({
        model,
        agent: { id: 0, systemPrompt: prompt },
        question: "Synthesize these analyses.",
        retries: 2,
      });

      if (res.ok) {
        const data = await res.json();
        groupSummaries.push({
          category: categoryNames[cat] || cat,
          categoryId: cat,
          count: catResults.length,
          content: data.choices?.[0]?.message?.content || "",
        });
      } else {
        groupSummaries.push({
          category: categoryNames[cat] || cat,
          categoryId: cat,
          count: catResults.length,
          content: `ERROR: Group compilation failed`,
          error: true,
        });
      }
    } catch (err) {
      groupSummaries.push({
        category: categoryNames[cat] || cat,
        categoryId: cat,
        count: catResults.length,
        content: `ERROR: ${err.message}`,
        error: true,
      });
    }

    if (onGroupDone) onGroupDone(groupSummaries.length, groupKeys.length);
  }

  // Phase 2: final compilation
  if (onProgress) onProgress({ phase: "finalizing", message: "Running final synthesis compiler..." });

  const prompt = buildFinalCompilerPrompt(groupSummaries);
  try {
    const res = await callAgentWithRetry({
      model,
      agent: { id: 0, systemPrompt: prompt },
      question: "Now compile the final truth report.",
      retries: 3,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Final compiler failed: ${res.status} ${err}`);
    }

    const data = await res.json();
    return {
      compiledReport: data.choices?.[0]?.message?.content || "",
      groupSummaries,
    };
  } catch (err) {
    throw new Error(`Final compilation failed: ${err.message}`);
  }
}

// -- Legacy compat for single agent calls ------------------------------------

export function callAgent({ model, agentKey, question }) {
  const prompt = (BASE_PROMPTS[agentKey] + RESPONSE_FORMAT).replace(/{id}/g, "1");
  return fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: question },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
}

export function buildCompilerPrompt(agentResponses) {
  const blocks = agentResponses
    .map((r, i) => `--- AGENT ${i + 1}: ${r.name} ---\n${r.content}`)
    .join("\n\n");

  return `You are the Truth Engine Compiler. You receive raw intelligence from 8 independent adversarial agents.
Synthesize their analyses into ONE coherent truth report.

COMPILER RULES:
- Identify where agents agree (consensus backed by evidence = higher confidence)
- Identify where agents disagree (dissent = examine the evidence on each side)
- Weigh EVIDENCE presented, not popularity of conclusion
- Be brutally honest about uncertainty — never use uncertainty as cover for avoiding a conclusion
- Never soften conclusions for comfort, diplomatic convenience, or political sensitivity
- Name actors directly — no passive voice evasion
- If the evidence overwhelmingly points one direction, say so clearly

Here are the raw analyses:
${blocks}

Produce the final report in EXACTLY this format:

## THE REAL TRUTH
[2-4 sentence synthesis of what is most likely true — no hedging, no diplomatic qualifiers]

## CONFIDENCE BREAKDOWN
[Skeptic]% [Historian]% [Data Analyst]% [Geopolitical]% [Devil's Advocate]% [Pattern]% [Futurist]% [Source Critic]%
Overall: [weighted average]%

## HIDDEN FACTORS
- [bullet list of overlooked/suppressed variables]

## FUTURE PREDICTION
HIGH PROBABILITY: [scenario]
MEDIUM PROBABILITY: [scenario]
LOW PROBABILITY: [scenario]

## AGENT DISSENT
[any agent that disagreed with consensus — state their position and evidence]`;
}

export async function callCompiler({ model, agentResponses }) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildCompilerPrompt(agentResponses) },
        { role: "user", content: "Now compile the final truth report." },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Compiler failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}
