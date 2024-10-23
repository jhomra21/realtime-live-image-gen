import { Component, createEffect } from 'solid-js';
import { useUserCoins } from '@/hooks/useUserCoins';
import { Button } from '@/components/ui/button';
import { UserCoins } from '@/components/UserCoins';
import { useNavigate } from '@solidjs/router';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useSearchParams } from '@solidjs/router';
import { useQueryClient } from '@tanstack/solid-query';
import { toast } from '@/components/ui/toast';

const CoinsPageContent: Component = () => {
  const { coins, addCoins } = useUserCoins();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Add debugging effect
  createEffect(() => {
    console.log('Current user:', user());
    console.log('Current coins:', coins());
  });

  const handleAddCoins = (amount: number) => {
    addCoins(amount);
  };

  const handleStripeCheckout = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8787'}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: (user() as any)?.id,
          productId: import.meta.env.VITE_STRIPE_TEST_PRODUCT_ID,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Stripe checkout error:', error);
    }
  };

  createEffect(() => {
    const sessionId = searchParams.session_id;
    if (sessionId) {
      toast({
        title: "Payment Successful",
        description: "Your coins have been added to your account!",
        variant: "default"
      });
      // Invalidate coins query to refresh the balance
      queryClient.invalidateQueries({ queryKey: ['account'] });
    }
  });

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
          
          {/* Add Stripe Checkout Button */}
          <div class="mt-8 flex justify-center">
            <Button
              onClick={handleStripeCheckout}
              class="w-full max-w-md h-16 text-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all duration-200 ease-in-out transform hover:scale-[1.02]"
            >
              Purchase Premium Coins Package
            </Button>
          </div>

          <div class="mt-8 flex justify-center">
            <Button 
              variant="default" 
              class="px-6 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => navigate('/generate')}
            >
              Back to Generate
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const CoinsPage: Component = () => {
  return (
    <ProtectedRoute>
      <CoinsPageContent />
    </ProtectedRoute>
  );
};

export default CoinsPage;
