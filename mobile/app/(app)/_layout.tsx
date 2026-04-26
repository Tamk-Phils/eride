import { Stack, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useEffect } from 'react';

export default function AppLayout() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Protect the route
  if (!user) {
    return null; // Will redirect in root layout
  }

  // Redirect based on role is now handled in login/register to avoid race conditions

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="driver/index" />
      <Stack.Screen name="ride/[id]" />
    </Stack>
  );
}
