import { useNavigate } from '@solidjs/router';
import { createSignal, onMount } from 'solid-js';
import { Button } from './ui/button';

const TwitterLinkError = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = createSignal('');

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    setErrorMessage(error || 'An error occurred while linking your Twitter account.');
  });

  const handleGoToGenerate = () => {
    navigate('/generate');
  };

  return (
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <div class="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-6">
        <h1 class="text-2xl font-bold text-center mb-4">Twitter Linking Error</h1>
        <p class="text-center mb-6">{errorMessage()}</p>
        <Button
          onClick={handleGoToGenerate}
          class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Generate Page
        </Button>
      </div>
    </div>
  );
};

export default TwitterLinkError;