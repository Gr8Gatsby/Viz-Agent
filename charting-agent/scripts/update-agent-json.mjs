import fs from 'fs/promises';
import path from 'path';

// Path to agent.json relative to the project root
const agentJsonPath = path.resolve('public/.well-known/agent.json'); 

async function updateTimestamp() {
  try {
    console.log(`Updating timestamp in ${agentJsonPath}...`);
    
    // Get current timestamp in ISO 8601 format
    const timestamp = new Date().toISOString();
    
    // Read the file
    const fileContent = await fs.readFile(agentJsonPath, 'utf-8');
    
    // Parse the JSON
    const jsonData = JSON.parse(fileContent);
    
    // Update the lastUpdated field
    jsonData.lastUpdated = timestamp;
    
    // Convert back to JSON string (with indentation)
    const updatedJsonContent = JSON.stringify(jsonData, null, 2); // Using 2 spaces for indentation
    
    // Write the updated content back to the file
    await fs.writeFile(agentJsonPath, updatedJsonContent + '\\n', 'utf-8'); // Add newline at end
    
    console.log(`Successfully updated lastUpdated to: ${timestamp}`);
  } catch (error) {
    console.error('Error updating agent.json timestamp:', error);
    process.exit(1); // Exit with error code if update fails
  }
}

updateTimestamp(); 