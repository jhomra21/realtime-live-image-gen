import { Component } from 'solid-js';
import { useUserCoins } from '@/hooks/useUserCoins';
import { Button } from '@/components/ui/button';
import { UserCoins } from '@/components/UserCoins';
import { toast } from '@/components/ui/toast';
import { A } from '@solidjs/router';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

const CoinsPage: Component = () => {
  const { coins, addCoins } = useUserCoins();

  const handleAddCoins = (amount: number) => {
    addCoins(amount);
    
  };

  return (
    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-5xl">
      <Card class="bg-gray-800/50 backdrop-blur-sm border-gray-700">
        <CardHeader>
          <h1 class="text-2xl font-bold text-center text-white my-4">Coin Management</h1>
          <div class="flex mt-4 justify-center">
            <UserCoins coins={coins()} />
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[10, 25, 50, 100].map((amount) => (
              <Button 
                onClick={() => handleAddCoins(amount)}
                class="w-full h-16 text-lg transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
                variant="outline"
              >
                Add {amount} Coins
              </Button>
            ))}
          </div>
          
          <div class="mt-8 flex justify-center">
            <A href="/generate">
              <Button 
                variant="default" 
                class="px-6 bg-blue-600 text-white hover:bg-blue-700"
              >
                Back to Generate
              </Button>
            </A>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoinsPage;
