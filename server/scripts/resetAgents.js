import { pool, query } from '../db.js';
import { getDefaultAgents } from '../services/aiPrompts.js';

async function resetAgents() {
  const agents = getDefaultAgents();
  for (const agent of agents) {
    await query(
      `UPDATE agents
       SET name = $1,
           model = $2,
           system_prompt = $3,
           temperature = $4,
           max_tokens = $5,
           top_p = $6,
           presence_penalty = $7,
           frequency_penalty = $8,
           is_enabled = $9,
           sort_order = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = $11`,
      [
        agent.name,
        agent.model,
        agent.system_prompt,
        agent.temperature,
        agent.max_tokens,
        agent.top_p,
        agent.presence_penalty,
        agent.frequency_penalty,
        agent.is_enabled,
        agent.sort_order,
        agent.slug,
      ]
    );
  }
  console.log(`Reset ${agents.length} agents to defaults.`);
  await pool.end();
}

resetAgents().catch(err => {
  console.error(err);
  process.exit(1);
});
