import { createQuery } from '@tanstack/solid-query';
import { z } from 'zod';

const ImageSchema = z.string();
const ImagesSchema = z.array(ImageSchema);

export const usePreviousImages = () => {
  return createQuery(() => ({
    queryKey: ['previousImages'],
    queryFn: () => {
      const storedImages = localStorage.getItem('previousImages');
      if (storedImages) {
        return ImagesSchema.parse(JSON.parse(storedImages));
      }
      return [];
    },
  }));
};

export const saveImage = (imageData: string) => {
  const storedImages = localStorage.getItem('previousImages');
  const currentImages = storedImages ? ImagesSchema.parse(JSON.parse(storedImages)) : [];
  const updatedImages = [imageData, ...currentImages].slice(0, 12);
  localStorage.setItem('previousImages', JSON.stringify(updatedImages));
};
