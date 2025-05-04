import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

// Agent Card is defined in /public/.well-known/agent.json

// --- Core Agent methods (analyzeData, createChart) are implemented in the API endpoint --- 
// const agent = { analyzeData, createChart }; // No longer exposed on window

console.log('Charting Agent page loaded. Card info below. Interaction via API endpoint.');

// --- Display Agent Card Info --- 

const cardElement = document.getElementById('agent-card')!;
const cardHeader = cardElement.querySelector('.card-header')!;
const cardBody = cardElement.querySelector('.card-body')!;

async function displayAgentCard() {
  try {
    const response = await fetch('/.well-known/agent.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch agent card: ${response.status} ${response.statusText}`);
    }
    const agentInfo = await response.json();

    // Remove loading state
    cardElement.classList.remove('loading');
    cardHeader.innerHTML = `<h2>${agentInfo.name || 'Charting Agent'}</h2>`; // Card Title

    // Populate card body
    cardBody.innerHTML = `
      <p><strong>Description:</strong> ${agentInfo.description || 'N/A'}</p>
      <p><strong>API Endpoint:</strong> <a href="${agentInfo.endpoint}" target="_blank">${agentInfo.endpoint}</a></p>
      <hr>
      <h4>Capabilities:</h4>
      <ul>
        <li>Accepts: <code>${(agentInfo.capabilities?.accepts || []).join(', ') || 'N/A'}</code></li>
        <li>Returns: <code>${(agentInfo.capabilities?.returns || []).join(', ') || 'N/A'}</code></li>
      </ul>
      <h4>Methods (via Endpoint):</h4>
      ${(agentInfo.methods || []).map((method: any) => `
        <div class="method">
          <strong>${method.name}</strong>
          <p><small>${method.description || ''}</small></p>
          <ul>
            <li>Accepts (in JSON body): <code>${typeof method.accepts === 'string' ? method.accepts : JSON.stringify(method.accepts)}</code></li>
            <li>Returns (in JSON response): <code>${typeof method.returns === 'string' ? method.returns : JSON.stringify(method.returns)}</code></li>
          </ul>
        </div>
      `).join('') || '<p>No methods defined.</p>'}
    `;

  } catch (error: any) {
    console.error("Error displaying agent card:", error);
    cardElement.classList.remove('loading');
    cardElement.classList.add('error');
    cardHeader.innerHTML = '<h2>Error Loading Agent Info</h2>';
    cardBody.innerHTML = `<p>${error.message}</p>`;
  }
}

displayAgentCard();

// Optional: Keep basic message in #app or remove/replace
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <!-- Can add other frontend elements here if needed -->
`
