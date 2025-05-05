/**
 * Popup Script
 * Handles the extension popup UI and interaction
 */

// DOM elements
const loadingElement = document.getElementById('loading');
const resultsElement = document.getElementById('results');
const errorElement = document.getElementById('error');
const errorMessageElement = document.getElementById('error-message');
const verdictContainer = document.getElementById('verdict-container');
const verdictElement = document.getElementById('verdict');
const explanationElement = document.getElementById('explanation-text');
const refreshButton = document.getElementById('refresh-button');
const retryButton = document.getElementById('retry-button');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');

// Settings elements
const providerRadios = document.querySelectorAll('input[name="provider"]');
const ollamaSettings = document.getElementById('ollama-settings');
const koboldaiSettings = document.getElementById('koboldai-settings');
const ollamaUrlInput = document.getElementById('ollama-url');
const ollamaModelSelect = document.getElementById('ollama-model');
const ollamaTemperatureInput = document.getElementById('ollama-temperature');
const ollamaTemperatureValue = document.getElementById('ollama-temperature-value');
const koboldaiUrlInput = document.getElementById('koboldai-url');
const koboldaiTemperatureInput = document.getElementById('koboldai-temperature');
const koboldaiTemperatureValue = document.getElementById('koboldai-temperature-value');
const refreshModelsButton = document.getElementById('refresh-models');
const testConnectionButton = document.getElementById('test-connection');
const saveSettingsButton = document.getElementById('save-settings');

// Current tab ID
let currentTabId = null;

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  // Check if setup is complete
  const setupComplete = await checkSetupComplete();
  
  if (!setupComplete) {
    // Redirect to setup page
    chrome.tabs.create({
      url: chrome.runtime.getURL('setup/setup.html')
    });
    window.close();
    return;
  }
  
  // Get the current tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tabs[0].id;
  
  // Set up event listeners
  setupEventListeners();
  
  // Load settings
  await loadSettings();
  
  // Start the analysis
  await checkAnalysisStatus();
});

/**
 * Check if setup is complete
 * @returns {Promise<boolean>} Whether setup is complete
 */
async function checkSetupComplete() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkSetupComplete' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        resolve(false);
        return;
      }
      
      resolve(response && response.setupComplete);
    });
  });
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  // Analysis buttons
  refreshButton.addEventListener('click', () => analyzeCurrentPage(true));
  retryButton.addEventListener('click', () => analyzeCurrentPage(true));
  
  // Settings toggle
  settingsToggle.addEventListener('click', toggleSettings);
  
  // Provider change
  providerRadios.forEach(radio => {
    radio.addEventListener('change', handleProviderChange);
  });
  
  // Temperature sliders
  ollamaTemperatureInput.addEventListener('input', () => {
    ollamaTemperatureValue.textContent = ollamaTemperatureInput.value;
  });
  
  koboldaiTemperatureInput.addEventListener('input', () => {
    koboldaiTemperatureValue.textContent = koboldaiTemperatureInput.value;
  });
  
  // Refresh Ollama models
  refreshModelsButton.addEventListener('click', loadOllamaModels);
  
  // Test connection
  testConnectionButton.addEventListener('click', testLLMConnection);
  
  // Save settings
  saveSettingsButton.addEventListener('click', saveSettings);
}

/**
 * Toggle settings panel visibility
 */
function toggleSettings() {
  settingsPanel.classList.toggle('hidden');
  
  // Update button text
  if (settingsPanel.classList.contains('hidden')) {
    settingsToggle.textContent = '⚙️ Settings';
  } else {
    settingsToggle.textContent = '⚙️ Hide Settings';
  }
}

/**
 * Handle provider change
 */
function handleProviderChange() {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  
  if (provider === 'ollama') {
    ollamaSettings.classList.remove('hidden');
    koboldaiSettings.classList.add('hidden');
  } else {
    ollamaSettings.classList.add('hidden');
    koboldaiSettings.classList.remove('hidden');
  }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (!response || !response.settings) {
        resolve();
        return;
      }
      
      const { provider, ollamaConfig, koboldaiConfig } = response.settings;
      
      // Set provider
      document.querySelector(`input[name="provider"][value="${provider}"]`).checked = true;
      handleProviderChange();
      
      // Set Ollama settings
      ollamaUrlInput.value = ollamaConfig.baseUrl;
      if (ollamaConfig.model) {
        // Check if the model exists in the dropdown
        let modelExists = false;
        for (let i = 0; i < ollamaModelSelect.options.length; i++) {
          if (ollamaModelSelect.options[i].value === ollamaConfig.model) {
            ollamaModelSelect.selectedIndex = i;
            modelExists = true;
            break;
          }
        }
        
        // If the model doesn't exist, add it
        if (!modelExists) {
          const option = document.createElement('option');
          option.value = ollamaConfig.model;
          option.textContent = ollamaConfig.model;
          ollamaModelSelect.appendChild(option);
          ollamaModelSelect.value = ollamaConfig.model;
        }
      }
      
      ollamaTemperatureInput.value = ollamaConfig.parameters.temperature;
      ollamaTemperatureValue.textContent = ollamaConfig.parameters.temperature;
      
      // Set KoboldAI settings
      koboldaiUrlInput.value = koboldaiConfig.baseUrl;
      koboldaiTemperatureInput.value = koboldaiConfig.parameters.temperature;
      koboldaiTemperatureValue.textContent = koboldaiConfig.parameters.temperature;
      
      // Load Ollama models
      loadOllamaModels();
      
      resolve();
    });
  });
}

