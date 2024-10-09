# Real-Time AI Image Generator

This project is a real-time AI image generator built using **SolidJS, Hono,** and **Together AI**. It allows users to input a text prompt and generate images based on that prompt using AI models. The application supports optional API key input for personalized usage and includes a **consistency mode** to maintain visual consistency across generated images.

> [!IMPORTANT]
> The application is deployed on Cloudflare Pages and can be accessed at [https://realtime-live-image-gen.pages.dev/](https://realtime-live-image-gen.pages.dev/).

## Features

- **Real-Time Image Generation**: Generate images based on text prompts using AI models.
- **Optional API Key**: Users can input their own API key for personalized usage.
- **Consistency Mode**: Enable consistency mode to maintain visual consistency across generated images. Uses custom seeding to achieve this.
- **Download Functionality**: Download generated images directly from the application.
- **Design**: Barebones simple design using Tailwind CSS.

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
   git clone https://github.com/jhomra21/realtime-live-image-gen.git
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


> [!CAUTION]
> **Never share your API keys publicly or with untrusted parties.** API keys are sensitive credentials that can be misused if exposed. 
> Always keep them secure and private.

> [!TIP]
> Make sure to properly set .gitignore and .env if you are cloning this repo.
