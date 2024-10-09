# Real-Time AI Image Generator

This project is a real-time AI image generator built using SolidJS, Hono, and Together AI. It allows users to input a text prompt and generate images based on that prompt using AI models. The application supports optional API key input for personalized usage and includes a consistency mode to maintain visual consistency across generated images.

## Features

- **Real-Time Image Generation**: Generate images based on text prompts using AI models.
- **Optional API Key**: Users can input their own API key for personalized usage.
- **Consistency Mode**: Enable consistency mode to maintain visual consistency across generated images.
- **Download Functionality**: Download generated images directly from the application.
- **Responsive Design**: Built with a responsive UI using Tailwind CSS.

## Technologies Used

- **[SolidJS](https://docs.solidjs.com/)**: A declarative JavaScript library for building user interfaces.
- **[Hono](https://hono.dev/docs/)**: A small, simple, and ultrafast web framework for the Edge.
- **[Together AI](https://docs.together.ai/docs/introduction)**: An AI platform for building and deploying AI models.
- **[Upstash](https://upstash.com/docs/introduction)**: A serverless database for Redis and Kafka.
- **[TanStack Query](https://tanstack.com/query/latest/docs/framework/solid/overview)**: Powerful asynchronous state management for SolidJS.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) - A fast all-in-one JavaScript runtime.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/realtime-live-image-gen.git
   cd realtime-live-image-gen
   ```

2. Install dependencies using Bun:

   ```bash
   bun install
   ```

### Running the Application

1. Start the server:

   ```bash
   bun run src/server.ts
   ```

2. Start the client:

   ```bash
   bun run --bun vite
   ```

3. Open your browser and navigate to `http://localhost:3000` to access the application.

### Building for Production

To build the application for production, run:
