import { Alert, Button, Drawer, Select, Space } from 'antd';
import { useRef, useState } from 'react';
import { errorMessage } from '../ChargeCatalog/feedback';
import { type Detail, sync, type WriterSession } from './service';

type EmbeddedEditor = HTMLElement & {
  editor?: {
    getHTML(): string;
    commands: {
      focus(): boolean;
      insertContent(value: string): boolean;
    };
  };
};

export default function WriterEditor({
  name,
  session,
  fields,
  onClose,
  onSave,
}: {
  name: string;
  session: WriterSession;
  fields: Record<string, string>;
  onClose: () => void;
  onSave: (detail: Detail) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [variable, setVariable] = useState<string>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function editor() {
    const doc = frame.current?.contentDocument;
    const path = doc?.location?.pathname;
    if (path !== session.url && !path?.startsWith(`${session.url}/`)) {
      throw new Error('当前 Writer 页面不对应此模板草稿。请重新打开正文编辑。');
    }
    const active = doc?.querySelector<EmbeddedEditor>(
      '.tiptap.ProseMirror[contenteditable="true"]',
    );
    if (!active?.editor) {
      throw new Error(
        'Writer 编辑区尚未就绪。请等待加载，并核对当前文档的编辑权限。',
      );
    }
    return active.editor;
  }

  function insert() {
    if (!variable || !Object.hasOwn(fields, variable)) return;
    setError('');
    try {
      const active = editor();
      active.commands.focus();
      if (!active.commands.insertContent(`{{${variable}}}`)) {
        throw new Error('字段未插入，请在正文内选择插入位置后重试。');
      }
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      const updated = await sync(name, session.modified, editor().getHTML());
      onSave(updated);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open
      title="Writer 模板正文"
      size="min(100vw, 1320px)"
      onClose={onClose}
      closable={!busy}
      mask={{ closable: false }}
      extra={
        <Button type="primary" loading={busy} onClick={save}>
          保存模板正文
        </Button>
      }
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        {error && <Alert showIcon type="error" title={error} />}
        <Space wrap>
          <Select
            aria-label="模板字段"
            placeholder="选择模板字段"
            value={variable}
            onChange={setVariable}
            options={Object.entries(fields).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Button onClick={insert} disabled={!variable || busy}>
            插入字段
          </Button>
        </Space>
        <iframe
          ref={frame}
          title="Frappe Writer"
          src={session.url}
          style={{ width: '100%', height: 'calc(100vh - 150px)', border: 0 }}
        />
      </Space>
    </Drawer>
  );
}
