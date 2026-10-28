import { useWindowDimensions } from 'react-native';

import { breakpointFor, type Breakpoint } from './breakpoints';

/** The screen class of the current window; re-renders when the window crosses a breakpoint. */
export function useBreakpoint(): Breakpoint {
  return breakpointFor(useWindowDimensions().width);
}
