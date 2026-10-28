import { useRouter } from 'expo-router';

import { blurActiveElement } from './blurActiveElement';

/**
 * Where the caller sits: a tab screen (switch to the Inicio tab) or a screen pushed on the root
 * stack (pop down to the tabs and select Inicio; a screen opened directly from a link is replaced,
 * so no duplicate is stacked).
 */
export type HomeOrigin = 'tab' | 'stack';

/** Returns to Inicio from any screen. */
export function useGoHome(origin: HomeOrigin): () => void {
  const router = useRouter();
  return () => {
    blurActiveElement();
    if (origin === 'tab') router.navigate('/');
    else router.dismissTo('/');
  };
}
