import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { type ProColumns, ProTable } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Modal,
  Result,
  Row,
  Space,
  Spin,
  Tag,
  Tree,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { statusOf } from '@/services/rehab/auth';
import { creationError } from '../UserList/creationErrors';
import RuleEditor from './RuleEditor';
import {
  equalRules,
  getPermissionCatalog,
  getPermissionContext,
  type PermissionCatalog,
  type PermissionChange,
  type PermissionContext,
  type PermissionObject,
  type PermissionPreview,
  type PermissionRule,
  permissionDelta,
  permissionLabels,
  previewPermissions,
  savePermissions,
} from './service';

type Draft = { context: PermissionContext; rules: PermissionRule[] };

export default function RolePermissions({
  role,
  onClose,
}: {
  role: string;
  onClose: () => void;
}) {
  const { message, modal } = App.useApp();
  const [catalog, setCatalog] = useState<PermissionCatalog>();
  const [failure, setFailure] = useState<string>();
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState('all');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editor, setEditor] = useState<Draft>();
  const [opening, setOpening] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    result: PermissionPreview;
    changes: PermissionChange[];
  }>();
  const contexts = useRef(new Map<string, Promise<PermissionContext>>());
  const alive = useRef(true);
  const working = useRef(false);
  const changed = Object.keys(drafts).length;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailure(undefined);
    setDenied(false);
    contexts.current.clear();
    getPermissionCatalog(role)
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((error) => {
        if (!active) return;
        setFailure(creationError(error, '暂时无法加载业务权限。').message);
        setDenied(statusOf(error) === 403);
        if (statusOf(error) === 401)
          window.dispatchEvent(new Event('rehab:session-expired'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role, attempt]);
  useEffect(() => {
    if (!changed) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [changed]);

  useEffect(() => {
    if (!changed) return;
    const unblock = history.block((transition) => {
      modal.confirm({
        title: `放弃 ${changed} 个业务对象的待保存变更？`,
        okText: '放弃并离开',
        cancelText: '继续配置',
        onOk: () => {
          unblock();
          transition.retry();
        },
      });
    });
    return unblock;
  }, [changed, modal]);

  const treeData = useMemo(() => {
    const apps = new Map<string, Map<string, string>>();
    for (const row of catalog?.objects || []) {
      if (!apps.has(row.app)) apps.set(row.app, new Map());
      apps.get(row.app)?.set(row.module, row.module_label);
    }
    return [
      { key: 'all', title: '全部可管理业务对象' },
      ...[...apps].map(([app, modules]) => ({
        key: `app:${app}`,
        title: app,
        children: [...modules].map(([module, label]) => ({
          key: `module:${module}`,
          title: label,
        })),
      })),
    ];
  }, [catalog]);

  function report(error: unknown) {
    if (!alive.current) return;
    setFailure(creationError(error, '操作未完成，请稍后重试。').message);
    if (statusOf(error) === 401)
      window.dispatchEvent(new Event('rehab:session-expired'));
  }
  function confirmDiscard(action: () => void) {
    if (!changed) action();
    else
      modal.confirm({
        title: `放弃 ${changed} 个业务对象的待保存变更？`,
        okText: '放弃变更',
        cancelText: '继续配置',
        onOk: action,
      });
  }
  function reload() {
    setDrafts({});
    setEditor(undefined);
    setPreview(undefined);
    setAttempt((value) => value + 1);
  }
  async function loadContext(doctype: string) {
    if (!contexts.current.has(doctype)) {
      const pending = getPermissionContext(role, doctype).catch((error) => {
        contexts.current.delete(doctype);
        throw error;
      });
      contexts.current.set(doctype, pending);
    }
    return contexts.current.get(doctype) as Promise<PermissionContext>;
  }
  function stage(context: PermissionContext, rules: PermissionRule[]) {
    setDrafts((previous) => {
      const next = { ...previous };
      if (equalRules(context.rules, rules)) delete next[context.doctype];
      else next[context.doctype] = { context, rules: structuredClone(rules) };
      return next;
    });
    setFailure(undefined);
  }
  async function toggle(
    row: PermissionObject,
    right: string,
    checked: boolean,
  ) {
    if (working.current) return;
    working.current = true;
    setOpening(row.doctype);
    try {
      const context =
        drafts[row.doctype]?.context || (await loadContext(row.doctype));
      if (!alive.current) return;
      if (!context.can_edit) throw new Error('Permission changed');
      const rules = structuredClone(
        drafts[row.doctype]?.rules || context.rules,
      );
      let base = rules.find((rule) => rule.permlevel === 0 && !rule.if_owner);
      if (!base) {
        base = {
          permlevel: 0,
          if_owner: 0,
          rights: Object.fromEntries(context.rights.map((name) => [name, 0])),
        };
        rules.push(base);
      }
      base.rights[right] = checked ? 1 : 0;
      stage(
        context,
        rules.filter((rule) => Object.values(rule.rights).some(Boolean)),
      );
    } catch (error) {
      report(error);
    } finally {
      working.current = false;
      if (alive.current) setOpening(undefined);
    }
  }
  async function openEditor(row: PermissionObject) {
    if (working.current) return;
    working.current = true;
    setOpening(row.doctype);
    try {
      const context =
        drafts[row.doctype]?.context || (await loadContext(row.doctype));
      if (alive.current)
        setEditor({
          context,
          rules: drafts[row.doctype]?.rules || context.rules,
        });
    } catch (error) {
      report(error);
    } finally {
      working.current = false;
      if (alive.current) setOpening(undefined);
    }
  }
  async function review() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setFailure(undefined);
    const changes = Object.entries(drafts).map(([doctype, draft]) => ({
      doctype,
      version: draft.context.version,
      rules: draft.rules,
    }));
    try {
      const result = await previewPermissions(role, changes);
      if (alive.current) setPreview({ result, changes });
    } catch (error) {
      report(error);
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function save() {
    if (!preview || working.current) return;
    working.current = true;
    setBusy(true);
    try {
      const result = await savePermissions(
        role,
        preview.changes,
        preview.result.token,
      );
      if (!alive.current) return;
      void message.success(`已保存 ${result.saved} 个业务对象的角色权限`);
      window.dispatchEvent(new Event('rehab:permissions-updated'));
      reload();
    } catch (error) {
      setPreview(undefined);
      report(error);
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const columns: ProColumns<PermissionObject>[] = [
    {
      title: '搜索业务对象',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '中文名称或 DocType 标识', maxLength: 120 },
    },
    {
      title: '业务对象',
      dataIndex: 'doctype',
      search: false,
      width: 230,
      render: (_, row) => (
        <div>
          <div>
            {row.label}{' '}
            {drafts[row.doctype] && <Tag color="processing">待保存</Tag>}
          </div>
          <Typography.Text type="secondary">{row.doctype}</Typography.Text>
        </div>
      ),
    },
    ...['read', 'create', 'write', 'delete', 'export'].map(
      (right): ProColumns<PermissionObject> => ({
        title: permissionLabels[right],
        key: right,
        search: false,
        width: 70,
        render: (_, row) => (
          <Checkbox
            aria-label={`${row.doctype} ${permissionLabels[right]}`}
            checked={Boolean(
              (drafts[row.doctype]?.rules || row.rules).find(
                (rule) => rule.permlevel === 0 && !rule.if_owner,
              )?.rights[right],
            )}
            disabled={
              !row.can_edit ||
              !row.basic_rights.includes(right) ||
              busy ||
              Boolean(opening)
            }
            onChange={(event) => {
              void toggle(row, right, event.target.checked);
            }}
          />
        ),
      }),
    ),
    {
      title: '权限来源',
      dataIndex: 'source',
      search: false,
      width: 110,
      render: (_, row) => (row.source === 'custom' ? '自定义规则' : '默认规则'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, row) => [
        <Button
          key="rules"
          type="link"
          loading={opening === row.doctype}
          disabled={busy || Boolean(opening)}
          onClick={() => {
            void openEditor(row);
          }}
        >
          {row.can_edit ? '高级设置' : '查看规则'}
        </Button>,
      ],
    },
  ];

  if (loading && !catalog)
    return (
      <Spin description="正在读取业务权限">
        <Card style={{ minHeight: 180 }} />
      </Spin>
    );
  if (!catalog)
    return (
      <Result
        status={denied ? '403' : '500'}
        title={failure || '无法加载业务权限'}
        extra={
          <Space>
            <Button onClick={onClose}>返回角色列表</Button>
            <Button onClick={reload}>重新加载</Button>
          </Space>
        }
      />
    );

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Button icon={<ArrowLeftOutlined />} disabled={busy} onClick={onClose}>
          返回角色列表
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {catalog.label} · 业务权限
        </Typography.Title>
        <Button
          icon={<ReloadOutlined />}
          disabled={busy || Boolean(opening)}
          onClick={() => confirmDiscard(reload)}
        >
          重新加载
        </Button>
        <Button
          type="primary"
          disabled={!changed || Boolean(opening) || changed > 100}
          loading={busy}
          onClick={() => {
            void review();
          }}
        >
          预览并保存{changed ? `（${changed}）` : ''}
        </Button>
      </Space>
      <Alert
        type="info"
        showIcon
        title="配置的是当前角色的授权，用户实际权限还会合并其全部角色，并受用户权限和业务规则限制。"
        description="表格勾选项对应级别 0 且不按创建者限制的规则。其他字段级别、仅本人创建和高级操作在高级设置中配置；菜单按实际可读权限显示。"
      />
      {!catalog.editable_role && (
        <Alert
          type="warning"
          showIcon
          title="系统保留角色和已停用角色在此只读。"
        />
      )}
      {changed > 100 && (
        <Alert
          type="warning"
          title="一次最多保存 100 个业务对象，请减少本次变更。"
        />
      )}
      {failure && (
        <Alert
          type="error"
          showIcon
          title={failure}
          description="待保存内容已保留。若提示权限已变化，请重新加载后配置。"
        />
      )}
      <Row gutter={[16, 16]} style={{ width: '100%', marginInline: 0 }}>
        <Col xs={24} lg={6} style={{ paddingInlineStart: 0 }}>
          <Card title="应用与模块" size="small">
            <Tree
              blockNode
              defaultExpandAll
              treeData={treeData}
              selectedKeys={[selection]}
              onSelect={(keys) => setSelection(String(keys[0] || 'all'))}
            />
          </Card>
        </Col>
        <Col xs={24} lg={18} style={{ paddingInlineEnd: 0 }}>
          <ProTable<
            PermissionObject,
            { keyword?: string; selection?: string; attempt?: number }
          >
            rowKey="doctype"
            columns={columns}
            loading={loading}
            headerTitle={`业务权限 · 已修改 ${changed} 项`}
            options={{ reload: false, density: true, setting: true }}
            toolBarRender={false}
            params={{ selection, attempt }}
            search={{ labelWidth: 'auto', defaultCollapsed: false }}
            form={{ name: 'role-business-permissions-search' }}
            scroll={{ x: 900 }}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            request={async (params) => {
              const keyword = params.keyword?.trim().toLocaleLowerCase() || '';
              const rows = catalog.objects.filter(
                (row) =>
                  (selection === 'all' ||
                    selection === `app:${row.app}` ||
                    selection === `module:${row.module}`) &&
                  (!keyword ||
                    `${row.label} ${row.doctype}`
                      .toLocaleLowerCase()
                      .includes(keyword)),
              );
              const start =
                ((params.current || 1) - 1) * (params.pageSize || 20);
              return {
                data: rows.slice(start, start + (params.pageSize || 20)),
                total: rows.length,
                success: true,
              };
            }}
          />
        </Col>
      </Row>
      {editor && (
        <RuleEditor
          key={editor.context.doctype}
          context={editor.context}
          initialRules={editor.rules}
          onClose={() => setEditor(undefined)}
          onApply={(rules) => {
            stage(editor.context, rules);
            setEditor(undefined);
          }}
        />
      )}
      <Modal
        open={Boolean(preview)}
        title="确认角色业务权限变更"
        width={{ xs: '95%', md: 760 }}
        okText="确认保存"
        cancelText="继续配置"
        confirmLoading={busy}
        mask={{ closable: false }}
        keyboard={!busy}
        cancelButtonProps={{ disabled: busy }}
        onCancel={() => setPreview(undefined)}
        onOk={() => {
          void save();
        }}
      >
        {preview && (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Typography.Paragraph>
              本次修改角色“{catalog.label}”的 {preview.result.changes.length}{' '}
              个业务对象。可见关联：{preview.result.visible_users} 个用户、
              {preview.result.visible_profiles} 个角色配置。
              {preview.result.restricted
                ? '另有当前账号不可见的关联记录。'
                : ''}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              仅修改本角色的规则，其他角色的授权保留。确认有效期为 5 分钟。
            </Typography.Text>
            {preview.result.changes.map((change) => (
              <Card
                key={change.doctype}
                size="small"
                title={
                  catalog.objects.find((row) => row.doctype === change.doctype)
                    ?.label || change.doctype
                }
              >
                {permissionDelta(change.before, change.after).map((line) => (
                  <Typography.Paragraph key={line}>{line}</Typography.Paragraph>
                ))}
              </Card>
            ))}
          </Space>
        )}
      </Modal>
    </Space>
  );
}
