/**
 * Setup Wizard Script
 * Handles the setup process for the Clickbait Detector extension
 */

import LLMConnector from '../lib/llm-connector.js';

// DOM elements
const progressSteps = document.querySelectorAll('.progress-step');
const progressLines = document.querySelectorAll('.progress-line');
const setupSteps = document.querySelectorAll('.setup-step');

// Provider options
const providerOptions = document.querySelectorAll('.provider-option');
const providerRadios = document.querySelectorAll('input[name="provider"]');
const ollamaUrlInput = document.getElementById('ollama-url');
const ollamaModelSelect = document.getElementById('ollama-model');
const koboldaiUrlInput = document.getElementById('koboldai-url');
const refreshModelsButton = document.getElementById('refresh-models');

// Test connection elements
const testConnectionButton = document.getElementById('test-connection');
const testResult = document.getElementById('test-result');
const testSuccess = document.getElementById('test-success');
const testError = document.getElementById('test-error');
const errorMessage = document.getElementById('error-message');

// Option checkboxes
const autoAnalyzeCheckbox = document.getElementById('auto-analyze');
const showNotificationsCheckbox = document.getElementById('show-notifications');

// Navigation buttons
const next1Button = document.getElementById('next-1');
const next2Button = document.getElementById('next-2');
const back2Button = document.getElementById('back-2');
const back3Button = document.getElementById('back-3');
const completeSetupButton = document.getElementById('complete-setup');

// Current step
let currentStep = 1;

// LLM connector instance
const llmConnector = new LLMConnector();

// Initialize the setup wizard
document.addEventListener('DOMContentLoaded', async () => {
  // Set up event listeners
  setupEventListeners();
  
  // Initialize the LLM connector
  await llmConnector.initialize();
  
  // Try to load Ollama models if available
  loadOllamaModels();
});

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
  // Navigation buttons
  next1Button.addEventListener('click', () => goToStep(2));
  next2Button.addEventListener('click', () => goToStep(3));
  back2Button.addEventListener('click', () => goToStep(1));
  back3Button.addEventListener('click', () => goToStep(2));
  completeSetupButton.addEventListener('click', completeSetup);
  
  // Provider selection
  providerRadios.forEach(radio => {
    radio.addEventListener('change', handleProviderChange);
  });
  
  providerOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      // Don't toggle if clicking on an input or select
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        const radio = option.querySelector('input[type="radio"]');
        radio.checked = true;
        handleProviderChange();
      }
    });
  });
  
  // Refresh Ollama models
  refreshModelsButton.addEventListener('click', loadOllamaModels);
  
  // Test connection
  testConnectionButton.addEventListener('click', testConnection);
}

/**
 * Handle provider change
 */
function handleProviderChange() {
  const selectedProvider = document.querySelector('input[name="provider"]:checked').value;
  
  // Update provider option styling
  providerOptions.forEach(option => {
    if (option.dataset.provider === selectedProvider) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });
}

/**
 * Load available Ollama models
 */
async function loadOllamaModels() {
  refreshModelsButton.textContent = '↻';
  refreshModelsButton.disabled = true;
  
  try {
    // Get server URL from input
    const serverUrl = ollamaUrlInput.value;
    
    // Temporarily update connector config
    await llmConnector.updateSettings({
      provider: 'ollama',
      ollamaConfig: {
        baseUrl: serverUrl
      }
    });
    
    // Get available models
    const models = await llmConnector.getOllamaModels();
    
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
    
    refreshModelsButton.textContent = '✓';
    setTimeout(() => {
      refreshModelsButton.textContent = '↻';
      refreshModelsButton.disabled = false;
    }, 1000);
  } catch (error) {
    console.error('Failed to load Ollama models:', error);
    refreshModelsButton.textContent = '✗';
    setTimeout(() => {
      refreshModelsButton.textContent = '↻';
      refreshModelsButton.disabled = false;
    }, 1000);
  }
}

/**
 * Test the LLM connection
 */
