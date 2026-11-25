import {
  ModalForm,
  ProDescriptions,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Alert, App, Button, Form, Tabs } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import Records from './Records';
import { api, type Context, errorMessage, mutate } from './service';

type AssetContext = {
  asset: Record<string, string>;
  read_fields: string[];
  can_read_repairs: boolean;
  can_read_maintenance: boolean;
};
export default function AssetPanel({
  context,
  onSaved,
}: {
  context: Context;
  onSaved: () => void;
}) {
  const [asset, setAsset] = useState<AssetContext>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const working = useRef(false);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  useEffect(() => {
    let active = true;
    setError(undefined);
    setAsset(undefined);
    if (context.device.asset)
      api<AssetContext>('get_asset', { name: context.device.name })
        .then((value) => {
          if (active) setAsset(value);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        });
    return () => {
      active = false;
    };
  }, [context.device.asset, context.device.name]);
  const labels: Record<string, string> = {
    asset_name: '资产名称',
    company: '资产公司',
    item_code: '资产物料',
    asset_category: '资产类别',
    location: '资产位置',
    custodian: '保管员工',
    department: '资产部门',
    status: '资产状态',
    available_for_use_date: '可用日期',
    disposal_date: '处置日期',
  };
  return (
    <>
      {error && <Alert type="error" title={error} showIcon />}
      {!context.device.asset && (
        <Alert
          type="info"
          title="尚未关联原生资产"
          description="设备台账可以独立维护。建立关联后，资产的折旧、维修与保养继续由原生资产记录管理。"
          showIcon
        />
      )}
      {context.can_bind && (
        <Button
          onClick={() => {
            form.resetFields();
            setError(undefined);
            setOpen(true);
          }}
        >
          关联已有资产
        </Button>
      )}
      {asset && (
        <Tabs
          items={[
            {
              key: 'basic',
              label: '资产资料',
              children: (
                <ProDescriptions
                  dataSource={asset.asset}
                  column={{ xs: 1, sm: 2 }}
                  columns={[
                    { title: '资产编号', dataIndex: 'name' },
                    ...asset.read_fields.map((field) => ({
                      title: labels[field] || field,
                      dataIndex: field,
                    })),
                  ]}
                />
              ),
            },
            ...(asset.can_read_repairs
              ? [
                  {
                    key: 'repair',
                    label: '原生维修记录',
                    children: (
                      <Records name={context.device.name} kind="repair" />
                    ),
                  },
                ]
              : []),
            ...(asset.can_read_maintenance
              ? [
                  {
                    key: 'maintenance',
                    label: '原生保养记录',
                    children: (
                      <Records name={context.device.name} kind="maintenance" />
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
      <ModalForm
        form={form}
        title="关联已有资产"
        open={open}
        width={540}
        modalProps={{
          destroyOnHidden: true,
          closable: !saving,
          keyboard: !saving,
          mask: { closable: !saving },
        }}
        onOpenChange={(value) => {
          if (!working.current) setOpen(value);
        }}
        onFinish={async (values) => {
          if (working.current) return false;
          working.current = true;
          setSaving(true);
          try {
            await mutate('bind_asset', {
              name: context.device.name,
              modified: context.device.modified,
              ...values,
            });
            message.success('原生资产已关联');
            setOpen(false);
            onSaved();
            return true;
          } catch (reason) {
            setError(errorMessage(reason));
            return false;
          } finally {
            working.current = false;
            setSaving(false);
          }
        }}
      >
        <Alert
          type="warning"
          showIcon
          title="核对同一台物理设备"
          description="资产须属于同一机构、已提交且未被其他设备占用。关联后不能直接替换，有治疗历史的设备不能补改资产关联。"
        />
        {error && <Alert type="error" title={error} showIcon />}
        <ProFormSelect
          name="asset"
          label="原生资产"
          showSearch
          debounceTime={300}
          rules={[{ required: true }]}
          request={({ keyWords }) =>
            api('search_assets', {
              name: context.device.name,
              keyword: keyWords || '',
            })
          }
        />
        <ProFormText
          name="confirm_code"
          label={`输入设备编号确认：${context.device.display_label || ''}`}
          rules={[
            { required: true },
            {
              validator: (_, value) =>
                value === context.device.display_label
                  ? Promise.resolve()
                  : Promise.reject(new Error('设备编号不一致')),
            },
          ]}
        />
      </ModalForm>
    </>
  );
}
