/**
 * Content Script
 * Extracts the page title and content for clickbait analysis
 */

// Function to extract main content from the page
function extractMainContent() {
    // Get the document title
    const title = document.title;
    
    // Try to find the main content using common content selectors
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
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 200) {
        contentElement = element;
        break;
      }
    }
    
    // If no specific content element is found, use the body as fallback
    if (!contentElement) {
      // Create a deep clone to avoid modifying the actual page
      contentElement = document.body.cloneNode(true);
      
      // Remove script tags, style tags, navigation, headers, footers, and sidebars
      const elementsToRemove = [
        'script', 'style', 'nav', 'header', 'footer', 
        'aside', '.sidebar', '#sidebar', '.navigation', 
        '.menu', '.comments', '.ad', '.advertisement'
      ];
      
      elementsToRemove.forEach(selector => {
        const elements = contentElement.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
    }
    
    // Get the text content and clean it up
    let content = contentElement.textContent;
    content = content.replace(/\s+/g, ' ').trim();
    
    return {
      title,
      content,
      url: window.location.href
    };
  }
  
  // Extract data when the extension requests it
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractContent') {
      try {
        const pageData = extractMainContent();
        sendResponse({ success: true, data: pageData });
      } catch (error) {
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to extract content'
        });
      }
    }
    return true; // Required to use sendResponse asynchronously
  });
  
  // Let the extension know that the content script has been loaded
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });