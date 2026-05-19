import { configureStore } from '@reduxjs/toolkit';

import { rootReducer, type RootState } from '@/store/rootReducer';

export type { RootState };

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type AppDispatch = typeof store.dispatch;
