# MyNarrator — AI Reading Assistant

Turn documents into spoken audio with **MyNarrator**, a React and TypeScript reading assistant featuring AI-generated voices, system speech fallback, and document-based listening controls.

## Features

- **Multiple document formats:** Upload PDF, DOCX, and TXT files.
- **AI voice generation:** Access a selection of 20 AI voice options powered by Gemini.
- **System voice fallback:** Use browser-provided speech voices when AI speech is unavailable or when a system voice is selected.
- **Flexible listening:** Read the current page aloud or generate audio for the full document.
- **Playback controls:** Pause, resume, stop, and adjust playback speed.
- **Audio downloads:** Export supported generated audio as WAV or MP3.
- **Reading interface:** View document text with page navigation and reading controls.
- **Responsive interface:** Built with React, TypeScript, and Vite.

## Tech Stack

- React 19 and TypeScript
- Vite
- Google GenAI SDK
- PDF.js for PDF parsing
- Mammoth for DOCX parsing
- Web Audio API and browser speech synthesis
- Lucide React for icons

## Getting Started

### Prerequisites

- Node.js and npm
- A Gemini API key for AI-generated speech

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/reborn742/mynarrator.git
   cd mynarrator
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure your Gemini API key using the environment variable expected by the project.

   **Important:** Check `services/geminiService.ts` and `vite.config.ts` to confirm how the API key is read and exposed before configuring it. Do not commit API keys or other secrets to GitHub.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite in your browser.

### Production Build

Build the application:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Using MyNarrator

1. Upload a supported document.
2. Choose an available voice.
3. Start listening to the current page or generate audio for the full document.
4. Adjust playback speed and use the playback controls as needed.
5. Download supported generated audio in WAV or MP3 format.

AI voice generation requires a working Gemini API configuration and is subject to API availability and usage limits. Browser-based speech depends on the voices available in your browser and operating system.

## Security Notes

- Keep API keys private and out of source control.
- Review the API-key handling and deployment configuration before publishing a production deployment.
- Treat uploaded documents as potentially sensitive and review how document text is processed before using confidential material.

## Project Status

MyNarrator is a document-reading application built with modern web technologies. Feature availability depends on the configured API, browser capabilities, and the current implementation.

## License

No license is specified in this repository. Unless a license is added, reuse and redistribution are not automatically granted.
