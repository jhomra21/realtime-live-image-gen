import { createQuery, useQueryClient } from '@tanstack/solid-query';
import { z } from 'zod';

const ImageSchema = z.object({
  id: z.string(),
  data: z.string(),
  timestamp: z.number()
});

const ImagesSchema = z.array(ImageSchema);

export const usePreviousImages = () => {
  return createQuery(() => ({
    queryKey: ['previousImages'],
    queryFn: () => {
      const storedImages = localStorage.getItem('previousImages');
      if (storedImages) {
        try {
          const parsedImages = JSON.parse(storedImages);
          
          // Ensure all image data is stored as strings
          const fixedImages = parsedImages.map((img: any) => ({
            ...img,
            data: typeof img.data === 'object' ? img.data.b64_json : img.data
          }));
          
          const validatedImages = ImagesSchema.parse(fixedImages);
          
          console.log('Retrieved images:', validatedImages);
          
          // Save the fixed images back to localStorage
          localStorage.setItem('previousImages', JSON.stringify(validatedImages));
          
          return validatedImages;
        } catch (error) {
          console.error('Error parsing stored images:', error);
          return [];
        }
      }
      return [];
    },
  }));
};

export const saveImage = (imageData: { id: string, data: string, timestamp: number }) => {
  const storedImages = localStorage.getItem('previousImages');
  let currentImages: z.infer<typeof ImageSchema>[] = [];
  
  if (storedImages) {
    try {
      currentImages = JSON.parse(storedImages);
    } catch (error) {
      console.error('Error parsing stored images:', error);
    }
  }

  // Add the new image to the beginning of the array and remove duplicates
  const updatedImages = [imageData, ...currentImages]
    .filter((image, index, self) => 
      index === self.findIndex((t) => t.data === image.data)
    )
    .slice(0, 12);
  
  console.log('Saving images:', updatedImages);
  localStorage.setItem('previousImages', JSON.stringify(updatedImages));
};

export const removeImage = (id: string) => {
  const storedImages = localStorage.getItem('previousImages');
  if (storedImages) {
    try {
      const currentImages = JSON.parse(storedImages);
      const updatedImages = currentImages.filter((img: any) => img.id !== id);
      localStorage.setItem('previousImages', JSON.stringify(updatedImages));
    } catch (error) {
      console.error('Error removing image:', error);
    }
  }
  // If the image is not in local storage (e.g., newly generated), we don't need to do anything
};
