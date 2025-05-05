/**
 * Link Analyzer
 * Handles the context menu integration for analyzing links before visiting
 */

import LLMConnector from './lib/llm-connector.js';

// Create the context menu item when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "analyzeLink",
    title: "Check for clickbait",
    contexts: ["link"]
  });
});

// Handle the context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyzeLink" && info.linkUrl) {
    analyzeLinkForClickbait(info.linkUrl, tab.id);
  }
});

/**
 * Analyze a link for clickbait without visiting it
 * @param {string} url - The URL to analyze
 * @param {number} tabId - The ID of the tab
 */
async function analyzeLinkForClickbait(url, tabId) {
  try {
    // Show analyzing state
    chrome.action.setBadgeText({ 
      text: '...', 
      tabId 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#888888', 
      tabId 
    });
    
    // Create a notification that analysis is in progress
    chrome.notifications.create('analyzing_' + Date.now(), {
      type: 'basic',
      iconUrl: 'images/icon-128.png',
      title: 'Analyzing Link',
      message: 'Checking if the link is clickbait...',
      priority: 0
    });
    
    // Fetch the linked page content
    const response = await fetch(url);
    const html = await response.text();
    
    // Use DOMParser to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract the title
    const title = doc.title;
    
    // Extract the content (similar to content.js logic)
    const contentSelectors = [
      'article', 
      '[role="main"]', 
      'main', 
      '.content', 
      '#content',
      '.post-content',
      '.article-content',
      '.entry-content'
    ];
    
    let contentElement = null;
    
    // Try each selector until we find a matching element
    for (const selector of contentSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        contentElement = element;
        break;
      }
    }
    
    // If no specific content element is found, use the body as fallback
    if (!contentElement) {
      contentElement = doc.body;
      
      // Create a deep clone to avoid modifying the original document
      const bodyClone = contentElement.cloneNode(true);
      
      // Remove non-content elements
      const elementsToRemove = [
        'script', 'style', 'nav', 'header', 'footer', 
        'aside', '.sidebar', '#sidebar', '.navigation', 
        '.menu', '.comments', '.ad', '.advertisement'
      ];
      
      elementsToRemove.forEach(selector => {
        const elements = bodyClone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
      
      contentElement = bodyClone;
    }
    
    // Get the text content and clean it up
    let content = contentElement.textContent;
    content = content.replace(/\s+/g, ' ').trim();
    
    // Truncate content if it's too long
    const truncatedContent = content.length > 5000 
      ? content.substring(0, 5000) + "... [content truncated]" 
      : content;
    
    // Initialize LLM connector
    const llmConnector = new LLMConnector();
    await llmConnector.initialize();
    
    // Check if the LLM is available
    const isAvailable = await llmConnector.checkAvailability();
    if (!isAvailable) {
      throw new Error('Local LLM is not available. Please ensure it is running.');
    }
    
    // Format the prompt
    const prompt = llmConnector.formatClickbaitPrompt({
      title,
      content: truncatedContent,
      url
    });
    
    // Send to LLM for analysis
    const llmResponse = await llmConnector.generateResponse(prompt);
    
    // Parse the response
    const isClickbait = /CLICKBAIT/.test(llmResponse);
    
    // Extract explanation
    let explanation = llmResponse.match(/(?:CLICKBAIT|NOT CLICKBAIT)[:\s]+(.+?)(?:$|(?:\n\n))/is);
    explanation = explanation ? explanation[1].trim() : 'No explanation provided';
    
    // Update the badge
    chrome.action.setBadgeText({ 
      text: isClickbait ? 'CB!' : 'OK', 
      tabId 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: isClickbait ? '#E53935' : '#43A047', 
      tabId 
    });
    
    // Create a notification with the result
    chrome.notifications.create('result_' + Date.now(), {
      type: 'basic',
      iconUrl: isClickbait ? 'images/clickbait-yes.png' : 'images/clickbait-no.png',
      title: isClickbait ? 'Clickbait Detected!' : 'Not Clickbait',
      message: `"${title}" ${isClickbait ? 'appears to be clickbait' : 'does not appear to be clickbait'}. ${explanation}`,
      priority: 1
    });
    
    // Store the result in cache
    storeAnalysisResult(url, {
      isClickbait,
      title,
      explanation,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('Error analyzing link:', error);
    
    // Update the badge to show error
    chrome.action.setBadgeText({ 
      text: 'ERR', 
      tabId 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#FF9800', 
      tabId 
    });
    
    // Show error notification
    chrome.notifications.create('error_' + Date.now(), {
      type: 'basic',
      iconUrl: 'images/icon-128.png',
      title: 'Analysis Error',
      message: `Failed to analyze the link: ${error.message || 'Unknown error'}`,
      priority: 1
    });
  }
}

/**
 * Store the analysis result in cache
 * @param {string} url - The URL that was analyzed
 * @param {Object} result - The analysis result
 */
function storeAnalysisResult(url, result) {
  chrome.storage.local.get('analyzedLinks', (data) => {
    const analyzedLinks = data.analyzedLinks || {};
    
    // Store the result
    analyzedLinks[url] = result;
    
    // Limit cache size to 100 entries
    const urls = Object.keys(analyzedLinks);
    if (urls.length > 100) {
      // Remove oldest entries
      const oldestUrls = urls
        .map(u => ({ url: u, timestamp: analyzedLinks[u].timestamp }))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, urls.length - 100)
        .map(entry => entry.url);
      
      oldestUrls.forEach(oldUrl => {
        delete analyzedLinks[oldUrl];
      });
    }
    
    // Save back to storage
    chrome.storage.local.set({ analyzedLinks });
  });
}