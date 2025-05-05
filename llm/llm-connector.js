/**
 * LLM Connector Library
 * Handles communication with local LLM APIs (Ollama and KoboldAI)
 */

class LLMConnector {
    constructor() {
      // Default configuration
      this.config = {
        provider: 'ollama', // 'ollama' or 'koboldai'
        ollamaConfig: {
          baseUrl: 'http://localhost:11434',
          model: 'llama2', // Default model
          parameters: {
            temperature: 0.3,
            max_tokens: 500
          }
        },
        koboldaiConfig: {
          baseUrl: 'http://localhost:5001',
          parameters: {
            temperature: 0.7,
            max_length: 500,
            max_context_length: 2048
          }
        },
        options: {
          autoAnalyze: false,  // Whether to analyze pages automatically
          showNotifications: true  // Whether to show notifications for detected clickbait
        }
      };
    }
  
    /**
     * Initialize connector with stored settings
     */
    async initialize() {
      return new Promise((resolve) => {
        chrome.storage.local.get('llmSettings', (result) => {
          if (result.llmSettings) {
            this.config = { ...this.config, ...result.llmSettings };
          }
          resolve();
        });
      });
    }
  
    /**
     * Save current settings to storage
     */
    async saveSettings() {
      return new Promise((resolve) => {
        chrome.storage.local.set({ 'llmSettings': this.config }, resolve);
      });
    }
  
    /**
     * Update connector settings
     * @param {Object} newSettings - New settings to apply
     */
    async updateSettings(newSettings) {
      this.config = { ...this.config, ...newSettings };
      await this.saveSettings();
    }
  
    /**
     * Check if the selected LLM provider is available
     * @returns {Promise<boolean>} Whether the LLM is available
     */
    async checkAvailability() {
      try {
        if (this.config.provider === 'ollama') {
          const response = await fetch(`${this.config.ollamaConfig.baseUrl}/api/health`);
          return response.ok;
        } else if (this.config.provider === 'koboldai') {
          const response = await fetch(`${this.config.koboldaiConfig.baseUrl}/api/v1/info`);
          return response.ok;
        }
        return false;
      } catch (error) {
        console.error('LLM availability check failed:', error);
        return false;
      }
    }
  
    /**
     * Get a list of available Ollama models
     * @returns {Promise<Array<string>>} List of model names
     */
    async getOllamaModels() {
      try {
        const response = await fetch(`${this.config.ollamaConfig.baseUrl}/api/tags`);
        if (!response.ok) throw new Error('Failed to fetch models');
        
        const data = await response.json();
        return data.models.map(model => model.name);
      } catch (error) {
        console.error('Failed to get Ollama models:', error);
        return [];
      }
    }
  
    /**
     * Generate a response from the LLM
     * @param {string} prompt - The prompt to send to the LLM
     * @returns {Promise<string>} The LLM's response
     */
    async generateResponse(prompt) {
      try {
        if (this.config.provider === 'ollama') {
          return await this.generateOllamaResponse(prompt);
        } else if (this.config.provider === 'koboldai') {
          return await this.generateKoboldAIResponse(prompt);
        }
        throw new Error('Unknown LLM provider');
      } catch (error) {
        console.error('LLM generation failed:', error);
        throw error;
      }
    }
  
    /**
     * Generate a response using Ollama
     * @param {string} prompt - The prompt to send to Ollama
     * @returns {Promise<string>} Ollama's response
     */
    async generateOllamaResponse(prompt) {
      const { baseUrl, model, parameters } = this.config.ollamaConfig;
      
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt,
          ...parameters
        })
      });
  
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }
  
      const data = await response.json();
      return data.response;
    }
  
    /**
     * Generate a response using KoboldAI
     * @param {string} prompt - The prompt to send to KoboldAI
     * @returns {Promise<string>} KoboldAI's response
     */
    async generateKoboldAIResponse(prompt) {
      const { baseUrl, parameters } = this.config.koboldaiConfig;
      
      const response = await fetch(`${baseUrl}/api/v1/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          ...parameters
        })
      });
  
      if (!response.ok) {
        throw new Error(`KoboldAI API error: ${response.status}`);
      }
  
      const data = await response.json();
      return data.results[0].text;
    }
  
    /**
     * Format the clickbait detection prompt
     * @param {Object} pageData - Data extracted from the webpage
     * @returns {string} Formatted prompt for the LLM
     */
    formatClickbaitPrompt(pageData) {
      const { title, content } = pageData;
      
      // Truncate content if it's too long (to avoid token limits)
      const truncatedContent = content.length > 5000 
        ? content.substring(0, 5000) + "... [content truncated]" 
        : content;
      
      return `
  You are an AI assistant tasked with detecting clickbait. I'll provide a webpage title and its content, and you need to determine if the title is clickbait.
  
  Definition of clickbait: A title that makes exaggerated, misleading, or unfulfilled promises about the content to attract attention.
  
  Page Title: "${title}"
  
  Page Content (beginning): 
  ${truncatedContent}
  
  Answer the following questions with brief explanations:
  1. Does the title make specific promises or claims? If yes, what are they?
  2. Are these promises or claims adequately fulfilled in the content?
  3. Does the title use emotional language, hyperbole, or sensationalism?
  4. Is there a significant mismatch between what the title suggests and what the content actually provides?
  
  Based on these factors, provide your verdict: Is this title clickbait? Answer only with "CLICKBAIT" or "NOT CLICKBAIT" followed by a 1-2 sentence explanation.
  `;
    }
  }
  
  // Export the class
  export default LLMConnector;