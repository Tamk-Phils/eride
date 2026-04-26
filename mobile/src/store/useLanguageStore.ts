import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

type Language = 'EN' | 'FR';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations = {
  EN: {
    'driver_mode': 'Driver Mode',
    'rider_mode': 'Rider Mode',
    'online': 'Online - Finding Rides',
    'offline': 'Offline',
    'go_online': 'GO ONLINE',
    'go_offline': 'GO OFFLINE',
    'you_are_offline': 'You are offline',
    'go_online_subtitle': 'Go online to start receiving targeted ride requests.',
    'scanning': 'Scanning for nearby riders...',
    'where_to': 'Where to?',
    'finding_driver': 'Finding the closest driver...',
    'driver_arrived': 'Driver Arrived',
    'you_arrived': 'You Arrived',
    'i_have_arrived': 'I Have Arrived',
    'start_ride': 'Start Ride',
    'complete_ride': 'Complete Ride',
    'cancel_ride': 'Cancel Ride',
    'accept_ride': 'Accept Ride',
    'ride_cancelled': 'This ride has been cancelled.',
  },
  FR: {
    'driver_mode': 'Mode Chauffeur',
    'rider_mode': 'Mode Passager',
    'online': 'En ligne - Recherche de courses',
    'offline': 'Hors ligne',
    'go_online': 'PASSER EN LIGNE',
    'go_offline': 'PASSER HORS LIGNE',
    'you_are_offline': 'Vous êtes hors ligne',
    'go_online_subtitle': 'Passez en ligne pour recevoir des demandes ciblées.',
    'scanning': 'Recherche de passagers à proximité...',
    'where_to': 'Où allez-vous ?',
    'finding_driver': 'Recherche du chauffeur le plus proche...',
    'driver_arrived': 'Chauffeur arrivé',
    'you_arrived': 'Vous êtes arrivé',
    'i_have_arrived': 'Je suis arrivé',
    'start_ride': 'Démarrer la course',
    'complete_ride': 'Terminer la course',
    'cancel_ride': 'Annuler la course',
    'accept_ride': 'Accepter',
    'ride_cancelled': 'Cette course a été annulée.',
  }
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'EN',
      setLanguage: (lang) => set({ language: lang }),
      toggleLanguage: () => set((state) => ({ language: state.language === 'EN' ? 'FR' : 'EN' })),
      t: (key: string) => {
        const lang = get().language;
        return (translations[lang] as any)[key] || key;
      }
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
