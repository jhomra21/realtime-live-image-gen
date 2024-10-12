import { createQuery } from '@tanstack/solid-query';
import { z } from 'zod';

const ImageSchema = z.object({
  id: z.string(),
  data: z.string(),
  timestamp: z.number()
});

const ImagesSchema = z.array(z.union([ImageSchema, z.string()]));

export const usePreviousImages = () => {
  return createQuery(() => ({
    queryKey: ['previousImages'],
    queryFn: () => {
      const storedImages = localStorage.getItem('previousImages');
      if (storedImages) {
        try {
          const parsedImages = ImagesSchema.parse(JSON.parse(storedImages));
          const formattedImages = parsedImages.map(image => {
            if (typeof image === 'string') {
              return {
                id: Date.now().toString(),
                data: image,
                timestamp: Date.now()
              };
            }
            return image;
          });
          console.log('Retrieved images:', formattedImages);
          return formattedImages;
        } catch (error) {
          console.error('Error parsing stored images:', error);
          return [];
        }
      }
      return [];
    },
  }));
};

export const saveImage = (imageData: string) => {
  const storedImages = localStorage.getItem('previousImages');
  let currentImages: (string | { id: string; data: string; timestamp: number; })[] = [];
  
  if (storedImages) {
    try {
      currentImages = ImagesSchema.parse(JSON.parse(storedImages));
    } catch (error) {
      console.error('Error parsing stored images:', error);
    }
  }

  // Create a new image object with a unique ID
  const newImage = {
    id: Date.now().toString(),
    data: imageData,
    timestamp: Date.now()
  };
  
  // Add the new image to the beginning of the array and remove duplicates
  const updatedImages = [newImage, ...currentImages]
    .map(image => typeof image === 'string' ? { id: Date.now().toString(), data: image, timestamp: Date.now() } : image)
    .filter((image, index, self) => 
      index === self.findIndex((t) => t.data === image.data)
    )
    .slice(0, 12);
  
  console.log('Saving images:', updatedImages);
  localStorage.setItem('previousImages', JSON.stringify(updatedImages));
};