/**
 * Load available Ollama models
 */
async function loadOllamaModels() {
  const models = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getOllamaModels' }, (models) => {
      resolve(models || []);
    });
  });
  
  // Save the currently selected model
  const currentModel = ollamaModelSelect.value;
  
  // Clear existing options except the first two
  while (ollamaModelSelect.options.length > 2) {
    ollamaModelSelect.remove(2);
  }
  
  // Add new models
  models.forEach(model => {
    if (model === 'llama2' || model === 'mistral') {
      return; // Skip models that are already in the dropdown
    }
    
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    ollamaModelSelect.appendChild(option);
  });
  
  // Restore the selected model if it still exists
  if (currentModel) {
    for (let i = 0; i < ollamaModelSelect.options.length; i++) {
      if (ollamaModelSelect.options[i].value === currentModel) {
        ollamaModelSelect.selectedIndex = i;
        break;
      }
    }
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  
  const settings = {
    provider,
    ollamaConfig: {
      baseUrl: ollamaUrlInput.value,
      model: ollamaModelSelect.value,
      parameters: {
        temperature: parseFloat(ollamaTemperatureInput.value),
        max_tokens: 500 // Keep the default
      }
    },
    koboldaiConfig: {
      baseUrl: koboldaiUrlInput.value,
      parameters: {
        temperature: parseFloat(koboldaiTemperatureInput.value),
        max_length: 500, // Keep the default
        max_context_length: 2048 // Keep the default
      }
    }
  };
  
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'updateSettings', settings }, (response) => {
      if (response && response.success) {
        // Show success message
        alert('Settings saved successfully');
      } else {
        // Show error message
        alert('Failed to save settings: ' + (response?.error || 'Unknown error'));
      }
      resolve();
    });
  });
}

/**
 * Test connection to the LLM
 */
async function testLLMConnection() {
  // Save settings first
  await saveSettings();
  
  // Show loading state
  testConnectionButton.textContent = 'Testing...';
  testConnectionButton.disabled = true;
  
  // Check LLM availability
  const isAvailable = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkLLMAvailability' }, (isAvailable) => {
      resolve(isAvailable);
    });
  });
  
  // Reset button state
  testConnectionButton.disabled = false;
  
  if (isAvailable) {
    testConnectionButton.textContent = 'Connection Successful';
    setTimeout(() => {
      testConnectionButton.textContent = 'Test Connection';
    }, 2000);
  } else {
    testConnectionButton.textContent = 'Connection Failed';
    setTimeout(() => {
      testConnectionButton.textContent = 'Test Connection';
    }, 2000);
    alert('Failed to connect to the LLM. Please check the URL and ensure the LLM is running.');
  }
}

/**
 * Check the current analysis status
 */
async function checkAnalysisStatus() {
  // Show loading state
  showState('loading');
  
  // Check if we have a cached result
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ 
      action: 'getAnalysisResult', 
      tabId: currentTabId 
    }, (response) => {
      resolve(response);
    });
  });
  
  if (response && response.result) {
    // We have a result, show it
    displayResult(response.result);
  } else if (response && response.isAnalyzing) {
    // Analysis is in progress, keep showing loading
    setTimeout(checkAnalysisStatus, 1000);
  } else {
    // No analysis yet, start a new one
    await analyzeCurrentPage(false);
  }
}

/**
 * Analyze the current page
 * @param {boolean} forceRefresh - Whether to force a refresh of the analysis
 */
async function analyzeCurrentPage(forceRefresh = false) {
  // Show loading state
  showState('loading');
  
  // Send message to background script
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ 
      action: 'analyzeCurrentPage', 
      tabId: currentTabId,
      forceRefresh
    }, (response) => {
      resolve(response);
    });
  });
  
  if (response && response.success) {
    // We have a result, show it
    displayResult(response.result);
  } else {
    // Error occurred
    showError(response?.error || 'Failed to analyze page');
  }
}

/**
 * Display the analysis result
 * @param {Object} result - The analysis result
 */
function displayResult(result) {
  // Show results state
  showState('results');
  
  // Set verdict
  verdictElement.textContent = result.isClickbait ? 'Clickbait Detected' : 'Not Clickbait';
  
  // Set explanation
  explanationElement.textContent = result.explanation;
  
  // Update verdict container class
  verdictContainer.className = 'verdict-container';
  verdictContainer.classList.add(result.isClickbait ? 'verdict-clickbait' : 'verdict-not-clickbait');
}

/**
 * Show an error message
 * @param {string} message - The error message
 */
function showError(message) {
  // Show error state
  showState('error');
  
  // Set error message
  errorMessageElement.textContent = message;
}

/**
 * Show a specific state (loading, results, or error)
 * @param {string} state - The state to show
 */
function showState(state) {
  // Hide all states
  loadingElement.classList.add('hidden');
  resultsElement.classList.add('hidden');
  errorElement.classList.add('hidden');
  
  // Show the requested state
  switch (state) {
    case 'loading':
      loadingElement.classList.remove('hidden');
      break;
    case 'results':
      resultsElement.classList.remove('hidden');
      break;
    case 'error':
      errorElement.classList.remove('hidden');
      break;
  }
}