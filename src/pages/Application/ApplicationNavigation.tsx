import { AppstoreOutlined } from '@ant-design/icons';
import { Link } from '@umijs/max';
import { Menu, type MenuProps } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import {
  type ApplicationModule,
  moduleRoute,
  type NavigationNode,
  navigationRoute,
} from '@/services/rehab/apps';
import {
  canCollapse,
  defaultSections,
  moduleNavigation,
  selectedEntry,
} from './navigation';

type Props = {
  modules: ApplicationModule[];
  appName: string;
  userId: string;
  moduleName?: string;
  itemId?: string;
  nodeKey?: string | null;
  collapsed: boolean;
  onNavigate: () => void;
};

function NativeIcon({
  name,
  className,
}: {
  name: string | null;
  className?: string;
}) {
  if (name && /\p{Extended_Pictographic}/u.test(name))
    return (
      <span aria-hidden="true" className={className}>
        {name}
      </span>
    );
  const aliases: Record<string, string> = {
    home: 'house',
    web: 'globe',
    customization: 'sliders-horizontal',
  };
  const icon =
    name && /^[a-z0-9-]+$/.test(name) ? aliases[name] || name : 'list';
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <use href={`/assets/frappe/icons/lucide/icons.svg#icon-${icon}`} />
    </svg>
  );
}

export default function ApplicationNavigation({
  modules,
  appName,
  userId,
  moduleName,
  itemId,
  nodeKey,
  collapsed,
  onNavigate,
}: Props) {
  const storageKey = `rehab:console:menu:${appName}:${userId}`;
  const [popupKeys, setPopupKeys] = useState<string[]>([]);
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem(storageKey) || 'null',
      );
      if (Array.isArray(saved) && saved.every((key) => typeof key === 'string'))
        return saved;
    } catch {
      /* Browser storage can be unavailable. */
    }
    return defaultSections(modules);
  });
  const selected = selectedEntry(
    modules.find((module) => module.name === moduleName),
    itemId,
    nodeKey,
  );
  const selectedKey = selected?.item.key;
  const ancestorKeys = selected
    ? [
        moduleRoute(appName, moduleName || ''),
        ...selected.parents.filter(canCollapse).map((parent) => parent.key),
      ]
    : [];
  const ancestorSignature = ancestorKeys.join('|');
  useEffect(() => {
    const ancestors = ancestorSignature ? ancestorSignature.split('|') : [];
    setOpenKeys((keys) => [...new Set([...keys, ...ancestors])]);
  }, [ancestorSignature, selectedKey]);

  const items = useMemo<NonNullable<MenuProps['items']>>(
    () =>
      modules.map((module) => {
        const renderNode = (
          node: NavigationNode,
          indentedParent = false,
          depth = 2,
        ): NonNullable<MenuProps['items']>[number][] => {
          if (node.type === 'divider')
            return [{ type: 'divider', key: node.key }];
          if (node.type === 'item')
            return [
              {
                key: node.key,
                style: collapsed
                  ? undefined
                  : { paddingInlineStart: depth * 24 },
                icon: indentedParent ? undefined : (
                  <NativeIcon name={node.icon} />
                ),
                label: (
                  <Link
                    to={navigationRoute(appName, module.name, node)}
                    aria-label={node.title}
                    title={node.title}
                    data-nav-key={node.key}
                    data-item-id={node.id}
                    onClick={onNavigate}
                  >
                    {node.title}
                  </Link>
                ),
              },
            ];
          const children = node.children.flatMap((child) =>
            renderNode(child, node.indent, depth + (node.indent ? 1 : 0)),
          );
          const label = (
            <span
              data-nav-key={node.key}
              data-nav-kind={
                node.indent ? 'indented-section' : 'heading-section'
              }
            >
              {node.title}
            </span>
          );
          if (canCollapse(node))
            return [
              {
                key: node.key,
                label,
                icon: node.indent ? <NativeIcon name={node.icon} /> : undefined,
                children,
              },
            ];
          return [
            { type: 'divider', key: `${node.key}:heading-divider` },
            { type: 'group', key: node.key, label, children },
          ];
        };
        return {
          key: moduleRoute(appName, module.name),
          label: <span data-module-name={module.name}>{module.title}</span>,
          icon: <AppstoreOutlined />,
          children: moduleNavigation(module).flatMap((node) =>
            renderNode(node),
          ),
        };
      }),
    [modules, appName, onNavigate],
  );

  return (
    <Menu
      aria-label="应用模块"
      mode="inline"
      inlineIndent={24}
      inlineCollapsed={collapsed}
      items={items}
      selectedKeys={selectedKey ? [selectedKey] : []}
      openKeys={collapsed ? popupKeys : openKeys}
      onOpenChange={(keys) => {
        if (collapsed) {
          setPopupKeys(keys);
          return;
        }
        setOpenKeys(keys);
        try {
          localStorage.setItem(storageKey, JSON.stringify(keys));
        } catch {
          /* Keep the current interaction usable without storage. */
        }
      }}
    />
  );
}
