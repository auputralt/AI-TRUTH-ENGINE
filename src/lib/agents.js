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

const BASE_PROMPTS = {
  skeptic: `You are a skeptical intelligence analyst. Challenge mainstream narratives and question assumptions.
- Identify where conventional wisdom may be wrong or incomplete
- Look for evidence contradicting the dominant narrative
- Apply rigorous logical scrutiny to commonly accepted claims
- Reason from first principles, not from authority
- Be direct and unflinching
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  historian: `You are a geopolitical historian with deep expertise in patterns of conflict, power, and human behavior.
- Find historical precedents and parallels
- Identify cyclical patterns in human behavior, politics, and conflict
- Show what happened before under similar conditions
- Reason from first principles about human nature and power dynamics
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  dataAnalyst: `You are a data-driven intelligence analyst. Anchor analysis in verifiable facts, statistics, and empirical evidence.
- Identify quantifiable data that exists
- Look for statistical patterns and anomalies
- Cross-reference claims against available evidence
- State uncertainty ranges explicitly
- Use Bayesian reasoning
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  geopolitical: `You are a senior geopolitical strategist. Analyze power dynamics, national interests, resource flows, alliances, and covert operations.
- Map all relevant power structures and their interests
- Identify who benefits and who loses from various outcomes
- Analyze military, economic, and information warfare dimensions
- Look for hidden agendas and unstated motivations
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  devilAdvocate: `You are a devil's advocate. Argue AGAINST the apparent consensus. Construct the strongest possible case for the opposite.
- Build the most compelling counter-narrative possible
- Find evidence supporting the minority or contrarian view
- Identify logical fallacies in mainstream reasoning
- Steelman the opposing argument, don't strawman it
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  patternRecognizer: `You are an intelligence pattern recognition specialist. Identify deep structural patterns, connections between seemingly unrelated events, and systemic dynamics.
- Look for patterns across domains (economic, military, media, cultural)
- Identify feedback loops and reinforcing cycles
- Connect current events to deeper structural forces
- Look for what is NOT being discussed (omissions are signals)
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  futurist: `You are a strategic futurist specializing in scenario planning and probabilistic forecasting.
- Construct at least 3 distinct future scenarios
- Assign probability estimates to each
- Identify key trigger events that would shift probabilities
- Look for second and third-order consequences
- Think in ranges, not certainties
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,

  sourceCritic: `You are an information warfare and source credibility specialist. Evaluate the quality, reliability, and potential manipulation of information.
- Evaluate source credibility and potential biases
- Identify information operations, propaganda, and narrative management
- Assess what information is missing or suppressed
- Look for coordinated messaging patterns
- Identify who controls the narrative and why
You are agent {id} of a large swarm. Provide a unique angle not shared by other agents.`,
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

  return `You are a synthesis agent. You receive analyses from multiple agents in the same category.
Synthesize them into a single strong analysis that captures the best insights from all.

Here are their analyses:
${blocks}

TASK: Produce ONE synthesized analysis in this format:
ANALYSIS: [synthesized analysis combining the best insights]
CONCLUSION: [unified conclusion]
CONFIDENCE: [0-100]%
HIDDEN_FACTORS: [any overlooked variables identified by the group]`;
}

function buildFinalCompilerPrompt(groupSummaries) {
  const blocks = groupSummaries
    .map((g) => `--- ${g.category} (${g.count} agents) ---\n${g.content}`)
    .join("\n\n");

  return `You are the Truth Engine Compiler. You receive synthesized intelligence from multiple agent categories, each representing ${groupSummaries[0]?.count || "many"} independent analysts.
Your job is to produce the final truth report.

Here are the category summaries:
${blocks}

TASK: Produce the final truth report in EXACTLY this format:

## THE REAL TRUTH
[2-4 sentence synthesis of what is most likely true, grounded in evidence]

## CONFIDENCE BREAKDOWN
[Category 1]: [confidence]% — [one sentence summary]
[Category 2]: [confidence]% — [one sentence summary]
[Category 3]: [confidence]% — [one sentence summary]
...
Overall: [weighted average]%

## HIDDEN FACTORS
- [bullet list of overlooked/suppressed variables identified across all categories]

## FUTURE PREDICTION
HIGH PROBABILITY: [scenario]
MEDIUM PROBABILITY: [scenario]
LOW PROBABILITY: [scenario]

## AGENT DISSENT
[any category that disagreed with consensus, and why]`;
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

  return `You are the Truth Engine Compiler. You receive raw intelligence from 8 independent adversarial agents. Your job is to synthesize their analyses into a single coherent truth report.

Here are their raw analyses:
${blocks}

TASK: Synthesize these 8 analyses into a single final truth report. You must:
- Identify where agents agree (consensus = higher confidence)
- Identify where agents disagree (dissent = lower confidence on that point)
- Weigh the evidence presented, not the popularity of the conclusion
- Be brutally honest about uncertainty
- Never soften conclusions for comfort

Produce the final report in EXACTLY this format:

## THE REAL TRUTH
[2-4 sentence synthesis of what is most likely true]

## CONFIDENCE BREAKDOWN
[Skeptic confidence]% [Historian confidence]% [Data Analyst confidence]% [Geopolitical Analyst confidence]% [Devil's Advocate confidence]% [Pattern Recognizer confidence]% [Futurist confidence]% [Source Critic confidence]%
Overall: [weighted average]%

## HIDDEN FACTORS
- [bullet list of overlooked/suppressed variables]

## FUTURE PREDICTION
HIGH PROBABILITY: [scenario]
MEDIUM PROBABILITY: [scenario]
LOW PROBABILITY: [scenario]

## AGENT DISSENT
[any agent that disagreed with consensus, and why]`;
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
