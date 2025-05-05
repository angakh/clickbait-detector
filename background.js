/**
 * Background Script
 * Coordinates content extraction, LLM communication, and results management
 */

import LLMConnector from './lib/llm-connector.js';
import './link-analyzer.js'; // Import the link analyzer functionality

// Initialize the LLM connector
const llmConnector = new LLMConnector();

// Cached results to avoid redundant API calls
const cachedResults = {};

// Current analysis state
let currentAnalysis = {
  tabId: null,
  isAnalyzing: false
};

// Check if setup is complete when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First time installation
    await checkAndShowSetup();
  } else if (details.reason === 'update') {
    // Extension was updated
    const setupComplete = await checkSetupComplete();
    if (!setupComplete) {
      await checkAndShowSetup();
    }
  }
});

// Listen for setup completion message
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setupComplete') {
    // Setup is complete, initialize the extension
    initialize();
    sendResponse({ success: true });
  }
  return true; // Keep the message channel open for async response
});

// Initialize the extension
async function initialize() {
  await llmConnector.initialize();
  
  // Load user options
  const { options } = llmConnector.config;
  
  // Check if auto-analyze is enabled
  if (options && options.autoAnalyze) {
    // Set up tab update listener to automatically analyze pages
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
        setTimeout(() => {
          analyzeCurrentPage(tabId, false);
        }, 1000); // Wait a second for page to fully render
      }
    });
  }
  
  // Clear cached results when a tab is updated
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      delete cachedResults[tabId];
      updateBadge(tabId, null);
    }
  });
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle different message types
  switch (message.action) {
    case 'contentScriptReady':
      // The content script has loaded
      checkSetupComplete().then(setupComplete => {
        if (setupComplete) {
          // If setup is complete, we could trigger automatic analysis here
          if (llmConnector.config.options && llmConnector.config.options.autoAnalyze) {
            setTimeout(() => {
              analyzeCurrentPage(sender.tab.id, false);
            }, 500);
          }
        }
      });
      break;
      
    case 'analyzeCurrentPage':
      checkSetupComplete().then(setupComplete => {
        if (setupComplete) {
          analyzeCurrentPage(message.tabId).then(sendResponse);
        } else {
          checkAndShowSetup().then(() => {
            sendResponse({ 
              success: false, 
              error: 'Please complete the setup wizard first' 
            });
          });
        }
      });
      return true; // Keep the message channel open for async response
      
    case 'getAnalysisResult':
      const result = cachedResults[message.tabId];
      sendResponse({ 
        result, 
        isAnalyzing: currentAnalysis.isAnalyzing && currentAnalysis.tabId === message.tabId 
      });
      break;
      
    case 'checkLLMAvailability':
      llmConnector.checkAvailability().then(sendResponse);
      return true; // Keep the message channel open for async response
      
    case 'updateSettings':
      llmConnector.updateSettings(message.settings).then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep the message channel open for async response
      
    case 'getSettings':
      sendResponse({ settings: llmConnector.config });
      break;
      
    case 'getOllamaModels':
      llmConnector.getOllamaModels().then(sendResponse);
      return true; // Keep the message channel open for async response
      
    case 'checkSetupComplete':
      checkSetupComplete().then(setupComplete => {
        sendResponse({ setupComplete });
      });
      return true; // Keep the message channel open for async response
  }
});

/**
 * Check if setup is complete
 * @returns {Promise<boolean>} Whether setup is complete
 */
async function checkSetupComplete() {
  return new Promise((resolve) => {
    chrome.storage.local.get('setupComplete', (result) => {
      resolve(result.setupComplete === true);
    });
  });
}

/**
 * Check if setup is complete and show the setup wizard if not
 */
async function checkAndShowSetup() {
  const setupComplete = await checkSetupComplete();
  
  if (!setupComplete) {
    // Show the setup page
    chrome.tabs.create({
      url: chrome.runtime.getURL('setup/setup.html')
    });
  } else {
    // Initialize if setup is already complete
    initialize();
  }
  
  return setupComplete;
}

