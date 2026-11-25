import type {
  ApplicationModule,
  NavigationItem,
  NavigationNode,
  NavigationSection,
} from '@/services/rehab/apps';

export type NavigationEntry = {
  item: NavigationItem;
  parents: NavigationSection[];
};

export function moduleNavigation(module: ApplicationModule): NavigationNode[] {
  return (
    module.navigation ??
    module.items.map((item) => ({
      ...item,
      type: 'item',
      key: item.id,
      icon: null,
    }))
  );
}

export function navigationEntries(
  module: ApplicationModule,
): NavigationEntry[] {
  return moduleNavigation(module).flatMap((node): NavigationEntry[] => {
    if (node.type === 'item') return [{ item: node, parents: [] }];
    if (node.type === 'section')
      return node.children.flatMap((child) =>
        child.type === 'item' ? [{ item: child, parents: [node] }] : [],
      );
    return [];
  });
}

export function selectedEntry(
  module: ApplicationModule | undefined,
  itemId?: string,
  nodeKey?: string | null,
) {
  if (!module || !itemId) return undefined;
  const matches = navigationEntries(module).filter(
    ({ item }) => item.id === itemId,
  );
  return matches.find(({ item }) => item.key === nodeKey) || matches[0];
}

export function canCollapse(section: NavigationSection) {
  return section.collapsible || (section.indent && section.show_arrow);
}

export function defaultSections(modules: ApplicationModule[]) {
  return modules.flatMap((module) =>
    moduleNavigation(module).flatMap((node) =>
      node.type === 'section' && canCollapse(node) && !node.keep_closed
        ? [node.key]
        : [],
    ),
  );
}
