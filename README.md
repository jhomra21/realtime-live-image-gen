# Real-Time FLUX Image Generator

This project is a real-time AI image generator built using **SolidJS, Hono,** and **Together AI**. It allows users to input a text prompt and generate images based on that prompt using AI models. The application supports optional API key input for personalized usage and includes a **consistency mode** to maintain visual consistency across generated images.

> [!IMPORTANT]
> The application is deployed on Cloudflare Pages and can be accessed at:
>
>    [https://realtime-live-image-gen.pages.dev/](https://realtime-live-image-gen.pages.dev/)



## Features

- **Real-Time Image Generation**: Generate images based on text prompts using AI models.
- **Optional API Key**: Users can input their own API key for personalized usage.
- **Consistency Mode**: Enable consistency mode to maintain visual consistency across generated images. Uses custom seeding to achieve this.
- **Download Functionality**: Download generated images directly from the application.
- **Design**: Barebones simple design using Tailwind CSS.
- **Error Handling**: User-friendly error messages for better UX.
- **Tooltips**: Enhanced user interface with tooltips for guidance.
- **Google Login**: Seamless authentication using Google.
- **Previous Images**: View and select previously generated images.
- **Image Upload to R2**: Added functionality to upload generated images to an R2 bucket, providing persistent storage for user-generated content.
- **Third-Party Account Linking**: Users can link their Twitter accounts for additional features and integrations.

## Technologies Used

- **[SolidJS](https://docs.solidjs.com/)**: A declarative JavaScript library for building user interfaces.
- **[Hono](https://hono.dev/docs/)**: A small, simple, and ultrafast web framework for the Edge.
- **[Together AI](https://docs.together.ai/docs/introduction)**: An AI platform for building and deploying AI models.
- **[Upstash](https://upstash.com/docs/introduction)**: A serverless database for Redis and Kafka.
- **[TanStack Query](https://tanstack.com/query/latest/docs/framework/solid/overview)**: Powerful asynchronous state management for SolidJS.
- **[Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/solidjs)**: Used for authentication and database management, using Google login integration.
- **[Tailwind CSS](https://tailwindcss.com/)**: A utility-first CSS framework for styling.
- **Zod Validation**: Implemented Zod for request validation, ensuring data integrity and security across the application.
- **Twitter API Integration**: Utilized for linking and managing Twitter accounts.

## Deployment

The application is deployed using **Cloudflare Workers** and **Cloudflare Pages**:

- **Cloudflare Workers**: Used to handle server-side logic and API requests efficiently at the edge, providing low-latency responses.
- **Cloudflare Pages**: Hosts the static assets of the application, ensuring fast and reliable delivery of the client-side code.

## Previous Images

The application allows users to view and select previously generated images. This feature is implemented using local storage to save image data and a custom hook to retrieve and display the images.

- **Saving Images**: When an image is generated, it is saved to the browser's local storage. The `saveImage` function in `src/hooks/usePreviousImages.ts` handles this process by storing the image data along with a unique ID and timestamp.
  
- **Displaying Images**: The `usePreviousImages` hook retrieves the saved images from local storage and formats them for display. The `PreviousImages` component in `src/components/PreviousImages.tsx` uses this hook to render the images in a grid layout, allowing users to view and select them.

## Third-Party Account Linking

The application supports linking third-party accounts, such as Twitter, to enhance user experience and provide additional features.

- **Twitter Account Linking**: Users can link their Twitter accounts to the application. This feature is implemented using the Twitter API and Supabase for managing linked accounts(supabase auth itself is not used in this case, only to help store linked accounts data).

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

3. Open your browser and navigate to `http://localhost:5173` to access the application.

## Security

> [!CAUTION]
> **Never share your API keys publicly or with untrusted parties.** API keys are sensitive credentials that can be misused if exposed. 
> Always keep them secure and private.

## Tips

> [!TIP]
> Make sure to properly set .gitignore and .env if you are cloning this repo.

> [!TIP]
> Validate requests using Zod for enhanced security and data integrity.
