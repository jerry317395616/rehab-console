import {
  App,
  Button,
  Card,
  Checkbox,
  Drawer,
  Grid,
  Select,
  Space,
  Typography,
} from 'antd';
import React, { useState } from 'react';
import {
  equalRules,
  type PermissionContext,
  type PermissionRule,
  permissionLabels,
  ruleKey,
} from './service';

export default function RuleEditor({
  context,
  initialRules,
  onApply,
  onClose,
}: {
  context: PermissionContext;
  initialRules: PermissionRule[];
  onApply: (rules: PermissionRule[]) => void;
  onClose: () => void;
}) {
  const [rules, setRules] = useState(() => structuredClone(initialRules));
  const { modal } = App.useApp();
  const screens = Grid.useBreakpoint();
  const used = new Set(rules.map(ruleKey));
  const options = context.levels
    .flatMap(({ level }) =>
      (level ? [0] : [0, 1]).map((owner) => ({
        value: `${level}:${owner}`,
        label: `级别 ${level} · ${owner ? '仅本人创建' : '不按创建者限制'}`,
      })),
    )
    .filter((option) => !used.has(option.value));
  function close() {
    if (equalRules(rules, initialRules)) onClose();
    else
      modal.confirm({
        title: '放弃本次规则编辑？',
        content: '尚未应用到权限配置页的编辑将被丢弃。',
        okText: '放弃',
        cancelText: '继续编辑',
        onOk: onClose,
      });
  }
  return (
    <Drawer
      open
      title={`${context.label} · 权限规则`}
      size={screens.md ? 760 : '100%'}
      onClose={close}
      extra={
        context.can_edit ? (
          <Button type="primary" onClick={() => onApply(rules)}>
            应用到待保存变更
          </Button>
        ) : undefined
      }
    >
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary">
          级别 0
          控制业务对象操作，其他级别控制对应字段。仅本人创建指记录创建者，不代表负责医生或治疗师。这里的编辑需要返回页面预览并保存后才会生效。
        </Typography.Paragraph>
        {rules.length === 0 && (
          <Typography.Text type="secondary">
            此角色尚无该业务对象的权限规则。
          </Typography.Text>
        )}
        {rules.map((rule) => {
          const level = context.levels.find(
            (item) => item.level === rule.permlevel,
          );
          const supported = rule.if_owner ? level?.owner_rights : level?.rights;
          return (
            <Card
              key={ruleKey(rule)}
              size="small"
              title={`级别 ${rule.permlevel} · ${rule.if_owner ? '仅本人创建' : '不按创建者限制'}`}
              extra={
                context.can_edit ? (
                  <Button
                    type="link"
                    danger
                    onClick={() =>
                      setRules((items) =>
                        items.filter((item) => ruleKey(item) !== ruleKey(rule)),
                      )
                    }
                  >
                    移除规则
                  </Button>
                ) : undefined
              }
            >
              <Space wrap>
                {context.rights
                  .filter(
                    (right) => supported?.includes(right) || rule.rights[right],
                  )
                  .map((right) => (
                    <Checkbox
                      key={right}
                      checked={Boolean(rule.rights[right])}
                      disabled={
                        !context.can_edit ||
                        (!supported?.includes(right) && !rule.rights[right])
                      }
                      onChange={(event) =>
                        setRules((items) =>
                          items.map((item) =>
                            ruleKey(item) === ruleKey(rule)
                              ? {
                                  ...item,
                                  rights: {
                                    ...item.rights,
                                    [right]: event.target.checked ? 1 : 0,
                                  },
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      {permissionLabels[right] || right}
                    </Checkbox>
                  ))}
              </Space>
              {rule.permlevel > 0 && (
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginTop: 16, marginBottom: 0 }}
                >
                  对应字段：
                  {context.fields
                    .filter((field) => field.permlevel === rule.permlevel)
                    .map(
                      (field) =>
                        `${field.label}（${field.name}${field.read_only ? '，只读' : ''}）`,
                    )
                    .join('、') || '当前没有对应字段'}
                </Typography.Paragraph>
              )}
            </Card>
          );
        })}
        {context.can_edit && options.length > 0 && (
          <Select
            aria-label="新增权限规则"
            placeholder="新增权限级别或创建者范围"
            value={undefined}
            options={options}
            style={{ width: '100%' }}
            onChange={(value: string) => {
              const [permlevel, owner] = value.split(':').map(Number);
              setRules((items) => [
                ...items,
                {
                  permlevel,
                  if_owner: owner as 0 | 1,
                  rights: Object.fromEntries(
                    context.rights.map((right) => [right, 0]),
                  ),
                },
              ]);
            }}
          />
        )}
      </Space>
    </Drawer>
  );
}