async function testConnection() {
  // Show testing state
  testConnectionButton.textContent = 'Testing...';
  testConnectionButton.disabled = true;
  testResult.classList.add('hidden');
  
  try {
    // Get the selected provider and configuration
    const provider = document.querySelector('input[name="provider"]:checked').value;
    let config = {
      provider
    };
    
    if (provider === 'ollama') {
      config.ollamaConfig = {
        baseUrl: ollamaUrlInput.value,
        model: ollamaModelSelect.value
      };
    } else {
      config.koboldaiConfig = {
        baseUrl: koboldaiUrlInput.value
      };
    }
    
    // Update the connector with the new settings
    await llmConnector.updateSettings(config);
    
    // Test the connection
    const isAvailable = await llmConnector.checkAvailability();
    
    // Show the result
    testResult.classList.remove('hidden');
    
    if (isAvailable) {
      testSuccess.classList.remove('hidden');
      testError.classList.add('hidden');
      // Enable complete button
      completeSetupButton.disabled = false;
    } else {
      testSuccess.classList.add('hidden');
      testError.classList.remove('hidden');
      errorMessage.textContent = `Connection failed. Please check that your ${provider === 'ollama' ? 'Ollama' : 'KoboldAI'} server is running.`;
      // Disable complete button
      completeSetupButton.disabled = true;
    }
  } catch (error) {
    console.error('Connection test failed:', error);
    testResult.classList.remove('hidden');
    testSuccess.classList.add('hidden');
    testError.classList.remove('hidden');
    errorMessage.textContent = `Error: ${error.message || 'Failed to connect'}`;
    // Disable complete button
    completeSetupButton.disabled = true;
  }
  
  // Reset button state
  testConnectionButton.textContent = 'Test Connection';
  testConnectionButton.disabled = false;
}

/**
 * Navigate to a specific step
 * @param {number} step - The step number to go to
 */
function goToStep(step) {
  // Update the current step
  currentStep = step;
  
  // Update the progress steps
  progressSteps.forEach(progressStep => {
    const stepNumber = parseInt(progressStep.dataset.step);
    
    if (stepNumber === currentStep) {
      progressStep.classList.add('active');
    } else if (stepNumber < currentStep) {
      progressStep.classList.remove('active');
      progressStep.classList.add('completed');
    } else {
      progressStep.classList.remove('active', 'completed');
    }
  });
  
  // Update the progress lines
  progressLines.forEach((line, index) => {
    if (index + 1 < currentStep) {
      line.classList.add('completed');
    } else {
      line.classList.remove('completed');
    }
  });
  
  // Show the current step and hide others
  setupSteps.forEach(step => {
    if (parseInt(step.dataset.step) === currentStep) {
      step.classList.add('active');
    } else {
      step.classList.remove('active');
    }
  });
  
  // Special actions for each step
  if (currentStep === 2) {
    // Select the first provider option by default
    if (!document.querySelector('input[name="provider"]:checked')) {
      providerRadios[0].checked = true;
    }
    handleProviderChange();
  } else if (currentStep === 3) {
    // Disable the complete button by default until connection is tested
    completeSetupButton.disabled = true;
  }
}

/**
 * Complete the setup and save the settings
 */
async function completeSetup() {
  // Show loading state
  completeSetupButton.textContent = 'Saving...';
  completeSetupButton.disabled = true;
  
  try {
    // Get the selected provider and configuration
    const provider = document.querySelector('input[name="provider"]:checked').value;
    let config = {
      provider
    };
    
    if (provider === 'ollama') {
      config.ollamaConfig = {
        baseUrl: ollamaUrlInput.value,
        model: ollamaModelSelect.value
      };
    } else {
      config.koboldaiConfig = {
        baseUrl: koboldaiUrlInput.value
      };
    }
    
    // Add options
    config.options = {
      autoAnalyze: autoAnalyzeCheckbox.checked,
      showNotifications: showNotificationsCheckbox.checked
    };
    
    // Save the settings
    await llmConnector.updateSettings(config);
    
    // Save the setup complete flag
    chrome.storage.local.set({ setupComplete: true }, () => {
      // Close the setup page and open the popup
      chrome.runtime.sendMessage({ action: 'setupComplete' });
      window.close();
    });
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings: ' + error.message);
    
    // Reset button state
    completeSetupButton.textContent = 'Complete Setup';
    completeSetupButton.disabled = false;
  }
}