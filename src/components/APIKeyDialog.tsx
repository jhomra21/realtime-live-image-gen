import { createSignal, Show } from 'solid-js';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface APIKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => void;
  initialApiKey: string;
}

export const APIKeyDialog = (props: APIKeyDialogProps) => {
  const [userAPIKey, setUserAPIKey] = createSignal(props.initialApiKey);
  const [apiKeyError, setApiKeyError] = createSignal('');

  const validateAPIKey = (key: string) => {
    const apiKeyRegex = /^[a-zA-Z0-9]{64}$/;
    if (!key) {
      setApiKeyError('API key is required');
      return false;
    }
    if (!apiKeyRegex.test(key)) {
      setApiKeyError('Invalid API key format');
      return false;
    }
    setApiKeyError('');
    return true;
  };

  const handleSubmit = () => {
    if (validateAPIKey(userAPIKey())) {
      props.onSubmit(userAPIKey());
      props.onClose();
    }
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DialogContent class="bg-gray-900 border border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle class="text-blue-300">Enter API Key</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          <input
            type="password"
            placeholder="Enter your API key"
            value={userAPIKey()}
            onInput={(e) => setUserAPIKey(e.currentTarget.value)}
            class="w-full p-2 mb-4 bg-gray-800 text-white rounded border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
          />
          <Show when={apiKeyError()}>
            <p class="text-red-400 mb-4">{apiKeyError()}</p>
          </Show>
        </div>
        <div class="flex justify-end space-x-2">
          <Button onClick={props.onClose} variant="secondary" class="bg-gray-700 text-gray-200 hover:bg-gray-600">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="default" class="bg-blue-600 text-white hover:bg-blue-700">
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
