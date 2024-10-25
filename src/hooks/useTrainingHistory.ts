import { createSignal } from 'solid-js';
import { z } from 'zod';

const TrainingUploadSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  timestamp: z.number(),
  filename: z.string(),
});

export type TrainingUpload = z.infer<typeof TrainingUploadSchema>;

export function useTrainingHistory() {
  const [trainingHistory, setTrainingHistory] = createSignal<TrainingUpload[]>([]);

  // Load history from localStorage on initialization
  const loadHistory = () => {
    const stored = localStorage.getItem('trainingHistory');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const validated = parsed.map((item: unknown) => TrainingUploadSchema.parse(item));
        setTrainingHistory(validated);
      } catch (error) {
        console.error('Error loading training history:', error);
        localStorage.removeItem('trainingHistory');
      }
    }
  };

  // Save a new training upload
  const saveTrainingUpload = (url: string, filename: string) => {
    const newUpload: TrainingUpload = {
      id: crypto.randomUUID(),
      url,
      timestamp: Date.now(),
      filename,
    };

    setTrainingHistory(prev => {
      const updated = [newUpload, ...prev];
      localStorage.setItem('trainingHistory', JSON.stringify(updated));
      return updated;
    });
  };

  // Remove a training upload
  const removeTrainingUpload = (id: string) => {
    setTrainingHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem('trainingHistory', JSON.stringify(updated));
      return updated;
    });
  };

  // Load history on initialization
  loadHistory();

  return {
    trainingHistory,
    saveTrainingUpload,
    removeTrainingUpload,
  };
}
