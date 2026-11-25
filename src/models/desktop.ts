import { useState } from 'react';

export default function useDesktopSearch() {
  const [query, setQuery] = useState('');
  return { query, setQuery };
}
