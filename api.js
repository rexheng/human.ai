/**
 * Backend API client for AI social simulation.
 * Base URL: VITE_API_URL or http://localhost:8000
 */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function generateAgents(scenario, populationSize) {
  const res = await fetch(`${API_BASE}/generate_agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, population_size: populationSize }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function connectSimulationStream(scenario, populationSize, numRounds, onMessage) {
  const ws = new WebSocket(`${API_BASE.replace(/^http/, "ws")}/simulation_stream`);
  ws.onopen = () => {
    ws.send(JSON.stringify({
      scenario,
      population_size: populationSize,
      num_rounds: numRounds ?? 7,
    }));
  };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      onMessage({ type: "error", message: String(e) });
    }
  };
  ws.onerror = () => onMessage({ type: "error", message: "WebSocket error" });
  return ws;
}

export async function runSimulation(scenario, populationSize, numRounds) {
  const res = await fetch(`${API_BASE}/run_simulation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenario,
      population_size: populationSize ?? 25,
      num_rounds: numRounds ?? 7,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
