import { Component, createSignal, For, Show } from 'solid-js';
import { Button } from '@/components/ui/button';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useNavigate } from '@solidjs/router';
import { toast } from '@/components/ui/toast';
import JSZip from 'jszip';
import { useAuth } from '@/hooks/useAuth';
import { useTrainingHistory } from '@/hooks/useTrainingHistory';
import { format } from 'date-fns';

const API_BASE_URL = import.meta.env.PROD ? 'https://realtime-image-gen-api.jhonra121.workers.dev' : 'http://127.0.0.1:8787';


interface SelectedImage {
  id: string;
  url: string;
  file: File;
}

const TrainingPageContent: Component = () => {
  const [selectedImages, setSelectedImages] = createSignal<SelectedImage[]>([]);
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trainingHistory, saveTrainingUpload, removeTrainingUpload } = useTrainingHistory();

  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const newImages = Array.from(input.files).map(file => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      file: file
    }));

    setSelectedImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setSelectedImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // Cleanup object URLs to prevent memory leaks
      const removedImage = prev.find(img => img.id === id);
      if (removedImage) {
        URL.revokeObjectURL(removedImage.url);
      }
      return filtered;
    });
  };

  const handleUpload = async () => {
    if (selectedImages().length === 0) {
      setUploadError('Please select at least one image');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Create a new zip file
      const zip = new JSZip();
      
      // Add each image to the zip
      selectedImages().forEach(img => {
        zip.file(img.file.name, img.file);
      });

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Get user email and sanitize it for filename
      const userEmail = (user() as any)?.email || 'anonymous';
      const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
      
      // Create form data with the zip file including user email
      const formData = new FormData();
      formData.append('zipFile', zipBlob, `training_${sanitizedEmail}_${Date.now()}.zip`);

      const response = await fetch(`${API_BASE_URL}/api/uploadTrainingZip`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // Clean up object URLs
        selectedImages().forEach(img => URL.revokeObjectURL(img.url));
        setSelectedImages([]);
        
        // Save the upload URL to history
        const zipFile = formData.get('zipFile') as File | null;
        if (!zipFile) {
          throw new Error('Zip file not found in form data');
        }
        saveTrainingUpload(result.url, (zipFile as File)?.name || 'training.zip');
        
        toast({
          title: "Upload Successful",
          description: `Successfully uploaded zip file containing ${selectedImages().length} images.`,
          variant: "success",
        });
      }
    } catch (error) {
      setUploadError('Failed to upload images. Please try again.');
      console.error('Upload error:', error);
      
      toast({
        title: "Upload Failed",
        description: "Failed to upload training images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div class="flex-grow flex flex-col items-center justify-start p-4 sm:p-6">
      <div class="w-full max-w-4xl">
        {/* Title section with glowing effect */}
        <div class="relative overflow-hidden rounded-lg mb-6">
          <div class="absolute inset-0 bg-blue-600 opacity-75 blur-xl"></div>
          <div class="relative bg-gray-900 bg-opacity-80 backdrop-blur-md p-6 shadow-lg">
            <div class="absolute rounded-tl-lg top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
            <div class="absolute rounded-tr-lg top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
            <div class="absolute rounded-bl-lg bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
            <div class="absolute rounded-br-lg bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>
            
            <h1 class="text-3xl sm:text-4xl font-bold text-white text-center">Training Images</h1>
          </div>
        </div>

        {/* File input section */}
        <div class="mb-8 flex gap-4">
          <Button
            as="label"
            for="file-upload"
            class="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            disabled={isUploading()}
          >
            Select Images
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              onChange={handleFileSelect}
              disabled={isUploading()}
            />
          </Button>

          <Button
            onClick={handleUpload}
            class="px-6 py-3 bg-green-600 text-white hover:bg-green-700"
            disabled={isUploading() || selectedImages().length === 0}
          >
            {isUploading() ? 'Uploading...' : 'Upload Selected Images'}
          </Button>
        </div>

        {/* Error message */}
        <Show when={uploadError()}>
          <div class="mb-4 text-red-500 text-center">
            {uploadError()}
          </div>
        </Show>

        {/* Selected images grid */}
        <Show when={selectedImages().length > 0}>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <For each={selectedImages()}>
              {(image) => (
                <div class="aspect-square bg-gray-800 rounded-lg overflow-hidden relative group">
                  <img
                    src={image.url}
                    alt="Selected image"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button
                      onClick={() => removeImage(image.id)}
                      class="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={selectedImages().length === 0}>
          <div class="text-center text-gray-400 mt-8">
            No images selected. Click "Select Images" to begin.
          </div>
        </Show>

        {/* Training History Section */}
        <div class="mt-12">
          <h2 class="text-2xl font-bold text-white mb-4">Upload History</h2>
          <div class="bg-gray-900 rounded-lg p-4">
            <Show when={trainingHistory().length > 0} fallback={
              <p class="text-gray-400 text-center">No training uploads yet.</p>
            }>
              <div class="space-y-4">
                <For each={trainingHistory()}>
                  {(upload) => (
                    <div class="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
                      <div class="flex-grow">
                        <p class="text-white font-medium truncate">{upload.filename}</p>
                        <p class="text-sm text-gray-400">
                          {format(upload.timestamp, 'PPpp')}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <Button
                          as="a"
                          href={upload.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          class="bg-blue-600 hover:bg-blue-700"
                        >
                          Download
                        </Button>
                        <Button
                          onClick={() => removeTrainingUpload(upload.id)}
                          class="bg-red-600 hover:bg-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

const TrainingPage: Component = () => {
  return (
    <ProtectedRoute>
      <TrainingPageContent />
    </ProtectedRoute>
  );
}

export default TrainingPage;
