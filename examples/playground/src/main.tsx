import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// The stylesheet is opt-in. Remove this line to see the bare, unstyled input.
import 'react-financial-input/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
