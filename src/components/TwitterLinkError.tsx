import { useNavigate } from '@solidjs/router';
import { createSignal, onMount } from 'solid-js';
import { Button } from './ui/button';

const TwitterLinkError = () => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = createSignal('');

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const details = urlParams.get('details');
    switch (error) {
      case 'account_linked_to_other_user':
        setErrorMessage('This Twitter account is already linked to another user.');
        break;
      case 'check_existing_link_failed':
        setErrorMessage('An error occurred while checking for existing links. Please try again later.');
        break;
      case 'save_account_failed':
        setErrorMessage('An error occurred while saving your Twitter account. Please try again later.');
        break;
      case 'access_token_failure':
        setErrorMessage(`Failed to obtain access token from Twitter. ${details ? `Error: ${details}` : 'Please try again later.'}`);
        break;
      case 'missing_oauth_params':
        setErrorMessage('Missing OAuth parameters. Please try the linking process again.');
        break;
      default:
        setErrorMessage('An error occurred while linking your Twitter account.');
    }
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