/**
 * Analyze the current page for clickbait
 * @param {number} tabId - The ID of the tab to analyze
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeCurrentPage(tabId) {
  try {
    // Check if we already have cached results
    if (cachedResults[tabId]) {
      return { 
        success: true, 
        result: cachedResults[tabId],
        cached: true
      };
    }
    
    // Update the current analysis state
    currentAnalysis = {
      tabId,
      isAnalyzing: true
    };
    
    // Update badge to show analyzing state
    updateBadge(tabId, 'analyzing');
    
    // Check if the LLM is available
    const isLLMAvailable = await llmConnector.checkAvailability();
    if (!isLLMAvailable) {
      throw new Error('Local LLM is not available. Please ensure it is running.');
    }
    
    // Extract content from the page
    const contentData = await extractContentFromTab(tabId);
    if (!contentData.success) {
      throw new Error(contentData.error || 'Failed to extract page content');
    }
    
    // Format the prompt for the LLM
    const prompt = llmConnector.formatClickbaitPrompt(contentData.data);
    
    // Send the prompt to the LLM
    const llmResponse = await llmConnector.generateResponse(prompt);
    
    // Parse the response to determine clickbait status
    const analysisResult = parseClickbaitResponse(llmResponse);
    
    // Add the URL to the result
    analysisResult.url = contentData.data.url;
    
    // Cache the result
    cachedResults[tabId] = analysisResult;
    
    // Update the badge
    updateBadge(tabId, analysisResult.isClickbait ? 'clickbait' : 'legitimate');
    
    // Reset the analysis state
    currentAnalysis = {
      tabId: null,
      isAnalyzing: false
    };
    
    return {
      success: true,
      result: analysisResult
    };
  } catch (error) {
    console.error('Analysis failed:', error);
    
    // Reset the analysis state
    currentAnalysis = {
      tabId: null,
      isAnalyzing: false
    };
    
    // Update badge to show error
    updateBadge(tabId, 'error');
    
    return {
      success: false,
      error: error.message || 'Analysis failed'
    };
  }
}

/**
 * Extract content from a tab
 * @param {number} tabId - The ID of the tab
 * @returns {Promise<Object>} The extracted content
 */
async function extractContentFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ 
          success: false, 
          error: chrome.runtime.lastError.message 
        });
        return;
      }
      
      resolve(response || { success: false, error: 'No response from content script' });
    });
  });
}

/**
 * Parse the LLM response to determine clickbait status
 * @param {string} response - The LLM's response
 * @returns {Object} Parsed result
 */
function parseClickbaitResponse(response) {
  // Check if the response contains the verdict
  const isClickbait = /CLICKBAIT/.test(response);
  
  // Extract the explanation (anything after the verdict)
  let explanation = response.match(/(?:CLICKBAIT|NOT CLICKBAIT)[:\s]+(.+?)(?:$|(?:\n\n))/is);
  explanation = explanation ? explanation[1].trim() : 'No explanation provided';
  
  return {
    isClickbait,
    explanation,
    rawResponse: response
  };
}

/**
 * Update the extension badge
 * @param {number} tabId - The ID of the tab
 * @param {string} status - The status to display
 */
function updateBadge(tabId, status) {
  if (!tabId) return;
  
  let text = '';
  let color = '#888888';
  
  switch (status) {
    case 'analyzing':
      text = '...';
      color = '#888888';
      break;
    case 'clickbait':
      text = 'CB!';
      color = '#E53935'; // Red
      break;
    case 'legitimate':
      text = 'OK';
      color = '#43A047'; // Green
      break;
    case 'error':
      text = 'ERR';
      color = '#FF9800'; // Orange
      break;
    default:
      text = '';
      break;
  }
  
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}