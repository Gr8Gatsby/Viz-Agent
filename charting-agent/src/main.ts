import './style.css'

// Agent Card is defined in /public/.well-known/agent.json

// --- Core Agent methods (analyzeData, createChart) are implemented in the API endpoint --- 
// const agent = { analyzeData, createChart }; // No longer exposed on window

console.log('Charting Agent page loaded. Card info below. Interaction via API endpoint.');

// --- Display Agent Card Info --- 

const cardContainer = document.getElementById('agent-info-display')!;
const flipCard = cardContainer.querySelector('.flip-card')!;
const flipCardInner = cardContainer.querySelector('.flip-card-inner')!;

// Front elements
const nameElementFront = document.getElementById('agent-name-front')!;
const descriptionElementFront = document.getElementById('agent-description-front')!;
const versionElementFront = document.getElementById('agent-version-front')!;
const lastUpdatedElement = document.getElementById('agent-last-updated')!;
const locationElementFront = document.getElementById('agent-location-front')!;

// Back elements
const methodsListBack = document.getElementById('agent-methods-back')!;
const endpointElementBack = document.getElementById('agent-endpoint-back')!;

async function displayAgentCard() {
  try {
    const response = await fetch('/.well-known/agent.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch agent card: ${response.status} ${response.statusText}`);
    }
    const agentInfo = await response.json();

    // Remove loading state
    cardContainer.classList.remove('loading');

    // Populate card front
    nameElementFront.textContent = agentInfo.name || 'Charting Agent';
    descriptionElementFront.textContent = agentInfo.description || 'Agent description unavailable.';
    versionElementFront.textContent = agentInfo.version || 'N/A';
    lastUpdatedElement.textContent = agentInfo.lastUpdated?.startsWith('YYYY') ? 'N/A' : (agentInfo.lastUpdated || 'N/A');
    const agentJsonUrl = `${window.location.origin}/.well-known/agent.json`;
    locationElementFront.innerHTML = `<a href="${agentJsonUrl}" target="_blank">${agentJsonUrl}</a>`;

    // Populate card back (methods)
    methodsListBack.innerHTML = ''; // Clear loading text
    if (agentInfo.methods && agentInfo.methods.length > 0) {
      agentInfo.methods.forEach((method: any) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${method.name}</strong><br><small>${method.description || 'No description'}</small>`;
        methodsListBack.appendChild(li);
      });
    } else {
      methodsListBack.innerHTML = '<li>No methods defined.</li>';
    }
    endpointElementBack.innerHTML = `API Endpoint: <a href="${agentInfo.endpoint || '#'}" target="_blank">${agentInfo.endpoint || 'N/A'}</a>`;

    // Add click listener for flip
    flipCard.addEventListener('click', () => {
      console.log('Flip card clicked!');
      flipCardInner.classList.toggle('is-flipped');
    });

  } catch (error: any) {
    console.error("Error displaying agent card:", error);
    cardContainer.classList.remove('loading');
    cardContainer.classList.add('error');
    // Display error on the front
    nameElementFront.textContent = 'Error Loading Agent';
    descriptionElementFront.innerHTML = `<p>${error.message}</p>`;
    versionElementFront.textContent = 'N/A';
    lastUpdatedElement.textContent = 'N/A';
    locationElementFront.textContent = 'Error loading location';
  }
}

displayAgentCard();

// Optional: Keep basic message in #app or remove/replace
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <!-- Can add other frontend elements here if needed -->
`;
