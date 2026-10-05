'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ResourceState<T> {
  key: string;
  data?: T;
  error?: unknown;
}

/**
 * Load async data whenever `deps` change. `loading` is true until the response for the
 * current deps arrives, while the previous data stays visible to avoid layout jumps.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[], onError?: (error: unknown) => void) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ key: '' });
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(onError);
  const key = `${JSON.stringify(deps)}#${nonce}`;

  useEffect(() => {
    fetcherRef.current = fetcher;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let active = true;
    fetcherRef.current().then(
      (data) => { if (active) setState({ key, data }); },
      (error) => {
        if (!active) return;
        setState((prev) => ({ key, data: prev.data, error }));
        onErrorRef.current?.(error);
      },
    );
    return () => { active = false; };
  }, [key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data: state.data, error: state.error, loading: state.key !== key, reload };
}
