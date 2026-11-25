import { useLocation, useModel } from '@umijs/max';
import { Grid, Input } from 'antd';
import React from 'react';
import { localRoute } from '@/services/rehab/session';

export default function DesktopSearch({
  placement = 'header',
}: {
  placement?: 'header' | 'content';
}) {
  const { query, setQuery } = useModel('desktop');
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const path = localRoute(location.pathname).replace(/\/$/, '');
  if (path !== '/apps') return null;
  if ((placement === 'header') !== Boolean(screens.md)) return null;
  return (
    <Input.Search
      aria-label="搜索可用应用"
      placeholder="搜索可用应用"
      allowClear
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onSearch={setQuery}
      style={{ width: '100%', maxWidth: 400 }}
    />
  );
}
