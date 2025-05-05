# Clickbait Detector Chrome Extension

A Chrome extension that detects clickbait by comparing page titles with their content using a local LLM (Ollama or KoboldAI).

## Features

- **Clickbait Detection**: Analyzes page titles and content to determine if a page is clickbait
- **Link Analysis**: Right-click on links to check for clickbait before visiting
- **Local LLM Integration**: Connects to locally running AI models (Ollama or KoboldAI)
- **Multiple LLM Support**: Use either Ollama or KoboldAI for analysis
- **Customizable Settings**: Configure the LLM provider, model, and parameters
- **Visual Indicators**: See results directly on the extension icon
- **Detailed Results**: Get explanations of why content is or isn't clickbait

## Requirements

- Google Chrome browser (or Chromium-based browser)
- A locally running LLM server:
  - [Ollama](https://github.com/ollama/ollama) (recommended)
  - [KoboldAI](https://github.com/KoboldAI/KoboldAI-Client)

## Installation

### Install From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and visible in your toolbar

### Install Local LLM

#### Ollama (Recommended)
1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Start Ollama and pull a model: `ollama pull llama2` or another model of your choice
3. Make sure Ollama is running on http://localhost:11434 (default)

#### KoboldAI
1. Install KoboldAI from their [GitHub repository](https://github.com/KoboldAI/KoboldAI-Client)
2. Start KoboldAI with a compatible model
3. Make sure the API is accessible on http://localhost:5001 (default)

## Usage

### Checking the Current Page

1. Visit a webpage you want to analyze
2. Click the extension icon in the toolbar
3. The extension will analyze the page and show if it's clickbait or not
4. View the detailed explanation in the popup

### Checking Links Before Visiting

1. Right-click on any link on a webpage
2. Select "Check for clickbait" from the context menu
3. Wait for the analysis to complete
4. A notification will show the result
5. The extension icon will also update to indicate the result

### Configuring the Extension

1. Click the extension icon in the toolbar
2. Click the "Settings" button in the popup
3. Select your preferred LLM provider (Ollama or KoboldAI)
4. Configure the server URL, model (for Ollama), and parameters
5. Click "Test Connection" to verify the LLM is accessible
6. Click "Save Settings" to apply changes

## How It Works

1. The extension extracts the page title and main content
2. It connects to your local LLM through its API
3. The content is analyzed using a carefully designed prompt
4. The LLM determines if the title makes promises that aren't fulfilled in the content
5. Results are displayed in the extension popup and/or as notifications

## Troubleshooting

- **LLM Connection Issues**: Make sure your local LLM is running and accessible at the configured URL
- **Content Extraction Problems**: If the extension fails to analyze a page, try refreshing and analyzing again
- **Model Quality**: Different LLM models have varying accuracy - larger models generally perform better

## Privacy

- All analysis happens locally on your computer
- No data is sent to external servers
- Page content is only processed by your local LLM

## License

MIT License